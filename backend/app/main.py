from __future__ import annotations

import secrets
import uuid
import re
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from app import store
from app.api.openai_routes import router as openai_router
from app.core.config import get_settings
from app.db.session import verify_database
from app.core.errors import invalid_request, openai_error_body, register_openai_error_handlers
from app.services.privacy.detector import DETECTOR_VERSION
from app.services.privacy.masker import PIIMasker
from app.services.privacy.service import PrivacyFirewall
from app.services.cache_service import CacheService
from app.services.provider_health import ProviderHealthService, run_provider_health_monitor
from app.services.routing_service import simulate_route


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.enable_database_persistence()
    health_task = None
    if get_settings().provider_health_checks_enabled:
        health_task = asyncio.create_task(run_provider_health_monitor(get_settings()))
    yield
    if health_task:
        health_task.cancel()
    store.persist_state()


app = FastAPI(title="IndusGate AI", description="Secure Enterprise AI Gateway", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-IndusGate-Gateway-Request-Id", "X-IndusGate-Policy-Action", "X-IndusGate-Cache"],
)
register_openai_error_handlers(app)
app.include_router(openai_router)


@app.middleware("http")
async def enforce_openai_body_size(request: Request, call_next):
    if request.url.path.startswith("/v1/"):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > get_settings().gateway_max_body_bytes:
            error = invalid_request("Request body is too large")
            return JSONResponse(status_code=error.status_code, content=openai_error_body(error))
    return await call_next(request)


def current_user(indusgate_session: str | None = Cookie(default=None)) -> dict[str, Any]:
    if not indusgate_session or indusgate_session not in store.SESSIONS:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return store.SESSIONS[indusgate_session]


def admin_user(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


def audit(actor: dict[str, Any], action: str, resource_type: str, resource_id: str | None, metadata: dict[str, Any] | None = None) -> None:
    store.AUDIT_LOGS.insert(0, {
        "id": str(uuid.uuid4()),
        "actor_type": "user",
        "actor_id": actor["id"],
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata_json": metadata or {},
        "created_at": store.now(),
    })


ALIAS_RE = re.compile(r"^[a-z0-9_-]+$")
APP_ROLES = {"platform_admin", "org_admin", "department_manager", "developer", "auditor", "billing_viewer", "read_only_viewer"}
USER_STATUSES = {"active", "disabled"}


class AliasPayload(BaseModel):
    project_id: str
    alias: str
    display_name: str
    description: str | None = None
    capability: str = Field(pattern="^(chat|embedding)$")
    status: str = Field(default="active", pattern="^(active|disabled)$")
    sovereignty_mode: str = Field(default="protected_external", pattern="^(india_only|protected_external|unrestricted)$")
    fallback_enabled: bool = True

    @field_validator("alias")
    @classmethod
    def validate_alias(cls, value: str) -> str:
        if not ALIAS_RE.match(value):
            raise ValueError("Alias must use lowercase letters, numbers, hyphens or underscores")
        return value


class AliasPatch(BaseModel):
    display_name: str | None = None
    description: str | None = None
    capability: str | None = Field(default=None, pattern="^(chat|embedding)$")
    status: str | None = Field(default=None, pattern="^(active|disabled)$")
    sovereignty_mode: str | None = Field(default=None, pattern="^(india_only|protected_external|unrestricted)$")
    fallback_enabled: bool | None = None


class TargetPayload(BaseModel):
    provider_id: str
    provider_model_name: str
    priority: int = Field(default=1, ge=1)
    enabled: bool = True
    region: str = "in-west-1"
    is_india_hosted: bool = True
    timeout_seconds: int = Field(default=30, ge=1, le=120)
    max_retries: int = Field(default=1, ge=0, le=5)
    fallback_eligible: bool = True


class TargetPatch(BaseModel):
    priority: int | None = Field(default=None, ge=1)
    enabled: bool | None = None
    region: str | None = None
    is_india_hosted: bool | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=120)
    max_retries: int | None = Field(default=None, ge=0, le=5)
    fallback_eligible: bool | None = None


class ReorderPayload(BaseModel):
    target_ids: list[str]


class RoutingConditions(BaseModel):
    requested_aliases: list[str] = []
    capabilities: list[str] = []
    virtual_key_ids: list[str] = []
    project_ids: list[str] = []


class RoutingActions(BaseModel):
    allowed_provider_ids: list[str] = []
    excluded_provider_ids: list[str] = []
    allowed_regions: list[str] = []
    require_india_hosting: bool = False
    external_egress_allowed: bool = True
    fallback_allowed: bool = True
    maximum_timeout_seconds: int | None = Field(default=None, ge=1, le=120)
    maximum_retries: int | None = Field(default=None, ge=0, le=5)


class RoutingPolicyPayload(BaseModel):
    project_id: str | None = None
    name: str
    description: str | None = None
    priority: int = Field(default=10, ge=1)
    enabled: bool = True
    conditions: RoutingConditions = Field(default_factory=RoutingConditions)
    actions: RoutingActions = Field(default_factory=RoutingActions)


class RoutingPolicyPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: int | None = Field(default=None, ge=1)
    enabled: bool | None = None
    conditions: RoutingConditions | None = None
    actions: RoutingActions | None = None


class SimulatePayload(BaseModel):
    virtual_key_id: str
    alias: str
    capability: str = Field(pattern="^(chat|embedding)$")


class PolicyEntityRule(BaseModel):
    action: str = Field(pattern="^(allow|mask_and_allow|block)$")
    minimum_confidence: float = Field(default=0.8, ge=0, le=1)


class PolicyPayload(BaseModel):
    project_id: str | None = None
    name: str
    description: str | None = None
    priority: int = Field(default=10, ge=1)
    enabled: bool = True
    classification: str = Field(default="internal", pattern="^(public|internal|confidential|restricted|regulated)$")
    default_action: str = Field(default="mask_and_allow", pattern="^(allow|mask_and_allow|block)$")
    external_egress_allowed: bool = True
    mask_before_external_egress: bool = True
    allow_restoration: bool = False
    request_retention_mode: str = Field(default="metadata_only", pattern="^(metadata_only|sanitized_content)$")
    response_scan_enabled: bool = True
    entity_rules: dict[str, PolicyEntityRule] = Field(default_factory=dict)

    @field_validator("entity_rules")
    @classmethod
    def validate_entity_rule_keys(cls, value: dict[str, PolicyEntityRule]) -> dict[str, PolicyEntityRule]:
        allowed = {"EMAIL", "INDIAN_MOBILE", "PAN", "AADHAAR", "GSTIN", "CARD", "BANK_ACCOUNT", "IFSC", "UPI", "PASSPORT", "IP_ADDRESS", "API_KEY", "JWT"}
        unknown = sorted(set(value) - allowed)
        if unknown:
            raise ValueError(f"Unsupported entity rule type: {', '.join(unknown)}")
        return value


