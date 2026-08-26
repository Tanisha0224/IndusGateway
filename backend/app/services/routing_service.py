from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app import store
from app.core.authentication import validate_model_permission
from app.core.errors import (
    invalid_request,
    model_capability_mismatch,
    model_disabled,
    model_not_found,
    no_alias_targets,
    no_eligible_route,
    provider_unavailable,
    sovereignty_requirement_unsatisfied,
)
from app.services.model_registry import ModelConfig
from app.services.provider_health import ProviderHealthService


Capability = Literal["chat", "embedding"]


@dataclass(frozen=True)
class RoutingDecision:
    alias: dict[str, Any]
    target: dict[str, Any]
    provider: dict[str, Any]
    model_config: ModelConfig
    matched_policies: list[dict[str, Any]]
    effective_restrictions: dict[str, Any]
    eligible_targets: list[dict[str, Any]]
    excluded_targets: list[dict[str, Any]]
    routing_reason: str


def public_alias_id(alias: dict[str, Any]) -> str:
    return str(alias["alias"])


def _alias_matches(alias: dict[str, Any], requested_alias: str) -> bool:
    return alias.get("alias") == requested_alias or alias.get("id") == requested_alias


def get_alias_for_request(requested_alias: str, capability: Capability) -> dict[str, Any]:
    alias = next((item for item in store.MODEL_ALIASES if _alias_matches(item, requested_alias)), None)
    if not alias:
        raise model_not_found()
    if alias.get("status", "active") != "active" or not alias.get("active", True):
        raise model_disabled()
    if alias.get("capability") != capability:
        if capability == "chat":
            raise invalid_request("The requested model does not support chat completions", "model")
        raise invalid_request("The requested model does not support embeddings", "model")
    return alias


def list_public_aliases_for_key(key: dict[str, Any]) -> list[dict[str, Any]]:
    allowed_aliases = set(key.get("allowed_model_aliases") or [])
    allowed_providers = set(key.get("allowed_provider_ids") or [])
    result: list[dict[str, Any]] = []
    for alias in store.MODEL_ALIASES:
        if alias.get("status", "active") != "active":
            continue
        if allowed_aliases and alias["alias"] not in allowed_aliases and alias["id"] not in allowed_aliases:
            continue
        targets = [target for target in store.ALIAS_TARGETS if target["model_alias_id"] == alias["id"] and target.get("enabled", True)]
        if allowed_providers and not any(target["provider_id"] in allowed_providers for target in targets):
            continue
        result.append(alias)
    return result


def _policy_matches(policy: dict[str, Any], *, alias: dict[str, Any], key: dict[str, Any], capability: Capability) -> bool:
    if not policy.get("enabled", True):
        return False
    conditions = policy.get("conditions_json") or {}
    if conditions.get("requested_aliases") and alias["alias"] not in conditions["requested_aliases"]:
        return False
    if conditions.get("capabilities") and capability not in conditions["capabilities"]:
        return False
    if conditions.get("virtual_key_ids") and key["id"] not in conditions["virtual_key_ids"]:
        return False
    project_ids = conditions.get("project_ids") or ([policy.get("project_id")] if policy.get("project_id") else [])
    if project_ids and key["project_id"] not in project_ids:
        return False
    return True


