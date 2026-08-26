from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any

from app import store
from app.core.config import Settings, get_settings
from app.core.errors import OpenAIError, budget_exceeded, governance_unavailable, rate_limit_exceeded

try:
    import redis.asyncio as redis_async
except Exception:  # pragma: no cover - dependency may be absent in some local shells
    redis_async = None


ACQUIRE_LUA = """
local retry = 60
for i=1,#KEYS do
  local current = tonumber(redis.call('GET', KEYS[i]) or '0')
  local limit = tonumber(ARGV[i])
  local cost = tonumber(ARGV[#KEYS + i])
  if limit >= 0 and current + cost > limit then
    return {0, KEYS[i], retry}
  end
end
for i=1,#KEYS do
  local cost = tonumber(ARGV[#KEYS + i])
  redis.call('INCRBY', KEYS[i], cost)
  redis.call('EXPIRE', KEYS[i], 60)
end
return {1, '', 0}
"""

RELEASE_LUA = """
for i=1,#KEYS do
  local cost = tonumber(ARGV[i])
  local current = tonumber(redis.call('GET', KEYS[i]) or '0')
  local next_value = current - cost
  if next_value < 0 then next_value = 0 end
  redis.call('SET', KEYS[i], next_value, 'KEEPTTL')
end
return {1}
"""


@dataclass
class GovernanceDecision:
    reservation_id: str
    headers: dict[str, str]
    estimated_tokens: int
    estimated_cost_inr: float
    redis_keys: list[str]
    redis_costs: list[int]


