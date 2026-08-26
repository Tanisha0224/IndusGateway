from __future__ import annotations

import uuid
import hashlib
from base64 import urlsafe_b64encode
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


USERS = [
    {"id": "user-admin", "email": "platform.admin@indusgate.example", "name": "Rohan Deshmukh", "role": "admin", "app_role": "platform_admin", "status": "active", "department_id": "dept-idx", "team_id": "team-aiplatform", "project_ids": ["proj-compliance", "proj-knowledge", "proj-support"], "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "user-orgadmin", "email": "org.admin@indusgate.example", "name": "Anjali Kulkarni", "role": "admin", "app_role": "org_admin", "status": "active", "department_id": "dept-idx", "team_id": "team-aiplatform", "project_ids": ["proj-compliance", "proj-knowledge", "proj-support"], "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "user-manager", "email": "dept.manager@indusgate.example", "name": "Vikram Salunkhe", "role": "member", "app_role": "department_manager", "status": "active", "department_id": "dept-infosec", "team_id": "team-compliance", "project_ids": ["proj-compliance"], "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "user-dev", "email": "developer@indusgate.example", "name": "Priya Nair", "role": "member", "app_role": "developer", "status": "active", "department_id": "dept-idx", "team_id": "team-aiplatform", "project_ids": ["proj-knowledge"], "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "user-auditor", "email": "auditor@indusgate.example", "name": "Suresh Iyer", "role": "member", "app_role": "auditor", "status": "active", "department_id": "dept-infosec", "team_id": "team-compliance", "project_ids": ["proj-compliance"], "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "user-billing", "email": "billing.viewer@indusgate.example", "name": "Meera Joshi", "role": "member", "app_role": "billing_viewer", "status": "active", "department_id": "dept-finance", "team_id": None, "project_ids": [], "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "user-viewer", "email": "viewer@indusgate.example", "name": "Arjun Bhat", "role": "member", "app_role": "read_only_viewer", "status": "active", "department_id": "dept-hr", "team_id": None, "project_ids": [], "created_at": "2026-05-12T09:00:00+00:00"},
]
DEFAULT_USERS = deepcopy(USERS)
SESSIONS: dict[str, dict[str, Any]] = {}