def evaluate_policies(alias: dict[str, Any], key: dict[str, Any], capability: Capability, privacy_context: dict[str, Any] | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    matched = [
        policy for policy in sorted(store.ROUTING_POLICIES, key=lambda item: (int(item.get("priority", 100)), item["id"]))
        if _policy_matches(policy, alias=alias, key=key, capability=capability)
    ]
    restrictions: dict[str, Any] = {
        "allowed_provider_ids": None,
        "excluded_provider_ids": set(),
        "allowed_regions": None,
        "require_india_hosting": alias.get("sovereignty_mode") == "india_only",
        "external_egress_allowed": alias.get("sovereignty_mode") != "india_only",
        "fallback_allowed": bool(alias.get("fallback_enabled")),
        "maximum_timeout_seconds": None,
        "maximum_retries": None,
    }
    if alias.get("sovereignty_mode") == "unrestricted":
        restrictions["external_egress_allowed"] = True
    for policy in matched:
        actions = policy.get("actions_json") or {}
        if actions.get("allowed_provider_ids"):
            current = restrictions["allowed_provider_ids"]
            allowed = set(actions["allowed_provider_ids"])
            restrictions["allowed_provider_ids"] = allowed if current is None else current.intersection(allowed)
        restrictions["excluded_provider_ids"].update(actions.get("excluded_provider_ids") or [])
        if actions.get("allowed_regions"):
            current_regions = restrictions["allowed_regions"]
            allowed_regions = set(actions["allowed_regions"])
            restrictions["allowed_regions"] = allowed_regions if current_regions is None else current_regions.intersection(allowed_regions)
        if actions.get("require_india_hosting") is True:
            restrictions["require_india_hosting"] = True
            restrictions["external_egress_allowed"] = False
        if actions.get("external_egress_allowed") is False:
            restrictions["external_egress_allowed"] = False
        elif actions.get("external_egress_allowed") is True and not restrictions["require_india_hosting"]:
            restrictions["external_egress_allowed"] = True
        if actions.get("fallback_allowed") is False:
            restrictions["fallback_allowed"] = False
        elif actions.get("fallback_allowed") is True and alias.get("fallback_enabled"):
            restrictions["fallback_allowed"] = True
        if actions.get("maximum_timeout_seconds") is not None:
            value = int(actions["maximum_timeout_seconds"])
            current_timeout = restrictions["maximum_timeout_seconds"]
            restrictions["maximum_timeout_seconds"] = value if current_timeout is None else min(current_timeout, value)
        if actions.get("maximum_retries") is not None:
            value = int(actions["maximum_retries"])
            current_retries = restrictions["maximum_retries"]
            restrictions["maximum_retries"] = value if current_retries is None else min(current_retries, value)
    if privacy_context:
        if privacy_context.get("external_egress_allowed") is False:
            restrictions["external_egress_allowed"] = False
        if privacy_context.get("fallback_allowed") is False:
            restrictions["fallback_allowed"] = False
    return matched, restrictions


def _target_exclusion_reason(target: dict[str, Any], provider: dict[str, Any] | None, key: dict[str, Any], restrictions: dict[str, Any]) -> str | None:
    if not target.get("enabled", True):
        return "Target is disabled."
    if not provider or not provider.get("is_active", True):
        return "Provider is disabled."
    if not ProviderHealthService().is_routable(provider["id"]):
        return "Provider health circuit is not routable."
    allowed_providers = set(key.get("allowed_provider_ids") or [])
    if allowed_providers and target["provider_id"] not in allowed_providers:
        return "Virtual key does not allow this provider."
    if restrictions["allowed_provider_ids"] is not None and target["provider_id"] not in restrictions["allowed_provider_ids"]:
        return "Routing policy does not allow this provider."
    if target["provider_id"] in restrictions["excluded_provider_ids"]:
        return "Routing policy excludes this provider."
    if restrictions["allowed_regions"] is not None and target.get("region") not in restrictions["allowed_regions"]:
        return "Routing policy does not allow this region."
    if restrictions["require_india_hosting"] and not target.get("is_india_hosted"):
        return "India-hosting is required."
    if not restrictions["external_egress_allowed"] and not target.get("is_india_hosted"):
        return "External egress is blocked."
    return None


def simulate_route(requested_alias: str, capability: Capability, key: dict[str, Any]) -> dict[str, Any]:
    alias = get_alias_for_request(requested_alias, capability)
    validate_model_permission(key, alias["alias"])
    matched, restrictions = evaluate_policies(alias, key, capability)
    targets = sorted([target for target in store.ALIAS_TARGETS if target["model_alias_id"] == alias["id"]], key=lambda item: (int(item["priority"]), item["id"]))
    eligible = []
    excluded = []
    for target in targets:
        provider = next((item for item in store.PROVIDERS if item["id"] == target["provider_id"]), None)
        reason = _target_exclusion_reason(target, provider, key, restrictions)
        summary = {k: target[k] for k in ("id", "provider_id", "priority", "enabled", "region", "is_india_hosted", "fallback_eligible")}
        if reason:
            excluded.append({**summary, "reason": reason})
        else:
            eligible.append(summary)
    return {
        "matched_policies": [{"id": item["id"], "name": item["name"], "priority": item["priority"]} for item in matched],
        "effective_restrictions": _jsonable_restrictions(restrictions),
        "eligible_targets": eligible,
        "excluded_targets": excluded,
    }


def resolve_route(requested_alias: str, capability: Capability, key: dict[str, Any], privacy_context: dict[str, Any] | None = None) -> RoutingDecision:
    alias = get_alias_for_request(requested_alias, capability)
    validate_model_permission(key, alias["alias"])
    matched, restrictions = evaluate_policies(alias, key, capability, privacy_context)
    targets = sorted([target for target in store.ALIAS_TARGETS if target["model_alias_id"] == alias["id"]], key=lambda item: (int(item["priority"]), item["id"]))
    if not targets:
        raise no_alias_targets()
    eligible = []
    excluded = []
    for target in targets:
        provider = next((item for item in store.PROVIDERS if item["id"] == target["provider_id"]), None)
        reason = _target_exclusion_reason(target, provider, key, restrictions)
        if reason:
            excluded.append({"target": target, "reason": reason})
        elif provider:
            eligible.append((target, provider))
    if not eligible:
        if restrictions["require_india_hosting"]:
            raise sovereignty_requirement_unsatisfied()
        raise no_eligible_route()
    target, provider = eligible[0]
    model_config = ModelConfig(
        alias=alias["alias"],
        provider_id=provider["id"],
        provider_type=provider.get("provider_type", "openai_compatible"),
        provider_model=target["provider_model_name"],
        owned_by=alias.get("owned_by", "indusgate"),
        created=int(alias.get("created", 1720000000)),
        supports_chat=capability == "chat",
        supports_streaming=capability == "chat" and bool(provider.get("supports_streaming", True)),
        supports_embeddings=capability == "embedding",
        provider=provider,
    )
    return RoutingDecision(
        alias=alias,
        target=target,
        provider=provider,
        model_config=model_config,
        matched_policies=matched,
        effective_restrictions=restrictions,
        eligible_targets=[item[0] for item in eligible],
        excluded_targets=excluded,
        routing_reason=f"Selected {provider['name']} target {target['id']} by priority {target['priority']}.",
    )


def _jsonable_restrictions(restrictions: dict[str, Any]) -> dict[str, Any]:
    result = dict(restrictions)
    for key in ("allowed_provider_ids", "excluded_provider_ids", "allowed_regions"):
        if isinstance(result.get(key), set):
            result[key] = sorted(result[key])
    return result


def routing_trace_fields(decision: RoutingDecision, *, attempted_targets: list[dict[str, Any]] | None = None, fallback_used: bool = False, failure_categories: list[str] | None = None) -> dict[str, Any]:
    return {
        "requested_public_alias": decision.alias["alias"],
        "selected_alias_id": decision.alias["id"],
        "selected_target_id": decision.target["id"],
        "selected_provider_id": decision.provider["id"],
        "selected_provider_model": decision.target["provider_model_name"],
        "matched_routing_policy_ids": [policy["id"] for policy in decision.matched_policies],
        "sovereignty_mode": decision.alias["sovereignty_mode"],
        "external_egress_allowed": bool(decision.effective_restrictions["external_egress_allowed"]),
        "routing_reason": decision.routing_reason,
        "attempt_count": len(attempted_targets or []),
        "fallback_used": fallback_used,
        "attempted_targets": attempted_targets or [],
        "provider_failure_categories": failure_categories or [],
    }