class PolicyPatch(BaseModel):
    project_id: str | None = None
    name: str | None = None
    description: str | None = None
    priority: int | None = Field(default=None, ge=1)
    enabled: bool | None = None
    classification: str | None = Field(default=None, pattern="^(public|internal|confidential|restricted|regulated)$")
    default_action: str | None = Field(default=None, pattern="^(allow|mask_and_allow|block)$")
    external_egress_allowed: bool | None = None
    mask_before_external_egress: bool | None = None
    allow_restoration: bool | None = None
    request_retention_mode: str | None = Field(default=None, pattern="^(metadata_only|sanitized_content)$")
    response_scan_enabled: bool | None = None
    entity_rules: dict[str, PolicyEntityRule] | None = None


class PolicySimulatePayload(BaseModel):
    project_id: str
    text: str = Field(max_length=100_000)
    policy_id: str | None = None


class RateLimitPayload(BaseModel):
    scope: str = Field(pattern="^(virtual_key|project|model_alias)$")
    scope_id: str
    name: str
    enabled: bool = True
    requests_per_minute: int = Field(ge=1)
    tokens_per_minute: int = Field(ge=1)
    max_concurrent_requests: int = Field(ge=1)


class RateLimitPatch(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    requests_per_minute: int | None = Field(default=None, ge=1)
    tokens_per_minute: int | None = Field(default=None, ge=1)
    max_concurrent_requests: int | None = Field(default=None, ge=1)


class UserPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    app_role: str = Field(pattern="^(platform_admin|org_admin|department_manager|developer|auditor|billing_viewer|read_only_viewer)$")
    status: str = Field(default="active", pattern="^(active|disabled)$")
    department_id: str | None = None
    team_id: str | None = None
    project_ids: list[str] = []

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", normalized):
            raise ValueError("Invalid email address")
        return normalized


class UserPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    app_role: str | None = Field(default=None, pattern="^(platform_admin|org_admin|department_manager|developer|auditor|billing_viewer|read_only_viewer)$")
    status: str | None = Field(default=None, pattern="^(active|disabled)$")
    department_id: str | None = None
    team_id: str | None = None
    project_ids: list[str] | None = None


class ProviderPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    provider_type: str = Field(default="openai_compatible", pattern="^(openai_compatible|external|india_hosted|gemini|demo)$")
    base_url: str = Field(min_length=1, max_length=500)
    is_active: bool = True
    supports_chat: bool = True
    supports_streaming: bool = True
    supports_embeddings: bool = False
    models: list[str] = []
    pricing_json: dict[str, Any] = {}


class ProviderPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    provider_type: str | None = Field(default=None, pattern="^(openai_compatible|external|india_hosted|gemini|demo)$")
    base_url: str | None = Field(default=None, min_length=1, max_length=500)
    is_active: bool | None = None
    supports_chat: bool | None = None
    supports_streaming: bool | None = None
    supports_embeddings: bool | None = None
    pricing_json: dict[str, Any] | None = None


class ProviderCredentialPayload(BaseModel):
    api_key: str = Field(min_length=1, max_length=4000)


class ProviderModelsPayload(BaseModel):
    models: list[str] = []


def _compat_role(app_role: str) -> str:
    return "admin" if app_role in {"platform_admin", "org_admin"} else "member"


def _validate_user_assignment(department_id: str | None, team_id: str | None, project_ids: list[str]) -> None:
    departments = {"dept-idx", "dept-cloudops", "dept-finance", "dept-hr", "dept-infosec"}
    teams = {"team-aiplatform", "team-compliance", "team-cloudsupport"}
    projects = {project["id"] for project in store.PROJECTS}
    if department_id and department_id not in departments:
        raise HTTPException(status_code=422, detail="Unknown department")
    if team_id and team_id not in teams:
        raise HTTPException(status_code=422, detail="Unknown team")
    unknown_projects = sorted(set(project_ids) - projects)
    if unknown_projects:
        raise HTTPException(status_code=422, detail=f"Unknown project IDs: {', '.join(unknown_projects)}")


def _user_by_id(user_id: str) -> dict[str, Any]:
    user = next((item for item in store.USERS if item["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _provider_by_id(provider_id: str) -> dict[str, Any]:
    provider = next((item for item in store.PROVIDERS if item["id"] == provider_id), None)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


def _provider_response(provider: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    env_configured = False
    if provider["id"] == "provider-openai":
        env_configured = bool(settings.openai_api_key)
    elif provider["id"] == "provider-india-hosted":
        env_configured = bool(settings.india_hosted_llm_api_key)
    metadata = store.provider_credential_metadata(provider["id"])
    return {
        **provider,
        **metadata,
        "credential_configured": env_configured or metadata["credential_configured"],
        "credential_source": "environment" if env_configured else ("encrypted_store" if metadata["credential_configured"] else "missing"),
        "models": store.PROVIDER_MODELS.get(provider["id"], []),
        "pricing_json": provider.get("pricing_json", {}),
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, Any]:
    database_ok, database_error = verify_database()
    persistence = store.persistence_status()
    return {
        "status": "ready" if database_ok and persistence["enabled"] else "degraded",
        "database": {"connected": database_ok, "error": database_error},
        "persistence": persistence,
        "privacy": {"enabled": get_settings().pii_protection_enabled, "engine": get_settings().pii_engine, "detector_version": DETECTOR_VERSION, "available": True},
        "streaming_privacy": {"enabled": get_settings().streaming_privacy_enabled, "mode": get_settings().streaming_privacy_mode, "available": True},
    }


@app.post("/api/auth/session")
def login(payload: dict[str, str], response: Response) -> dict[str, Any]:
    user = next((u for u in store.USERS if u["email"].lower() == payload.get("email", "").lower()), None)
    if not user or payload.get("password") != "demo123":
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="User account is disabled")
    session_id = secrets.token_urlsafe(32)
    store.SESSIONS[session_id] = user
    response.set_cookie("indusgate_session", session_id, httponly=True, samesite="lax")
    return {"user": user}


@app.delete("/api/auth/session", status_code=204)
def logout(response: Response, indusgate_session: str | None = Cookie(default=None)) -> None:
    if indusgate_session:
        store.SESSIONS.pop(indusgate_session, None)
    response.delete_cookie("indusgate_session")


@app.get("/api/auth/me")
def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return user


@app.get("/api/users")
def list_users(
    search: str | None = None,
    role: str | None = None,
    status: str | None = None,
    department: str | None = None,
    user: dict[str, Any] = Depends(admin_user),
) -> list[dict[str, Any]]:
    rows = list(store.USERS)
    if search:
        needle = search.lower()
        rows = [item for item in rows if needle in item["name"].lower() or needle in item["email"].lower()]
    if role:
        rows = [item for item in rows if item.get("app_role") == role]
    if status:
        rows = [item for item in rows if item.get("status") == status]
    if department:
        rows = [item for item in rows if item.get("department_id") == department]
    return sorted(rows, key=lambda item: (item.get("app_role", ""), item["name"].lower()))


@app.post("/api/users")
def create_user(payload: UserPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    if any(item["email"].lower() == payload.email for item in store.USERS):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    _validate_user_assignment(payload.department_id, payload.team_id, payload.project_ids)
    created = store.now()
    row = {
        "id": f"user-{uuid.uuid4().hex[:8]}",
        "email": payload.email,
        "name": payload.name.strip(),
        "role": _compat_role(payload.app_role),
        "app_role": payload.app_role,
        "status": payload.status,
        "department_id": payload.department_id,
        "team_id": payload.team_id,
        "project_ids": payload.project_ids,
        "created_at": created,
    }
    store.USERS.append(row)
    audit(user, "user.create", "user", row["id"], {"email": row["email"], "app_role": row["app_role"], "status": row["status"]})
    store.persist_state()
    return row


@app.patch("/api/users/{user_id}")
def update_user(user_id: str, payload: UserPatch, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    row = _user_by_id(user_id)
    patch = payload.model_dump(exclude_unset=True)
    if "project_ids" in patch and patch["project_ids"] is None:
        patch["project_ids"] = []
    _validate_user_assignment(
        patch.get("department_id", row.get("department_id")),
        patch.get("team_id", row.get("team_id")),
        patch.get("project_ids", row.get("project_ids", [])) or [],
    )
    if patch.get("app_role"):
        patch["role"] = _compat_role(patch["app_role"])
    before = {key: row.get(key) for key in patch}
    row.update(patch)
    audit(user, "user.update", "user", user_id, {"fields": sorted(patch), "previous": before})
    store.persist_state()
    return row


@app.post("/api/users/{user_id}/disable")
def disable_user(user_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    row = _user_by_id(user_id)
    if row["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")
    row["status"] = "disabled"
    audit(user, "user.disable", "user", user_id)
    store.persist_state()
    return row


@app.post("/api/users/{user_id}/activate")
def activate_user(user_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    row = _user_by_id(user_id)
    row["status"] = "active"
    audit(user, "user.activate", "user", user_id)
    store.persist_state()
    return row


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: str, user: dict[str, Any] = Depends(admin_user)) -> None:
    row = _user_by_id(user_id)
    if row["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if row.get("status") != "disabled":
        raise HTTPException(status_code=409, detail="Only disabled users can be deleted")
    store.USERS[:] = [item for item in store.USERS if item["id"] != user_id]
    audit(user, "user.delete", "user", user_id, {"email": row["email"]})
    store.persist_state()


@app.get("/api/projects")
def list_projects(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return store.PROJECTS


@app.post("/api/projects")
def create_project(payload: dict[str, Any], user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    project = {
        "id": f"proj-{uuid.uuid4().hex[:8]}",
        "name": payload["name"],
        "description": payload.get("description"),
        "owner_user_id": user["id"],
        "policy_id": payload["policy_id"],
        "status": "active",
        "monthly_budget_inr": payload.get("monthly_budget_inr"),
        "created_at": store.now(),
    }
    store.PROJECTS.insert(0, project)
    store.persist_state()
    return project


@app.patch("/api/projects/{project_id}")
def update_project(project_id: str, payload: dict[str, Any], user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    project = next((p for p in store.PROJECTS if p["id"] == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key in ("name", "description", "monthly_budget_inr"):
        if key in payload:
            project[key] = payload[key]
    store.persist_state()
    return project


@app.get("/api/policies")
def list_policies(project: str | None = None, enabled: bool | None = None, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    policies = list(store.POLICIES)
    if project:
        policies = [item for item in policies if item.get("project_id") == project]
    if enabled is not None:
        policies = [item for item in policies if bool(item.get("enabled", True)) == enabled]
    return sorted(policies, key=lambda item: (int(item.get("priority", 100)), item["id"]))


@app.post("/api/policies")
def create_policy(payload: PolicyPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    if payload.project_id and not any(project["id"] == payload.project_id for project in store.PROJECTS):
        raise HTTPException(status_code=404, detail="Project not found")
    created = store.now()
    policy = {
        "id": f"policy-{uuid.uuid4().hex[:8]}",
        "project_id": payload.project_id,
        "name": payload.name,
        "description": payload.description,
        "priority": payload.priority,
        "enabled": payload.enabled,
        "classification": payload.classification,
        "default_action": payload.default_action,
        "allow_external": payload.external_egress_allowed,
        "external_egress_allowed": payload.external_egress_allowed,
        "mask_before_egress": payload.mask_before_external_egress,
        "mask_before_external_egress": payload.mask_before_external_egress,
        "block_regulated_fields": payload.default_action == "block",
        "allow_restoration": payload.allow_restoration,
        "request_retention_mode": payload.request_retention_mode,
        "response_scan_enabled": payload.response_scan_enabled,
        "entity_rules": {key: rule.model_dump() for key, rule in payload.entity_rules.items()},
        "created_by": user["id"],
        "created_at": created,
        "updated_at": created,
    }
    store.POLICIES.insert(0, policy)
    audit(user, "privacy_policy.create", "policy", policy["id"], {"project_id": policy.get("project_id"), "action": policy["default_action"]})
    store.persist_state()
    return policy


@app.post("/api/policies/simulate")
def simulate_policy(payload: PolicySimulatePayload, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if not any(project["id"] == payload.project_id for project in store.PROJECTS):
        raise HTTPException(status_code=404, detail="Project not found")
    if len(payload.text) > get_settings().pii_max_text_characters:
        raise HTTPException(status_code=413, detail="Sample text exceeds the privacy scanning limit")
    original_policy_id: str | None = None
    if payload.policy_id:
        policy = next((item for item in store.POLICIES if item["id"] == payload.policy_id), None)
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        project = next(item for item in store.PROJECTS if item["id"] == payload.project_id)
        original_policy_id = project.get("policy_id")
        project["policy_id"] = payload.policy_id
    try:
        firewall = PrivacyFirewall()
        findings = firewall.detector.detect(payload.text)
        decision = firewall.evaluator.evaluate(payload.project_id, findings)
        masker = PIIMasker()
        maskable = [finding for finding in findings if decision.action == "mask_and_allow"]
        masked = masker.mask(payload.text, maskable)
        return {
            "decision": decision.action,
            "entities": [
                {
                    "type": finding.entity_type,
                    "confidence": finding.confidence,
                    "action": decision.action,
                    "placeholder": masker.placeholder_for(finding) if decision.action == "mask_and_allow" else None,
                }
                for finding in findings
            ],
            "masked_preview": masked.text,
            "external_egress_allowed": decision.external_egress_allowed,
            "policy_ids": decision.policy_ids,
        }
    finally:
        if original_policy_id is not None:
            project = next(item for item in store.PROJECTS if item["id"] == payload.project_id)
            project["policy_id"] = original_policy_id


def _policy_by_id(policy_id: str) -> dict[str, Any]:
    policy = next((item for item in store.POLICIES if item["id"] == policy_id), None)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@app.get("/api/policies/{policy_id}")
def get_policy(policy_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return _policy_by_id(policy_id)


@app.patch("/api/policies/{policy_id}")
def update_policy(policy_id: str, payload: PolicyPatch, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = _policy_by_id(policy_id)
    patch = payload.model_dump(exclude_unset=True)
    if "entity_rules" in patch and patch["entity_rules"] is not None:
        patch["entity_rules"] = {key: rule.model_dump() if hasattr(rule, "model_dump") else rule for key, rule in payload.entity_rules.items()} if payload.entity_rules is not None else {}
    if "external_egress_allowed" in patch:
        patch["allow_external"] = patch["external_egress_allowed"]
    if "mask_before_external_egress" in patch:
        patch["mask_before_egress"] = patch["mask_before_external_egress"]
    policy.update(patch)
    policy["updated_at"] = store.now()
    audit(user, "privacy_policy.update", "policy", policy_id, {"fields": sorted(patch)})
    store.persist_state()
    return policy


@app.delete("/api/policies/{policy_id}")
def delete_policy(policy_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = _policy_by_id(policy_id)
    policy["enabled"] = False
    policy["updated_at"] = store.now()
    audit(user, "privacy_policy.disable", "policy", policy_id, {"reason": "delete requested; policy disabled non-destructively"})
    store.persist_state()
    return policy


@app.post("/api/policies/{policy_id}/enable")
def enable_policy(policy_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = _policy_by_id(policy_id)
    policy["enabled"] = True
    policy["updated_at"] = store.now()
    audit(user, "privacy_policy.enable", "policy", policy_id)
    store.persist_state()
    return policy


@app.post("/api/policies/{policy_id}/disable")
def disable_policy(policy_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = _policy_by_id(policy_id)
    policy["enabled"] = False
    policy["updated_at"] = store.now()
    audit(user, "privacy_policy.disable", "policy", policy_id)
    store.persist_state()
    return policy


@app.get("/api/providers")
def list_providers(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return [_provider_response(provider) for provider in store.PROVIDERS]


@app.post("/api/providers")
def create_provider(payload: ProviderPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    created = store.now()
    provider = {
        "id": f"provider-{uuid.uuid4().hex[:8]}",
        "name": payload.name.strip(),
        "provider_type": payload.provider_type,
        "base_url": payload.base_url.strip().rstrip("/"),
        "is_active": payload.is_active,
        "supports_chat": payload.supports_chat,
        "supports_streaming": payload.supports_streaming,
        "supports_embeddings": payload.supports_embeddings,
        "pricing_json": payload.pricing_json,
        "created_at": created,
    }
    store.PROVIDERS.append(provider)
    store.PROVIDER_MODELS[provider["id"]] = sorted({model.strip() for model in payload.models if model.strip()})
    store.PROVIDER_HEALTH[provider["id"]] = {
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
        "updated_at": store.now(),
    }
    audit(user, "provider.create", "provider", provider["id"], {"name": provider["name"], "provider_type": provider["provider_type"]})
    store.persist_state()
    return _provider_response(provider)


@app.get("/api/providers/{provider_id}")
def get_provider(provider_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return _provider_response(_provider_by_id(provider_id))


@app.patch("/api/providers/{provider_id}")
def update_provider(provider_id: str, payload: ProviderPatch, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    provider = _provider_by_id(provider_id)
    patch = payload.model_dump(exclude_unset=True)
    if "base_url" in patch and patch["base_url"]:
        patch["base_url"] = patch["base_url"].strip().rstrip("/")
    if "name" in patch and patch["name"]:
        patch["name"] = patch["name"].strip()
    provider.update(patch)
    audit(user, "provider.update", "provider", provider_id, {"fields": sorted(patch)})
    store.persist_state()
    return _provider_response(provider)


@app.delete("/api/providers/{provider_id}")
def disable_provider(provider_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    provider = _provider_by_id(provider_id)
    provider["is_active"] = False
    audit(user, "provider.disable", "provider", provider_id, {"reason": "delete requested; provider disabled non-destructively"})
    store.persist_state()
    return _provider_response(provider)


@app.get("/api/providers/{provider_id}/models")
def provider_models(provider_id: str, user: dict[str, Any] = Depends(current_user)) -> list[str]:
    _provider_by_id(provider_id)
    return store.PROVIDER_MODELS.get(provider_id, [])


@app.put("/api/providers/{provider_id}/models")
def update_provider_models(provider_id: str, payload: ProviderModelsPayload, user: dict[str, Any] = Depends(admin_user)) -> list[str]:
    _provider_by_id(provider_id)
    models = sorted({model.strip() for model in payload.models if model.strip()})
    store.PROVIDER_MODELS[provider_id] = models
    audit(user, "provider.models.update", "provider", provider_id, {"count": len(models)})
    store.persist_state()
    return models


@app.post("/api/providers/{provider_id}/credential")
def set_provider_credential(provider_id: str, payload: ProviderCredentialPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    provider = _provider_by_id(provider_id)
    store.set_provider_api_key(provider_id, payload.api_key)
    audit(user, "provider.credential.update", "provider", provider_id, {"credential_configured": True})
    store.persist_state()
    return _provider_response(provider)


@app.delete("/api/providers/{provider_id}/credential")
def clear_provider_credential(provider_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    provider = _provider_by_id(provider_id)
    store.clear_provider_api_key(provider_id)
    audit(user, "provider.credential.clear", "provider", provider_id)
    store.persist_state()
    return _provider_response(provider)


@app.post("/api/providers/{provider_id}/test")
async def test_provider_connection(provider_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    try:
        result = await ProviderHealthService().check_provider(provider_id, force=True)
    except KeyError:
        raise HTTPException(status_code=404, detail="Provider not found")
    audit(user, "provider.test", "provider", provider_id, {"status": result["status"], "circuit_state": result["circuit_state"], "last_error": result.get("last_error")})
    return result


@app.get("/api/cache/entries")
def list_cache_entries(
    project: str | None = None,
    include_inactive: bool = False,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    service = CacheService()
    return {
        "entries": service.list_entries(project_id=project, include_inactive=include_inactive),
        "summary": service.stats(project_id=project),
    }


@app.delete("/api/cache/entries/{cache_id}")
def invalidate_cache_entry(cache_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    service = CacheService()
    entry = service.invalidate(cache_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Cache entry not found")
    audit(user, "cache.invalidate", "cache_entry", cache_id)
    store.persist_state()
    return entry


@app.delete("/api/cache")
def clear_cache(project: str | None = None, user: dict[str, Any] = Depends(admin_user)) -> dict[str, int]:
    service = CacheService()
    count = service.clear(project_id=project)
    audit(user, "cache.clear", "cache", project, {"project_id": project, "count": count})
    store.persist_state()
    return {"invalidated": count}


@app.get("/api/provider-health")
def list_provider_health(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return ProviderHealthService().list_health()


@app.get("/api/provider-health/history")
def list_provider_health_history(limit: int = 200, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return ProviderHealthService().list_history(limit)


@app.post("/api/provider-health/{provider_id}/check")
async def check_provider_health(provider_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    try:
        result = await ProviderHealthService().check_provider(provider_id, force=True)
    except KeyError:
        raise HTTPException(status_code=404, detail="Provider not found") from None
    audit(user, "provider_health.check", "provider", provider_id, {"status": result["status"], "circuit_state": result["circuit_state"]})
    return result


@app.post("/api/provider-health/{provider_id}/reset")
async def reset_provider_circuit(provider_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    try:
        result = await ProviderHealthService().reset_circuit(provider_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Provider not found") from None
    audit(user, "provider_health.reset", "provider", provider_id)
    return result


@app.get("/api/alerts")
def list_alerts(limit: int = 200, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return ProviderHealthService().list_alerts(limit)


@app.post("/api/alerts/{alert_id}/read")
def mark_alert_read(alert_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    alert = next((item for item in store.ALERTS if item["id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["read"] = True
    store.persist_state()
    return alert


@app.post("/api/alerts/read-all")
def mark_all_alerts_read(user: dict[str, Any] = Depends(current_user)) -> dict[str, int]:
    count = 0
    for alert in store.ALERTS:
        if not alert.get("read"):
            alert["read"] = True
            count += 1
    store.persist_state()
    return {"updated": count}


def _alias_by_id(alias_id: str) -> dict[str, Any]:
    alias = next((item for item in store.MODEL_ALIASES if item["id"] == alias_id), None)
    if not alias:
        raise HTTPException(status_code=404, detail="Model alias not found")
    return alias


def _target_by_id(alias_id: str, target_id: str) -> dict[str, Any]:
    target = next((item for item in store.ALIAS_TARGETS if item["id"] == target_id and item["model_alias_id"] == alias_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Alias target not found")
    return target


@app.get("/api/model-aliases")
def list_model_aliases(
    project: str | None = None,
    capability: str | None = None,
    status: str | None = None,
    sovereignty_mode: str | None = None,
    search: str | None = None,
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    aliases = list(store.MODEL_ALIASES)
    if project:
        aliases = [item for item in aliases if item["project_id"] == project]
    if capability:
        aliases = [item for item in aliases if item["capability"] == capability]
    if status:
        aliases = [item for item in aliases if item["status"] == status]
    if sovereignty_mode:
        aliases = [item for item in aliases if item["sovereignty_mode"] == sovereignty_mode]
    if search:
        needle = search.lower()
        aliases = [item for item in aliases if needle in item["alias"].lower() or needle in item["display_name"].lower()]
    return [{**item, "target_count": len([target for target in store.ALIAS_TARGETS if target["model_alias_id"] == item["id"]])} for item in aliases]


@app.post("/api/model-aliases")
def create_model_alias(payload: AliasPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    if not any(project["id"] == payload.project_id for project in store.PROJECTS):
        raise HTTPException(status_code=404, detail="Project not found")
    if any(item["project_id"] == payload.project_id and item["alias"] == payload.alias for item in store.MODEL_ALIASES):
        raise HTTPException(status_code=409, detail="Alias already exists for this project")
    created = store.now()
    alias = {
        "id": f"alias-{uuid.uuid4().hex[:8]}",
        "project_id": payload.project_id,
        "alias": payload.alias,
        "display_name": payload.display_name,
        "description": payload.description,
        "capability": payload.capability,
        "status": payload.status,
        "sovereignty_mode": payload.sovereignty_mode,
        "fallback_enabled": payload.fallback_enabled,
        "created_by": user["id"],
        "created_at": created,
        "updated_at": created,
        "owned_by": "indusgate",
        "created": 1720000000,
    }
    store.MODEL_ALIASES.insert(0, alias)
    audit(user, "model_alias.create", "model_alias", alias["id"], {"alias": alias["alias"]})
    store.persist_state()
    return alias


@app.get("/api/model-aliases/{alias_id}")
def get_model_alias(alias_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    alias = _alias_by_id(alias_id)
    return {**alias, "targets": [target for target in store.ALIAS_TARGETS if target["model_alias_id"] == alias_id]}


@app.patch("/api/model-aliases/{alias_id}")
def update_model_alias(alias_id: str, payload: AliasPatch, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    alias = _alias_by_id(alias_id)
    patch = payload.model_dump(exclude_unset=True)
    alias.update(patch)
    alias["updated_at"] = store.now()
    audit(user, "model_alias.update", "model_alias", alias_id, patch)
    store.persist_state()
    return alias


@app.delete("/api/model-aliases/{alias_id}")
def delete_model_alias(alias_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    alias = _alias_by_id(alias_id)
    alias["status"] = "disabled"
    alias["updated_at"] = store.now()
    audit(user, "model_alias.disable", "model_alias", alias_id, {"reason": "delete requested; alias disabled non-destructively"})
    store.persist_state()
    return alias


@app.post("/api/model-aliases/{alias_id}/enable")
def enable_model_alias(alias_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    alias = _alias_by_id(alias_id)
    alias["status"] = "active"
    alias["updated_at"] = store.now()
    audit(user, "model_alias.enable", "model_alias", alias_id)
    store.persist_state()
    return alias


@app.post("/api/model-aliases/{alias_id}/disable")
def disable_model_alias(alias_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    alias = _alias_by_id(alias_id)
    alias["status"] = "disabled"
    alias["updated_at"] = store.now()
    audit(user, "model_alias.disable", "model_alias", alias_id)
    store.persist_state()
    return alias


@app.get("/api/model-aliases/{alias_id}/targets")
def list_alias_targets(alias_id: str, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    _alias_by_id(alias_id)
    return sorted([target for target in store.ALIAS_TARGETS if target["model_alias_id"] == alias_id], key=lambda item: (item["priority"], item["id"]))


@app.post("/api/model-aliases/{alias_id}/targets")
def create_alias_target(alias_id: str, payload: TargetPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    alias = _alias_by_id(alias_id)
    provider = next((item for item in store.PROVIDERS if item["id"] == payload.provider_id), None)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    if alias["capability"] == "chat" and not provider.get("supports_chat"):
        raise HTTPException(status_code=400, detail="Provider does not support chat")
    if alias["capability"] == "embedding" and not provider.get("supports_embeddings"):
        raise HTTPException(status_code=400, detail="Provider does not support embeddings")
    if any(target["model_alias_id"] == alias_id and target["provider_id"] == payload.provider_id and target["provider_model_name"] == payload.provider_model_name and target.get("enabled", True) for target in store.ALIAS_TARGETS):
        raise HTTPException(status_code=409, detail="Active provider/model target already exists for this alias")
    created = store.now()
    target = {"id": f"target-{uuid.uuid4().hex[:8]}", "model_alias_id": alias_id, **payload.model_dump(), "created_at": created, "updated_at": created}
    store.ALIAS_TARGETS.append(target)
    audit(user, "model_alias_target.create", "model_alias_target", target["id"], {"alias_id": alias_id})
    store.persist_state()
    return target


@app.patch("/api/model-aliases/{alias_id}/targets/{target_id}")
def update_alias_target(alias_id: str, target_id: str, payload: TargetPatch, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    target = _target_by_id(alias_id, target_id)
    patch = payload.model_dump(exclude_unset=True)
    target.update(patch)
    target["updated_at"] = store.now()
    audit(user, "model_alias_target.update", "model_alias_target", target_id, patch)
    store.persist_state()
    return target


@app.delete("/api/model-aliases/{alias_id}/targets/{target_id}")
def delete_alias_target(alias_id: str, target_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    target = _target_by_id(alias_id, target_id)
    target["enabled"] = False
    target["updated_at"] = store.now()
    audit(user, "model_alias_target.disable", "model_alias_target", target_id)
    store.persist_state()
    return target


@app.post("/api/model-aliases/{alias_id}/targets/reorder")
def reorder_alias_targets(alias_id: str, payload: ReorderPayload, user: dict[str, Any] = Depends(admin_user)) -> list[dict[str, Any]]:
    _alias_by_id(alias_id)
    targets = [target for target in store.ALIAS_TARGETS if target["model_alias_id"] == alias_id]
    target_map = {target["id"]: target for target in targets}
    if set(payload.target_ids) != set(target_map):
        raise HTTPException(status_code=400, detail="Target IDs must match all targets for this alias")
    for index, target_id in enumerate(payload.target_ids, start=1):
        target_map[target_id]["priority"] = index
        target_map[target_id]["updated_at"] = store.now()
    audit(user, "model_alias_target.reorder", "model_alias", alias_id, {"target_ids": payload.target_ids})
    store.persist_state()
    return sorted(targets, key=lambda item: (item["priority"], item["id"]))


@app.get("/api/routing-policies")
def list_routing_policies(project: str | None = None, enabled: bool | None = None, search: str | None = None, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    policies = list(store.ROUTING_POLICIES)
    if project:
        policies = [item for item in policies if item.get("project_id") == project]
    if enabled is not None:
        policies = [item for item in policies if bool(item.get("enabled")) == enabled]
    if search:
        needle = search.lower()
        policies = [item for item in policies if needle in item["name"].lower() or needle in str(item.get("description", "")).lower()]
    return sorted(policies, key=lambda item: (item["priority"], item["id"]))


@app.post("/api/routing-policies")
def create_routing_policy(payload: RoutingPolicyPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    created = store.now()
    policy = {
        "id": f"route-{uuid.uuid4().hex[:8]}",
        "project_id": payload.project_id,
        "name": payload.name,
        "description": payload.description,
        "priority": payload.priority,
        "enabled": payload.enabled,
        "conditions_json": payload.conditions.model_dump(),
        "actions_json": payload.actions.model_dump(exclude_none=True),
        "created_by": user["id"],
        "created_at": created,
        "updated_at": created,
    }
    store.ROUTING_POLICIES.append(policy)
    audit(user, "routing_policy.create", "routing_policy", policy["id"])
    store.persist_state()
    return policy


@app.get("/api/routing-policies/{policy_id}")
def get_routing_policy(policy_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    policy = next((item for item in store.ROUTING_POLICIES if item["id"] == policy_id), None)
    if not policy:
        raise HTTPException(status_code=404, detail="Routing policy not found")
    return policy


@app.patch("/api/routing-policies/{policy_id}")
def update_routing_policy(policy_id: str, payload: RoutingPolicyPatch, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = get_routing_policy(policy_id, user)
    patch = payload.model_dump(exclude_unset=True)
    if payload.conditions is not None:
        patch["conditions_json"] = payload.conditions.model_dump()
        patch.pop("conditions", None)
    if payload.actions is not None:
        patch["actions_json"] = payload.actions.model_dump(exclude_none=True)
        patch.pop("actions", None)
    policy.update(patch)
    policy["updated_at"] = store.now()
    audit(user, "routing_policy.update", "routing_policy", policy_id, patch)
    store.persist_state()
    return policy


@app.delete("/api/routing-policies/{policy_id}")
def delete_routing_policy(policy_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = get_routing_policy(policy_id, user)
    policy["enabled"] = False
    policy["updated_at"] = store.now()
    audit(user, "routing_policy.disable", "routing_policy", policy_id, {"reason": "delete requested; policy disabled non-destructively"})
    store.persist_state()
    return policy


@app.post("/api/routing-policies/{policy_id}/enable")
def enable_routing_policy(policy_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = get_routing_policy(policy_id, user)
    policy["enabled"] = True
    policy["updated_at"] = store.now()
    audit(user, "routing_policy.enable", "routing_policy", policy_id)
    store.persist_state()
    return policy


@app.post("/api/routing-policies/{policy_id}/disable")
def disable_routing_policy(policy_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    policy = get_routing_policy(policy_id, user)
    policy["enabled"] = False
    policy["updated_at"] = store.now()
    audit(user, "routing_policy.disable", "routing_policy", policy_id)
    store.persist_state()
    return policy


@app.post("/api/routing-policies/simulate")
def simulate_routing_policy(payload: SimulatePayload, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    key = next((item for item in store.VIRTUAL_KEYS if item["id"] == payload.virtual_key_id), None)
    if not key:
        raise HTTPException(status_code=404, detail="Virtual key not found")
    return simulate_route(payload.alias, payload.capability, key)


@app.get("/api/virtual-keys")
def list_virtual_keys(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return store.VIRTUAL_KEYS


@app.get("/api/rate-limits")
def list_rate_limits(scope: str | None = None, user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    rows = list(store.RATE_LIMIT_POLICIES)
    if scope:
        rows = [row for row in rows if row["scope"] == scope]
    return sorted(rows, key=lambda item: (item["scope"], item["scope_id"], item["id"]))


@app.post("/api/rate-limits")
def create_rate_limit(payload: RateLimitPayload, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    created = store.now()
    row = {"id": f"rl-{uuid.uuid4().hex[:8]}", **payload.model_dump(), "created_at": created, "updated_at": created}
    store.RATE_LIMIT_POLICIES.insert(0, row)
    audit(user, "rate_limit.create", "rate_limit", row["id"], {"scope": row["scope"], "scope_id": row["scope_id"]})
    store.persist_state()
    return row


@app.patch("/api/rate-limits/{rate_limit_id}")
def update_rate_limit(rate_limit_id: str, payload: RateLimitPatch, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    row = next((item for item in store.RATE_LIMIT_POLICIES if item["id"] == rate_limit_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Rate limit not found")
    patch = payload.model_dump(exclude_unset=True)
    row.update(patch)
    row["updated_at"] = store.now()
    audit(user, "rate_limit.update", "rate_limit", rate_limit_id, {"fields": sorted(patch)})
    store.persist_state()
    return row


@app.post("/api/rate-limits/{rate_limit_id}/enable")
def enable_rate_limit(rate_limit_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    return update_rate_limit(rate_limit_id, RateLimitPatch(enabled=True), user)


@app.post("/api/rate-limits/{rate_limit_id}/disable")
def disable_rate_limit(rate_limit_id: str, user: dict[str, Any] = Depends(admin_user)) -> dict[str, Any]:
    return update_rate_limit(rate_limit_id, RateLimitPatch(enabled=False), user)


@app.post("/api/virtual-keys")
def create_virtual_key(payload: dict[str, Any], user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    suffix = uuid.uuid4().hex[:6]
    full_key = f"ig_sk_live_{uuid.uuid4().hex}"
    key = {
        "id": f"key-{suffix}",
        "key_prefix": f"ig_sk_live_{suffix}",
        "project_id": payload["project_id"],
        "created_by_user_id": user["id"],
        "status": "active",
        "expires_at": payload.get("expires_at"),
        "allowed_provider_ids": payload.get("allowed_provider_ids", []),
        "allowed_model_aliases": payload.get("allowed_model_aliases", []),
        "created_at": store.now(),
    }
    store.VIRTUAL_KEYS.insert(0, key)
    store.register_full_key(full_key, key["id"])
    store.persist_state()
    return {"virtual_key": key, "full_key": full_key}


@app.post("/api/virtual-keys/{key_id}/rotate")
def rotate_virtual_key(key_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    key = next((k for k in store.VIRTUAL_KEYS if k["id"] == key_id), None)
    if not key:
        raise HTTPException(status_code=404, detail="Virtual key not found")
    full_key = f"ig_sk_live_{uuid.uuid4().hex}"
    key["key_prefix"] = full_key[:18]
    store.register_full_key(full_key, key_id)
    store.persist_state()
    return {"virtual_key": key, "full_key": full_key}


@app.post("/api/virtual-keys/{key_id}/revoke")
def revoke_virtual_key(key_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    key = next((k for k in store.VIRTUAL_KEYS if k["id"] == key_id), None)
    if not key:
        raise HTTPException(status_code=404, detail="Virtual key not found")
    key["status"] = "revoked"
    store.persist_state()
    return key


@app.get("/api/gateway-requests")
def list_gateway_requests(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return store.GATEWAY_REQUESTS


@app.get("/api/gateway-requests/{request_id}")
def get_gateway_request(request_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    request = next((r for r in store.GATEWAY_REQUESTS if r["id"] == request_id), None)
    if not request:
        raise HTTPException(status_code=404, detail="Gateway request not found")
    return request


@app.get("/api/audit-logs")
def list_audit_logs(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Audit logs require admin access")
    return store.AUDIT_LOGS


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@app.get("/api/dashboard/summary")
def dashboard_summary(days: int = 30, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    days = max(1, min(days, 90))
    today = datetime.now(timezone.utc).date()
    first_day = today - timedelta(days=days - 1)
    trace_rows = [
        row for row in store.GATEWAY_REQUESTS
        if (_parse_date(row.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)).date() >= first_day
    ]
    completed = [row for row in trace_rows if row.get("request_status") == "completed"]
    total_requests = len(trace_rows)
    total_tokens = sum(int(row.get("total_tokens") or 0) for row in trace_rows)
    total_spend = round(sum(float(row.get("estimated_cost_reserved_inr") or row.get("estimated_cost_inr") or 0) for row in trace_rows), 6)
    external = sum(1 for row in trace_rows if row.get("external_egress_allowed") and row.get("selected_provider_id") == "provider-openai")
    sovereign = sum(1 for row in trace_rows if row.get("selected_provider_id") == "provider-india-hosted" or row.get("sovereignty_mode") == "india_only")
    provider_health = ProviderHealthService().list_health()
    health_rows = [row for row in provider_health if row.get("status") == "healthy"]
    open_incidents = sum(1 for row in provider_health if row.get("status") == "unhealthy" or row.get("circuit_state") == "open")
    active_keys = sum(1 for key in store.VIRTUAL_KEYS if key.get("status") == "active")
    pii_masked = sum(int(row.get("masked_entity_count") or row.get("masked_fields_count") or 0) for row in trace_rows)
    latency_values = [float(row.get("latency_ms") or 0) for row in completed if row.get("latency_ms") is not None]
    avg_latency_ms = round(sum(latency_values) / len(latency_values), 2) if latency_values else 0
    error_rate = (sum(1 for row in trace_rows if row.get("request_status") != "completed") / total_requests) if total_requests else 0
    sovereign_rate = (sovereign / max(1, sovereign + external)) if total_requests else 0
    cache_hits = sum(1 for row in trace_rows if row.get("cache_status") == "hit")
    cache_misses = sum(1 for row in trace_rows if row.get("cache_status") == "miss")
    cache_stats = CacheService().stats()

    trend = []
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        rows = [row for row in trace_rows if (_parse_date(row.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)).date() == day]
        trend.append({
            "date": day.isoformat(),
            "requests": len(rows),
            "tokens": sum(int(row.get("total_tokens") or 0) for row in rows),
            "spend_inr": round(sum(float(row.get("estimated_cost_reserved_inr") or row.get("estimated_cost_inr") or 0) for row in rows), 6),
        })

    provider_names = {provider["id"]: provider["name"] for provider in store.PROVIDERS}
    spend_by_provider: dict[str, float] = {}
    usage_by_model: dict[str, int] = {}
    for row in trace_rows:
        provider_name = provider_names.get(row.get("selected_provider_id") or row.get("provider_id") or "", "Unrouted")
        spend_by_provider[provider_name] = spend_by_provider.get(provider_name, 0) + float(row.get("estimated_cost_reserved_inr") or row.get("estimated_cost_inr") or 0)
        model_name = row.get("model_requested") or row.get("requested_public_alias") or "unknown"
        usage_by_model[model_name] = usage_by_model.get(model_name, 0) + 1

    usage_summary = [
        {
            "project_id": p["id"],
            "project_name": p["name"],
            "monthly_budget_inr": p["monthly_budget_inr"],
            "spend_this_month_inr": store.PROJECT_USAGE.get(p["id"], {}).get("spend_this_month_inr", 0),
            "total_tokens_this_month": store.PROJECT_USAGE.get(p["id"], {}).get("total_tokens_this_month", 0),
            "request_count_this_month": store.PROJECT_USAGE.get(p["id"], {}).get("request_count_this_month", 0),
        }
        for p in store.PROJECTS
    ]

    return {
        "window_days": days,
        "kpis": {
            "total_requests": total_requests,
            "total_tokens": total_tokens,
            "estimated_spend_inr": total_spend,
            "avg_latency_ms": avg_latency_ms,
            "error_rate": error_rate,
            "sovereign_rate": sovereign_rate,
            "pii_values_masked": pii_masked,
            "active_virtual_keys": active_keys,
            "total_virtual_keys": len(store.VIRTUAL_KEYS),
            "open_provider_incidents": open_incidents,
            "healthy_providers": len(health_rows),
            "total_providers": len(provider_health),
            "cache_hits": cache_hits,
            "cache_misses": cache_misses,
            "cache_hit_rate": cache_hits / (cache_hits + cache_misses) if cache_hits + cache_misses else 0,
            "active_cache_entries": cache_stats["active_entries"],
            "cache_tokens_saved": cache_stats["tokens_saved"],
            "cache_cost_saved_inr": cache_stats["cost_saved_inr"],
        },
        "usage_summary": usage_summary,
        "trend": trend,
        "sovereign_vs_external": [
            {"name": "Sovereign / India-hosted", "value": sovereign},
            {"name": "External", "value": external},
        ],
        "spend_by_provider": [{"name": key, "value": round(value, 6)} for key, value in spend_by_provider.items()],
        "usage_by_model": [{"name": key, "value": value} for key, value in sorted(usage_by_model.items(), key=lambda item: item[1], reverse=True)],
        "recent_alerts": store.ALERTS[:5],
        "recent_activity": store.AUDIT_LOGS[:6],
    }


@app.get("/api/usage/summary")
def usage_summary(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    return [
        {
            "project_id": p["id"],
            "project_name": p["name"],
            "monthly_budget_inr": p["monthly_budget_inr"],
            "spend_this_month_inr": store.PROJECT_USAGE.get(p["id"], {}).get("spend_this_month_inr", 0),
            "total_tokens_this_month": store.PROJECT_USAGE.get(p["id"], {}).get("total_tokens_this_month", 0),
            "request_count_this_month": store.PROJECT_USAGE.get(p["id"], {}).get("request_count_this_month", 0),
            "budget_status": "unlimited" if p["monthly_budget_inr"] is None else ("exceeded" if store.PROJECT_USAGE.get(p["id"], {}).get("spend_this_month_inr", 0) >= p["monthly_budget_inr"] else ("warning" if store.PROJECT_USAGE.get(p["id"], {}).get("spend_this_month_inr", 0) >= p["monthly_budget_inr"] * 0.8 else "ok")),
        }
        for p in store.PROJECTS
    ]
