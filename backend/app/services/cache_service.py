from __future__ import annotations

import hashlib
import re
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any

from app import store


MIN_SIMILARITY = 0.92
DEFAULT_TTL_MINUTES = 60
TOKEN_RE = re.compile(r"[a-z0-9_]+")


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _normalize(text: str) -> str:
    return " ".join(TOKEN_RE.findall(text.lower()))


def _fingerprint(text: str) -> list[str]:
    return sorted(set(TOKEN_RE.findall(text.lower())))


def _similarity(left: list[str], right: list[str]) -> float:
    if not left and not right:
        return 1.0
    left_set = set(left)
    right_set = set(right)
    union = left_set | right_set
    if not union:
        return 0.0
    return len(left_set & right_set) / len(union)


class CacheService:
    def lookup(self, *, project_id: str, alias: str, prompt_text: str) -> dict[str, Any] | None:
        normalized = _normalize(prompt_text)
        if not normalized:
            return None
        prompt_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        prompt_tokens = _fingerprint(normalized)
        now_dt = datetime.now(timezone.utc)
        best: tuple[float, dict[str, Any]] | None = None
        changed = False

        for entry in store.CACHE_ENTRIES:
            if not entry.get("active", True):
                continue
            if entry.get("project_id") != project_id or entry.get("alias") != alias:
                continue
            expires_at = _parse_date(entry.get("expires_at"))
            if expires_at and expires_at <= now_dt:
                entry["active"] = False
                changed = True
                continue
            score = 1.0 if entry.get("prompt_hash") == prompt_hash else _similarity(prompt_tokens, entry.get("token_fingerprint", []))
            if score >= MIN_SIMILARITY and (best is None or score > best[0]):
                best = (score, entry)

        if changed:
            store.persist_state()
        if best is None:
            return None
        score, entry = best
        usage = entry.get("usage") or {}
        tokens_saved = int(usage.get("total_tokens") or 0)
        entry["hits"] = int(entry.get("hits") or 0) + 1
        entry["last_hit_at"] = store.now()
        entry["tokens_saved"] = int(entry.get("tokens_saved") or 0) + tokens_saved
        entry["cost_saved_inr"] = round(float(entry.get("cost_saved_inr") or 0) + float(entry.get("estimated_cost_inr") or 0), 6)
        entry["last_similarity"] = round(score, 4)
        store.persist_state()
        return {**entry, "similarity": round(score, 4), "response_body": deepcopy(entry["response_body"])}

    def store_response(
        self,
        *,
        project_id: str,
        alias: str,
        prompt_text: str,
        response_body: dict[str, Any],
        provider_id: str,
        provider_model: str,
        estimated_cost_inr: float,
        ttl_minutes: int = DEFAULT_TTL_MINUTES,
    ) -> dict[str, Any] | None:
        normalized = _normalize(prompt_text)
        if not normalized:
            return None
        created_at = datetime.now(timezone.utc)
        usage = deepcopy(response_body.get("usage") or {})
        entry = {
            "id": f"cache-{uuid.uuid4().hex[:12]}",
            "project_id": project_id,
            "alias": alias,
            "prompt_hash": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
            "prompt_preview": prompt_text.strip().replace("\n", " ")[:180],
            "token_fingerprint": _fingerprint(normalized),
            "response_body": deepcopy(response_body),
            "usage": usage,
            "provider_id": provider_id,
            "provider_model": provider_model,
            "estimated_cost_inr": round(float(estimated_cost_inr or 0), 6),
            "hits": 0,
            "tokens_saved": 0,
            "cost_saved_inr": 0.0,
            "last_similarity": 1.0,
            "ttl_minutes": ttl_minutes,
            "active": True,
            "created_at": created_at.isoformat(),
            "last_hit_at": None,
            "expires_at": (created_at + timedelta(minutes=ttl_minutes)).isoformat(),
        }
        store.CACHE_ENTRIES.insert(0, entry)
        store.persist_state()
        return entry

    def list_entries(self, *, project_id: str | None = None, include_inactive: bool = False) -> list[dict[str, Any]]:
        rows = []
        now_dt = datetime.now(timezone.utc)
        changed = False
        for entry in store.CACHE_ENTRIES:
            expires_at = _parse_date(entry.get("expires_at"))
            if expires_at and expires_at <= now_dt and entry.get("active", True):
                entry["active"] = False
                changed = True
            if project_id and entry.get("project_id") != project_id:
                continue
            if not include_inactive and not entry.get("active", True):
                continue
            rows.append(self.public_entry(entry))
        if changed:
            store.persist_state()
        return rows

    def public_entry(self, entry: dict[str, Any]) -> dict[str, Any]:
        public = {key: value for key, value in entry.items() if key not in {"response_body", "token_fingerprint"}}
        public["token_count"] = len(entry.get("token_fingerprint", []))
        return public

    def stats(self, *, project_id: str | None = None) -> dict[str, Any]:
        entries = self.list_entries(project_id=project_id, include_inactive=False)
        relevant_traces = [
            trace for trace in store.GATEWAY_REQUESTS
            if trace.get("operation") == "chat.completions" and (not project_id or trace.get("project_id") == project_id)
        ]
        hits = sum(1 for trace in relevant_traces if trace.get("cache_status") == "hit")
        misses = sum(1 for trace in relevant_traces if trace.get("cache_status") == "miss")
        return {
            "active_entries": len(entries),
            "hits": hits,
            "misses": misses,
            "hit_rate": hits / (hits + misses) if hits + misses else 0,
            "tokens_saved": sum(int(entry.get("tokens_saved") or 0) for entry in entries),
            "cost_saved_inr": round(sum(float(entry.get("cost_saved_inr") or 0) for entry in entries), 6),
        }

    def invalidate(self, cache_id: str) -> dict[str, Any] | None:
        entry = next((item for item in store.CACHE_ENTRIES if item["id"] == cache_id), None)
        if not entry:
            return None
        entry["active"] = False
        entry["invalidated_at"] = store.now()
        store.persist_state()
        return self.public_entry(entry)

    def clear(self, *, project_id: str | None = None) -> int:
        count = 0
        for entry in store.CACHE_ENTRIES:
            if project_id and entry.get("project_id") != project_id:
                continue
            if entry.get("active", True):
                entry["active"] = False
                entry["invalidated_at"] = store.now()
                count += 1
        if count:
            store.persist_state()
        return count