class GovernanceService:
    def __init__(self, settings: Settings | None = None, redis_client: Any | None = None) -> None:
        self.settings = settings or get_settings()
        self.redis = redis_client

    async def acquire(self, *, key: dict[str, Any], alias: str, estimated_tokens: int) -> GovernanceDecision:
        estimated_cost = self._cost_for_tokens(estimated_tokens)
        project = next((item for item in store.PROJECTS if item["id"] == key["project_id"]), None)
        if project and project.get("monthly_budget_inr") is not None:
            usage = store.PROJECT_USAGE.setdefault(project["id"], {"spend_this_month_inr": 0.0, "total_tokens_this_month": 0, "request_count_this_month": 0})
            if usage["spend_this_month_inr"] + estimated_cost > float(project["monthly_budget_inr"]):
                raise budget_exceeded(self._headers("budget", 60))
        policies = self._matching_policies(key, alias)
        redis_keys, limits, costs = self._redis_plan(policies, key, alias, estimated_tokens)
        if policies and self.settings.governance_enforcement_enabled:
            client = await self._redis_client()
            if client is None:
                raise governance_unavailable(self._headers("redis", 60))
            try:
                result = await client.eval(ACQUIRE_LUA, len(redis_keys), *redis_keys, *limits, *costs)
            except Exception as exc:
                if self.settings.governance_fail_mode == "open":
                    result = [1, "", 0]
                else:
                    raise governance_unavailable(self._headers("redis", 60)) from exc
            if int(result[0]) != 1:
                retry_after = int(result[2] or 60)
                raise rate_limit_exceeded("Rate limit exceeded.", self._headers(str(result[1]), retry_after))
        reservation_id = f"res-{uuid.uuid4().hex[:12]}"
        store.USAGE_RESERVATIONS[reservation_id] = {
            "id": reservation_id,
            "project_id": key["project_id"],
            "virtual_key_id": key["id"],
            "alias": alias,
            "estimated_tokens": estimated_tokens,
            "estimated_cost_inr": estimated_cost,
            "redis_keys": redis_keys,
            "redis_costs": costs,
            "status": "reserved",
            "created_at": store.now(),
        }
        store.persist_state()
        return GovernanceDecision(reservation_id, self._headers("ok", 0), estimated_tokens, estimated_cost, redis_keys, costs)

    async def settle(self, reservation_id: str | None, actual_tokens: int) -> None:
        if not reservation_id or reservation_id not in store.USAGE_RESERVATIONS:
            return
        reservation = store.USAGE_RESERVATIONS[reservation_id]
        if reservation["status"] != "reserved":
            return
        actual_cost = self._cost_for_tokens(actual_tokens)
        usage = store.PROJECT_USAGE.setdefault(reservation["project_id"], {"spend_this_month_inr": 0.0, "total_tokens_this_month": 0, "request_count_this_month": 0})
        usage["spend_this_month_inr"] = round(float(usage["spend_this_month_inr"]) + actual_cost, 6)
        usage["total_tokens_this_month"] = int(usage["total_tokens_this_month"]) + actual_tokens
        usage["request_count_this_month"] = int(usage["request_count_this_month"]) + 1
        reservation["status"] = "settled"
        reservation["actual_tokens"] = actual_tokens
        reservation["actual_cost_inr"] = actual_cost
        reservation["settled_at"] = store.now()
        await self._release_concurrency(reservation)
        store.persist_state()

    async def release(self, reservation_id: str | None) -> None:
        if not reservation_id or reservation_id not in store.USAGE_RESERVATIONS:
            return
        reservation = store.USAGE_RESERVATIONS[reservation_id]
        if reservation["status"] != "reserved":
            return
        reservation["status"] = "released"
        reservation["released_at"] = store.now()
        await self._release_concurrency(reservation)
        store.persist_state()

    def estimate_tokens_for_chat(self, messages: list[Any], max_tokens: int | None = None) -> int:
        prompt = " ".join(str(getattr(message, "content", "") or "") for message in messages)
        prompt_tokens = max(1, len(prompt.split()))
        return prompt_tokens + int(max_tokens or self.settings.governance_estimated_completion_tokens)

    def estimate_tokens_for_embeddings(self, value: str | list[str]) -> int:
        values = [value] if isinstance(value, str) else value
        return max(1, len(" ".join(values).split()))

    def _matching_policies(self, key: dict[str, Any], alias: str) -> list[dict[str, Any]]:
        scopes = {("virtual_key", key["id"]), ("project", key["project_id"]), ("model_alias", alias)}
        return [policy for policy in store.RATE_LIMIT_POLICIES if policy.get("enabled", True) and (policy.get("scope"), policy.get("scope_id")) in scopes]

    def _redis_plan(self, policies: list[dict[str, Any]], key: dict[str, Any], alias: str, estimated_tokens: int) -> tuple[list[str], list[int], list[int]]:
        minute = int(time.time() // 60)
        redis_keys: list[str] = []
        limits: list[int] = []
        costs: list[int] = []
        for policy in policies:
            prefix = f"ig:rl:{policy['scope']}:{policy['scope_id']}:{minute}"
            redis_keys.extend([f"{prefix}:rpm", f"{prefix}:tpm", f"ig:conc:{policy['scope']}:{policy['scope_id']}"])
            limits.extend([int(policy["requests_per_minute"]), int(policy["tokens_per_minute"]), int(policy["max_concurrent_requests"])])
            costs.extend([1, int(estimated_tokens), 1])
        return redis_keys, limits, costs

    async def _release_concurrency(self, reservation: dict[str, Any]) -> None:
        keys = [key for key in reservation.get("redis_keys", []) if key.startswith("ig:conc:")]
        if not keys:
            return
        client = await self._redis_client()
        if client is None:
            return
        try:
            await client.eval(RELEASE_LUA, len(keys), *keys, *([1] * len(keys)))
        except Exception:
            return

    async def _redis_client(self) -> Any | None:
        if self.redis is not None:
            return self.redis
        if redis_async is None or not self.settings.redis_url:
            return None
        self.redis = redis_async.from_url(self.settings.redis_url, encoding="utf-8", decode_responses=True)
        try:
            await self.redis.ping()
        except Exception:
            self.redis = None
        return self.redis

    def _cost_for_tokens(self, tokens: int) -> float:
        return round((tokens / 1000) * self.settings.governance_cost_per_1k_tokens_inr, 6)

    def _headers(self, reason: str, retry_after: int) -> dict[str, str]:
        headers = {
            "X-RateLimit-Policy": reason,
            "X-RateLimit-Limit-Requests": "enforced",
            "X-RateLimit-Limit-Tokens": "enforced",
            "X-RateLimit-Remaining-Requests": "unknown",
            "X-RateLimit-Remaining-Tokens": "unknown",
        }
        if retry_after:
            headers["Retry-After"] = str(retry_after)
        return headers
