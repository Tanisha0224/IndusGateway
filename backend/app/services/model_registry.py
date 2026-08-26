from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app import store
from app.core.errors import model_capability_mismatch, model_not_found, provider_unavailable


Operation = Literal["chat", "embeddings"]


@dataclass(frozen=True)
class ModelConfig:
    alias: str
    provider_id: str
    provider_type: str
    provider_model: str
    owned_by: str
    created: int
    supports_chat: bool
    supports_streaming: bool
    supports_embeddings: bool
    provider: dict[str, Any]


def list_active_aliases() -> list[dict[str, Any]]:
    return [alias for alias in store.MODEL_ALIASES if alias.get("status", "active") == "active" and alias.get("active", True)]


def list_allowed_aliases(key: dict[str, Any]) -> list[dict[str, Any]]:
    allowed = set(key.get("allowed_model_aliases") or [])
    allowed_providers = set(key.get("allowed_provider_ids") or [])
    aliases = list_active_aliases()
    if allowed:
        aliases = [alias for alias in aliases if alias["alias"] in allowed or alias["id"] in allowed]
    if allowed_providers:
        aliases = [
            alias for alias in aliases
            if any(
                target["model_alias_id"] == alias["id"] and target["provider_id"] in allowed_providers and target.get("enabled", True)
                for target in store.ALIAS_TARGETS
            )
        ]
    return aliases


def resolve_model(alias_id: str, operation: Operation) -> ModelConfig:
    alias = next((item for item in store.MODEL_ALIASES if item.get("alias") == alias_id and item.get("status", "active") == "active" and item.get("active", True)), None)
    if not alias:
        raise model_not_found()
    if operation == "chat" and alias.get("capability") != "chat":
        raise model_capability_mismatch("The requested model does not support chat completions")
    if operation == "embeddings" and alias.get("capability") != "embedding":
        raise model_capability_mismatch("The requested model does not support embeddings")
    target = next((item for item in sorted(store.ALIAS_TARGETS, key=lambda t: (t["priority"], t["id"])) if item["model_alias_id"] == alias["id"] and item.get("enabled")), None)
    if not target:
        raise provider_unavailable()
    provider = next((item for item in store.PROVIDERS if item["id"] == target["provider_id"]), None)
    if not provider or not provider.get("is_active"):
        raise provider_unavailable()
    return ModelConfig(
        alias=alias["alias"],
        provider_id=provider["id"],
        provider_type=provider.get("provider_type", "openai_compatible"),
        provider_model=target["provider_model_name"],
        owned_by=alias.get("owned_by", "indusgate"),
        created=int(alias.get("created", 1720000000)),
        supports_chat=alias.get("capability") == "chat",
        supports_streaming=alias.get("capability") == "chat",
        supports_embeddings=alias.get("capability") == "embedding",
        provider=provider,
    )