POLICIES = [
    {
        "id": "policy-sensitive",
        "project_id": "proj-compliance",
        "name": "Sensitive Data - Sovereign Only",
        "description": "Mask ordinary PII and block high-risk regulated identifiers.",
        "priority": 1,
        "enabled": True,
        "classification": "regulated",
        "default_action": "mask_and_allow",
        "allow_external": False,
        "external_egress_allowed": False,
        "mask_before_egress": True,
        "mask_before_external_egress": True,
        "block_regulated_fields": False,
        "allow_restoration": False,
        "request_retention_mode": "metadata_only",
        "response_scan_enabled": True,
        "entity_rules": {
            "AADHAAR": {"action": "block", "minimum_confidence": 0.95},
            "CARD": {"action": "block", "minimum_confidence": 0.95},
            "API_KEY": {"action": "block", "minimum_confidence": 0.9},
            "JWT": {"action": "block", "minimum_confidence": 0.9},
            "PAN": {"action": "mask_and_allow", "minimum_confidence": 0.85},
            "EMAIL": {"action": "mask_and_allow", "minimum_confidence": 0.8},
        },
        "created_by": "user-admin",
        "created_at": "2026-02-01T08:00:00+00:00",
        "updated_at": "2026-02-01T08:00:00+00:00",
    },
    {
        "id": "policy-general",
        "project_id": "proj-knowledge",
        "name": "General Workloads",
        "description": "Mask common PII before provider processing.",
        "priority": 10,
        "enabled": True,
        "classification": "internal",
        "default_action": "mask_and_allow",
        "allow_external": True,
        "external_egress_allowed": True,
        "mask_before_egress": True,
        "mask_before_external_egress": True,
        "block_regulated_fields": False,
        "allow_restoration": False,
        "request_retention_mode": "metadata_only",
        "response_scan_enabled": True,
        "entity_rules": {},
        "created_by": "user-admin",
        "created_at": "2026-01-20T08:00:00+00:00",
        "updated_at": "2026-01-20T08:00:00+00:00",
    },
    {
        "id": "policy-block",
        "project_id": "proj-support",
        "name": "Restricted Data Block",
        "description": "Block sensitive data before egress.",
        "priority": 1,
        "enabled": True,
        "classification": "restricted",
        "default_action": "block",
        "allow_external": False,
        "external_egress_allowed": False,
        "mask_before_egress": True,
        "mask_before_external_egress": True,
        "block_regulated_fields": True,
        "allow_restoration": False,
        "request_retention_mode": "metadata_only",
        "response_scan_enabled": True,
        "entity_rules": {},
        "created_by": "user-admin",
        "created_at": "2026-01-20T08:00:00+00:00",
        "updated_at": "2026-01-20T08:00:00+00:00",
    },
]
PROJECTS = [
    {"id": "proj-compliance", "name": "Compliance Portal", "description": "Automated regulatory compliance drafting and review assistant.", "owner_user_id": "user-admin", "policy_id": "policy-sensitive", "status": "active", "monthly_budget_inr": 4000, "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "proj-knowledge", "name": "Internal Knowledge Assistant", "description": "Employee-facing assistant over internal documentation.", "owner_user_id": "user-dev", "policy_id": "policy-general", "status": "active", "monthly_budget_inr": 6000, "created_at": "2026-03-02T09:00:00+00:00"},
    {"id": "proj-support", "name": "Customer Support Copilot", "description": "Agent-assist for cloud support ticket triage and drafting.", "owner_user_id": "user-dev", "policy_id": "policy-general", "status": "active", "monthly_budget_inr": 9000, "created_at": "2026-01-20T09:00:00+00:00"},
]
PROVIDERS = [
    {"id": "provider-demo-local", "name": "Local Demo Provider", "provider_type": "demo", "base_url": "local://demo", "is_active": True, "supports_chat": True, "supports_streaming": True, "supports_embeddings": False, "created_at": "2026-05-12T09:00:00+00:00"},
    {"id": "provider-india-hosted", "name": "India-hosted Sovereign", "provider_type": "india_hosted", "base_url": "https://models.indusgate.local/v1", "is_active": True, "supports_chat": True, "supports_streaming": True, "supports_embeddings": True, "created_at": "2026-01-10T08:00:00+00:00"},
    {"id": "provider-openai", "name": "OpenAI", "provider_type": "external", "base_url": "https://api.openai.com/v1", "is_active": True, "supports_chat": True, "supports_streaming": True, "supports_embeddings": True, "created_at": "2026-01-10T08:00:00+00:00"},
    {"id": "provider-gemini", "name": "Google Gemini", "provider_type": "gemini", "base_url": "https://generativelanguage.googleapis.com/v1beta", "is_active": True, "supports_chat": True, "supports_streaming": False, "supports_embeddings": False, "created_at": "2026-01-10T08:00:00+00:00"},
]
PROVIDER_MODELS = {
    "provider-demo-local": ["demo-chat-safe"],
    "provider-india-hosted": ["indusgate-general", "indusgate-fast", "indusgate-code", "indusgate-document", "indusgate-sensitive", "indusgate-embedding"],
    "provider-openai": ["gpt-4o", "gpt-4o-mini", "indusgate-premium", "text-embedding-3-small"],
    "provider-gemini": ["gemini-1.5-pro", "gemini-1.5-flash"],
}
PROVIDER_CREDENTIALS: dict[str, dict[str, Any]] = {}
PROVIDER_HEALTH = {
    provider["id"]: {
        "provider_id": provider["id"],
        "status": "unknown",
        "circuit_state": "closed",
        "consecutive_successes": 0,
        "consecutive_failures": 0,
        "last_checked_at": None,
        "last_success_at": None,
        "last_failure_at": None,
        "last_latency_ms": None,
        "last_error": None,
        "opened_at": None,
        "half_opened_at": None,
        "updated_at": now(),
    }
    for provider in PROVIDERS
}
PROVIDER_HEALTH_HISTORY: list[dict[str, Any]] = []
ALERTS: list[dict[str, Any]] = []
MODEL_ALIASES = [
    {"id": "alias-demo", "project_id": "proj-knowledge", "alias": "indusgate-demo", "display_name": "IndusGate Demo", "description": "Guaranteed local response for demos without external provider credentials.", "capability": "chat", "status": "active", "sovereignty_mode": "india_only", "fallback_enabled": False, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
    {"id": "alias-general", "project_id": "proj-knowledge", "alias": "indusgate-general", "display_name": "IndusGate General", "description": "General purpose sovereign chat alias.", "capability": "chat", "status": "active", "sovereignty_mode": "protected_external", "fallback_enabled": True, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
    {"id": "alias-fast", "project_id": "proj-knowledge", "alias": "indusgate-fast", "display_name": "IndusGate Fast", "description": "Low-latency sovereign chat alias.", "capability": "chat", "status": "active", "sovereignty_mode": "protected_external", "fallback_enabled": True, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
    {"id": "alias-code", "project_id": "proj-knowledge", "alias": "indusgate-code", "display_name": "IndusGate Code", "description": "Code-focused chat alias.", "capability": "chat", "status": "active", "sovereignty_mode": "protected_external", "fallback_enabled": True, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
    {"id": "alias-document", "project_id": "proj-compliance", "alias": "indusgate-document", "display_name": "IndusGate Document", "description": "Document review chat alias.", "capability": "chat", "status": "active", "sovereignty_mode": "india_only", "fallback_enabled": False, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
    {"id": "alias-sensitive", "project_id": "proj-compliance", "alias": "indusgate-sensitive", "display_name": "IndusGate Sensitive", "description": "India-only sensitive data chat alias.", "capability": "chat", "status": "active", "sovereignty_mode": "india_only", "fallback_enabled": False, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
    {"id": "alias-embedding", "project_id": "proj-knowledge", "alias": "indusgate-embedding", "display_name": "IndusGate Embedding", "description": "Sovereign embedding alias.", "capability": "embedding", "status": "active", "sovereignty_mode": "protected_external", "fallback_enabled": True, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
    {"id": "alias-premium", "project_id": "proj-knowledge", "alias": "indusgate-premium", "display_name": "IndusGate Premium", "description": "External premium chat alias.", "capability": "chat", "status": "active", "sovereignty_mode": "unrestricted", "fallback_enabled": False, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00", "owned_by": "indusgate", "created": 1720000000},
]
ALIAS_TARGETS = [
    {"id": "target-demo-local", "model_alias_id": "alias-demo", "provider_id": "provider-demo-local", "provider_model_name": "demo-chat-safe", "priority": 1, "enabled": True, "region": "local", "is_india_hosted": True, "timeout_seconds": 5, "max_retries": 0, "fallback_eligible": False, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-general-india", "model_alias_id": "alias-general", "provider_id": "provider-india-hosted", "provider_model_name": "llama-3.1-8b-instruct", "priority": 1, "enabled": True, "region": "in-west-1", "is_india_hosted": True, "timeout_seconds": 30, "max_retries": 1, "fallback_eligible": True, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-general-openai", "model_alias_id": "alias-general", "provider_id": "provider-openai", "provider_model_name": "gpt-4o-mini", "priority": 2, "enabled": True, "region": "us", "is_india_hosted": False, "timeout_seconds": 30, "max_retries": 1, "fallback_eligible": True, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-fast-india", "model_alias_id": "alias-fast", "provider_id": "provider-india-hosted", "provider_model_name": "mistral-7b-instruct", "priority": 1, "enabled": True, "region": "in-west-1", "is_india_hosted": True, "timeout_seconds": 20, "max_retries": 1, "fallback_eligible": True, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-code-india", "model_alias_id": "alias-code", "provider_id": "provider-india-hosted", "provider_model_name": "codellama-13b-instruct", "priority": 1, "enabled": True, "region": "in-west-1", "is_india_hosted": True, "timeout_seconds": 30, "max_retries": 1, "fallback_eligible": True, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-document-india", "model_alias_id": "alias-document", "provider_id": "provider-india-hosted", "provider_model_name": "document-assistant", "priority": 1, "enabled": True, "region": "in-west-1", "is_india_hosted": True, "timeout_seconds": 30, "max_retries": 1, "fallback_eligible": False, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-sensitive-india", "model_alias_id": "alias-sensitive", "provider_id": "provider-india-hosted", "provider_model_name": "sovereign-sensitive", "priority": 1, "enabled": True, "region": "in-west-1", "is_india_hosted": True, "timeout_seconds": 30, "max_retries": 1, "fallback_eligible": False, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-embedding-india", "model_alias_id": "alias-embedding", "provider_id": "provider-india-hosted", "provider_model_name": "bge-large-en-v1.5", "priority": 1, "enabled": True, "region": "in-west-1", "is_india_hosted": True, "timeout_seconds": 30, "max_retries": 1, "fallback_eligible": True, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "target-premium-openai", "model_alias_id": "alias-premium", "provider_id": "provider-openai", "provider_model_name": "gpt-4o", "priority": 1, "enabled": True, "region": "us", "is_india_hosted": False, "timeout_seconds": 30, "max_retries": 1, "fallback_eligible": False, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
]
ROUTING_POLICIES = [
    {"id": "route-sensitive-india", "project_id": "proj-compliance", "name": "Compliance India-only routing", "description": "Compliance workloads must stay on India-hosted providers.", "priority": 1, "enabled": True, "conditions_json": {"project_ids": ["proj-compliance"], "capabilities": ["chat", "embedding"]}, "actions_json": {"require_india_hosting": True, "external_egress_allowed": False, "fallback_allowed": False}, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "route-knowledge-protected", "project_id": "proj-knowledge", "name": "Knowledge protected external fallback", "description": "Allow India-hosted primary routing and protected external fallback.", "priority": 5, "enabled": True, "conditions_json": {"project_ids": ["proj-knowledge"]}, "actions_json": {"external_egress_allowed": True, "fallback_allowed": True}, "created_by": "user-admin", "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
]
RATE_LIMIT_POLICIES = [
    {"id": "rl-key-demo", "scope": "virtual_key", "scope_id": "key-2", "name": "Developer key limits", "enabled": False, "requests_per_minute": 120, "tokens_per_minute": 120000, "max_concurrent_requests": 10, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "rl-project-knowledge", "scope": "project", "scope_id": "proj-knowledge", "name": "Knowledge project limits", "enabled": False, "requests_per_minute": 240, "tokens_per_minute": 240000, "max_concurrent_requests": 25, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
    {"id": "rl-alias-general", "scope": "model_alias", "scope_id": "indusgate-general", "name": "General alias limits", "enabled": False, "requests_per_minute": 180, "tokens_per_minute": 180000, "max_concurrent_requests": 20, "created_at": "2026-05-12T09:00:00+00:00", "updated_at": "2026-05-12T09:00:00+00:00"},
]
USAGE_RESERVATIONS: dict[str, dict[str, Any]] = {}
PROJECT_USAGE = {
    "proj-compliance": {"spend_this_month_inr": 3340.0, "total_tokens_this_month": 2450000, "request_count_this_month": 1260},
    "proj-knowledge": {"spend_this_month_inr": 1280.0, "total_tokens_this_month": 2450000, "request_count_this_month": 1260},
    "proj-support": {"spend_this_month_inr": 1280.0, "total_tokens_this_month": 2450000, "request_count_this_month": 1260},
}
VIRTUAL_KEYS = [
    {"id": "key-1", "key_prefix": "ig_sk_live_demo", "project_id": "proj-compliance", "created_by_user_id": "user-admin", "status": "active", "expires_at": None, "allowed_provider_ids": ["provider-india-hosted"], "allowed_model_aliases": ["indusgate-general", "indusgate-sensitive", "indusgate-document"], "created_at": "2026-05-12T09:10:00+00:00"},
    {"id": "key-2", "key_prefix": "ig_sk_test_demo", "project_id": "proj-knowledge", "created_by_user_id": "user-dev", "status": "active", "expires_at": None, "allowed_provider_ids": ["provider-demo-local", "provider-india-hosted", "provider-openai"], "allowed_model_aliases": ["indusgate-demo", "indusgate-general", "indusgate-fast", "indusgate-premium", "indusgate-embedding"], "created_at": "2026-05-15T09:10:00+00:00"},
]
FULL_KEY_MAP = {"ig_sk_live_demo_secret": "key-1", "ig_sk_test_demo_secret": "key-2"}
KEY_HASH_MAP: dict[str, str] = {}
GATEWAY_REQUESTS: list[dict[str, Any]] = []
CACHE_ENTRIES: list[dict[str, Any]] = []
AUDIT_LOGS = [
    {"id": str(uuid.uuid4()), "actor_type": "system", "actor_id": None, "action": "seed.complete", "resource_type": "database", "resource_id": "indusgate", "metadata_json": {"status": "ready"}, "created_at": now()},
]
DEFAULT_PROVIDERS = deepcopy(PROVIDERS)
DEFAULT_PROVIDER_MODELS = deepcopy(PROVIDER_MODELS)
DEFAULT_MODEL_ALIASES = deepcopy(MODEL_ALIASES)
DEFAULT_ALIAS_TARGETS = deepcopy(ALIAS_TARGETS)

_PERSISTENCE_ENABLED = False
_PERSISTENCE_ERROR: str | None = None


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _fernet() -> Fernet:
    from app.core.config import get_settings

    key = get_settings().encryption_key.strip()
    if key:
        return Fernet(key.encode("utf-8"))
    digest = hashlib.sha256(get_settings().jwt_secret.encode("utf-8")).digest()
    return Fernet(urlsafe_b64encode(digest))


def set_provider_api_key(provider_id: str, api_key: str) -> None:
    PROVIDER_CREDENTIALS[provider_id] = {
        "provider_id": provider_id,
        "encrypted_api_key": _fernet().encrypt(api_key.encode("utf-8")).decode("utf-8"),
        "api_key_hash": hash_secret(api_key),
        "configured": True,
        "updated_at": now(),
    }


def clear_provider_api_key(provider_id: str) -> None:
    PROVIDER_CREDENTIALS.pop(provider_id, None)


def get_provider_api_key(provider_id: str) -> str:
    credential = PROVIDER_CREDENTIALS.get(provider_id)
    if not credential or not credential.get("encrypted_api_key"):
        return ""
    try:
        return _fernet().decrypt(str(credential["encrypted_api_key"]).encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""


def provider_credential_metadata(provider_id: str) -> dict[str, Any]:
    credential = PROVIDER_CREDENTIALS.get(provider_id)
    return {
        "credential_configured": bool(credential and credential.get("configured")),
        "credential_last_updated_at": credential.get("updated_at") if credential else None,
        "credential_hash_prefix": str(credential.get("api_key_hash", ""))[:12] if credential else None,
    }


def register_full_key(full_key: str, key_id: str) -> None:
    FULL_KEY_MAP[full_key] = key_id
    KEY_HASH_MAP[hash_secret(full_key)] = key_id


def ensure_demo_mode_seed() -> None:
    provider = next((item for item in DEFAULT_PROVIDERS if item["id"] == "provider-demo-local"), None)
    if provider and not any(item["id"] == provider["id"] for item in PROVIDERS):
        PROVIDERS.insert(0, deepcopy(provider))
    if "provider-demo-local" not in PROVIDER_MODELS:
        PROVIDER_MODELS["provider-demo-local"] = deepcopy(DEFAULT_PROVIDER_MODELS["provider-demo-local"])
    alias = next((item for item in DEFAULT_MODEL_ALIASES if item["id"] == "alias-demo"), None)
    if alias and not any(item["id"] == alias["id"] for item in MODEL_ALIASES):
        MODEL_ALIASES.insert(0, deepcopy(alias))
    target = next((item for item in DEFAULT_ALIAS_TARGETS if item["id"] == "target-demo-local"), None)
    if target and not any(item["id"] == target["id"] for item in ALIAS_TARGETS):
        ALIAS_TARGETS.insert(0, deepcopy(target))
    for key in VIRTUAL_KEYS:
        if key["id"] != "key-2":
            continue
        allowed_providers = key.setdefault("allowed_provider_ids", [])
        if "provider-demo-local" not in allowed_providers:
            allowed_providers.insert(0, "provider-demo-local")
        allowed_aliases = key.setdefault("allowed_model_aliases", [])
        if "indusgate-demo" not in allowed_aliases:
            allowed_aliases.insert(0, "indusgate-demo")


for _full_key, _key_id in list(FULL_KEY_MAP.items()):
    KEY_HASH_MAP[hash_secret(_full_key)] = _key_id


STATE_COLLECTIONS = (
    "USERS",
    "POLICIES",
    "PROJECTS",
    "PROVIDERS",
    "PROVIDER_MODELS",
    "PROVIDER_CREDENTIALS",
    "PROVIDER_HEALTH",
    "PROVIDER_HEALTH_HISTORY",
    "ALERTS",
    "MODEL_ALIASES",
    "ALIAS_TARGETS",
    "ROUTING_POLICIES",
    "RATE_LIMIT_POLICIES",
    "VIRTUAL_KEYS",
    "USAGE_RESERVATIONS",
    "PROJECT_USAGE",
    "GATEWAY_REQUESTS",
    "CACHE_ENTRIES",
    "AUDIT_LOGS",
)


def export_state() -> dict[str, Any]:
    return {
        "users": deepcopy(USERS),
        "policies": deepcopy(POLICIES),
        "projects": deepcopy(PROJECTS),
        "providers": deepcopy(PROVIDERS),
        "provider_models": deepcopy(PROVIDER_MODELS),
        "provider_credentials": deepcopy(PROVIDER_CREDENTIALS),
        "provider_health": deepcopy(PROVIDER_HEALTH),
        "provider_health_history": deepcopy(PROVIDER_HEALTH_HISTORY),
        "alerts": deepcopy(ALERTS),
        "model_aliases": deepcopy(MODEL_ALIASES),
        "alias_targets": deepcopy(ALIAS_TARGETS),
        "routing_policies": deepcopy(ROUTING_POLICIES),
        "rate_limit_policies": deepcopy(RATE_LIMIT_POLICIES),
        "virtual_keys": deepcopy(VIRTUAL_KEYS),
        "usage_reservations": deepcopy(USAGE_RESERVATIONS),
        "project_usage": deepcopy(PROJECT_USAGE),
        "key_hash_map": deepcopy(KEY_HASH_MAP),
        "gateway_requests": deepcopy(GATEWAY_REQUESTS),
        "cache_entries": deepcopy(CACHE_ENTRIES),
        "audit_logs": deepcopy(AUDIT_LOGS),
    }


def load_state(payload: dict[str, Any]) -> None:
    existing_key_hashes = deepcopy(KEY_HASH_MAP)
    USERS[:] = deepcopy(payload.get("users", USERS))
    existing_by_email = {user["email"].lower(): user for user in USERS}
    for default_user in DEFAULT_USERS:
        user = existing_by_email.get(default_user["email"].lower())
        if user is None:
            USERS.append(deepcopy(default_user))
            continue
        user.setdefault("app_role", default_user["app_role"])
        user.setdefault("department_id", default_user.get("department_id"))
        user.setdefault("team_id", default_user.get("team_id"))
        user.setdefault("project_ids", deepcopy(default_user.get("project_ids", [])))
        user["role"] = "admin" if user.get("app_role") in {"platform_admin", "org_admin"} else "member"
    POLICIES[:] = deepcopy(payload.get("policies", POLICIES))
    PROJECTS[:] = deepcopy(payload.get("projects", PROJECTS))
    PROVIDERS[:] = deepcopy(payload.get("providers", PROVIDERS))
    PROVIDER_MODELS.clear()
    PROVIDER_MODELS.update(deepcopy(payload.get("provider_models", PROVIDER_MODELS)))
    PROVIDER_CREDENTIALS.clear()
    PROVIDER_CREDENTIALS.update(deepcopy(payload.get("provider_credentials", PROVIDER_CREDENTIALS)))
    PROVIDER_HEALTH.clear()
    PROVIDER_HEALTH.update(deepcopy(payload.get("provider_health", PROVIDER_HEALTH)))
    for provider in PROVIDERS:
        PROVIDER_HEALTH.setdefault(provider["id"], {
            "provider_id": provider["id"],
            "status": "unknown",
            "circuit_state": "closed",
            "consecutive_successes": 0,
            "consecutive_failures": 0,
            "last_checked_at": None,
            "last_success_at": None,
            "last_failure_at": None,
            "last_latency_ms": None,
            "last_error": None,
            "opened_at": None,
            "half_opened_at": None,
            "updated_at": now(),
        })
    PROVIDER_HEALTH_HISTORY[:] = deepcopy(payload.get("provider_health_history", PROVIDER_HEALTH_HISTORY))
    ALERTS[:] = deepcopy(payload.get("alerts", ALERTS))
    MODEL_ALIASES[:] = deepcopy(payload.get("model_aliases", MODEL_ALIASES))
    ALIAS_TARGETS[:] = deepcopy(payload.get("alias_targets", ALIAS_TARGETS))
    ROUTING_POLICIES[:] = deepcopy(payload.get("routing_policies", ROUTING_POLICIES))
    RATE_LIMIT_POLICIES[:] = deepcopy(payload.get("rate_limit_policies", RATE_LIMIT_POLICIES))
    VIRTUAL_KEYS[:] = deepcopy(payload.get("virtual_keys", VIRTUAL_KEYS))
    USAGE_RESERVATIONS.clear()
    USAGE_RESERVATIONS.update(deepcopy(payload.get("usage_reservations", USAGE_RESERVATIONS)))
    PROJECT_USAGE.clear()
    PROJECT_USAGE.update(deepcopy(payload.get("project_usage", PROJECT_USAGE)))
    KEY_HASH_MAP.clear()
    KEY_HASH_MAP.update(deepcopy(payload.get("key_hash_map", existing_key_hashes)))
    GATEWAY_REQUESTS[:] = deepcopy(payload.get("gateway_requests", GATEWAY_REQUESTS))
    CACHE_ENTRIES[:] = deepcopy(payload.get("cache_entries", CACHE_ENTRIES))
    AUDIT_LOGS[:] = deepcopy(payload.get("audit_logs", AUDIT_LOGS))
    ensure_demo_mode_seed()


def persistence_status() -> dict[str, Any]:
    return {"enabled": _PERSISTENCE_ENABLED, "error": _PERSISTENCE_ERROR}


def enable_database_persistence() -> None:
    global _PERSISTENCE_ENABLED, _PERSISTENCE_ERROR
    try:
        from app.core.config import get_settings
        from app.db.session import configure_database_url, ensure_database_schema, get_database_url, verify_database
        settings = get_settings()
        persistence_warning: str | None = None
        database_ok, database_error = verify_database()
        if not database_ok:
            fallback_url = settings.development_database_url.strip()
            if settings.app_env == "development" and fallback_url:
                configure_database_url(fallback_url)
                database_ok, fallback_error = verify_database()
                if not database_ok:
                    _PERSISTENCE_ENABLED = False
                    _PERSISTENCE_ERROR = f"database unavailable: {database_error}; development fallback unavailable: {fallback_error}"
                    return
                persistence_warning = f"using development database {get_database_url()}; primary database unavailable: {database_error}"
            else:
                _PERSISTENCE_ENABLED = False
                _PERSISTENCE_ERROR = f"database unavailable: {database_error}"
                return
        ensure_database_schema()

        from app.db.session import session_scope
        from app.repositories.state_repository import StateRepository

        with session_scope() as session:
            repository = StateRepository(session)
            if not repository.table_available():
                _PERSISTENCE_ENABLED = False
                _PERSISTENCE_ERROR = "app_state_snapshots table is not available"
                return
            payload = repository.get()
            if payload:
                load_state(payload)
            else:
                repository.save(export_state())
        _PERSISTENCE_ENABLED = True
        _PERSISTENCE_ERROR = persistence_warning
    except Exception as exc:
        _PERSISTENCE_ENABLED = False
        _PERSISTENCE_ERROR = exc.__class__.__name__


def persist_state() -> None:
    global _PERSISTENCE_ERROR
    if not _PERSISTENCE_ENABLED:
        return
    try:
        from app.db.session import session_scope
        from app.repositories.state_repository import StateRepository

        with session_scope() as session:
            StateRepository(session).save(export_state())
        _PERSISTENCE_ERROR = None
    except Exception as exc:
        _PERSISTENCE_ERROR = exc.__class__.__name__
