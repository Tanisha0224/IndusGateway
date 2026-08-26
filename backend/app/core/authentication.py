from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Header

from app import store
from app.core.errors import expired_api_key, invalid_api_key, model_not_allowed, revoked_api_key


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise invalid_api_key("Missing bearer token")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise invalid_api_key("Missing bearer token")
    return token.strip()


def _parse_expiry(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def validate_virtual_key_token(token: str) -> dict[str, Any]:
    key_id = store.FULL_KEY_MAP.get(token) or store.KEY_HASH_MAP.get(store.hash_secret(token))
    if not key_id:
        raise invalid_api_key()
    key = next((item for item in store.VIRTUAL_KEYS if item["id"] == key_id), None)
    if not key:
        raise invalid_api_key()
    status = str(key.get("status", "")).lower()
    if status == "revoked":
        raise revoked_api_key()
    if status not in {"active", "enabled"}:
        raise invalid_api_key("Virtual key is disabled")
    expires_at = _parse_expiry(key.get("expires_at"))
    if expires_at and expires_at <= datetime.now(timezone.utc):
        raise expired_api_key()
    project = next((item for item in store.PROJECTS if item["id"] == key["project_id"]), None)
    if project and str(project.get("status", "")).lower() not in {"active", "enabled"}:
        raise invalid_api_key("Owning project is inactive")
    return key


def validate_model_permission(key: dict[str, Any], alias: str, provider_id: str | None = None) -> None:
    allowed = key.get("allowed_model_aliases") or []
    if allowed and alias not in allowed:
        raise model_not_allowed()
    allowed_providers = key.get("allowed_provider_ids") or []
    if provider_id and allowed_providers and provider_id not in allowed_providers:
        raise model_not_allowed()


def current_virtual_key(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    return validate_virtual_key_token(_parse_bearer_token(authorization))
