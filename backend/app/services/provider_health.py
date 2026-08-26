from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any

import httpx

from app import store
from app.core.config import Settings, get_settings


FAILURE_CODES = {"provider_timeout", "provider_unavailable", "provider_authentication_error", "provider_not_configured"}


class ProviderHealthService:
    _locks: dict[str, asyncio.Lock] = {}

    def __init__(self, settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.settings = settings or get_settings()
        self.transport = transport

    def list_health(self) -> list[dict[str, Any]]:
        return [self._with_provider(row) for row in store.PROVIDER_HEALTH.values()]

    def list_history(self, limit: int = 200) -> list[dict[str, Any]]:
        return store.PROVIDER_HEALTH_HISTORY[:limit]

    def list_alerts(self, limit: int = 200) -> list[dict[str, Any]]:
        return store.ALERTS[:limit]

    async def check_provider(self, provider_id: str, *, force: bool = False) -> dict[str, Any]:
        provider = self._provider(provider_id)
        lock = self._lock(provider_id)
        async with lock:
            state = self._state(provider_id)
            if provider.get("provider_type") == "demo":
                self._record_success_locked(provider, state, "local_demo", 0)
                store.persist_state()
                return self._with_provider(state)
            if state["circuit_state"] == "open" and not force and not self._cooldown_elapsed(state):
                return self._with_provider(state)
            if state["circuit_state"] == "open":
                state["circuit_state"] = "half_open"
                state["half_opened_at"] = store.now()
            started = time.perf_counter()
            ok = False
            error: str | None = None
            try:
                async with self._client(provider) as client:
                    response = await client.get("/models")
                ok = 200 <= response.status_code < 400
                if not ok:
                    error = f"models_status_{response.status_code}"
            except httpx.TimeoutException:
                error = "provider_timeout"
            except httpx.HTTPError:
                error = "provider_unavailable"
            latency_ms = int((time.perf_counter() - started) * 1000)
            if ok:
                self._record_success_locked(provider, state, "models", latency_ms)
            else:
                self._record_failure_locked(provider, state, error or "provider_unavailable", "models", latency_ms)
            store.persist_state()
            return self._with_provider(state)

    async def record_success(self, provider_id: str, *, source: str = "request") -> None:
        provider = self._provider(provider_id)
        async with self._lock(provider_id):
            self._record_success_locked(provider, self._state(provider_id), source, None)
            store.persist_state()

    async def record_failure(self, provider_id: str, error_code: str, *, source: str = "request") -> None:
        provider = self._provider(provider_id)
        async with self._lock(provider_id):
            self._record_failure_locked(provider, self._state(provider_id), error_code, source, None)
            store.persist_state()

    async def reset_circuit(self, provider_id: str) -> dict[str, Any]:
        provider = self._provider(provider_id)
        async with self._lock(provider_id):
            state = self._state(provider_id)
            state.update({
                "status": "unknown",
                "circuit_state": "closed",
                "consecutive_successes": 0,
                "consecutive_failures": 0,
                "last_error": None,
                "opened_at": None,
                "half_opened_at": None,
                "updated_at": store.now(),
            })
            self._append_history(provider, state, "reset", "manual_reset")
            self._resolve_outage_alerts(provider["id"])
            store.persist_state()
            return self._with_provider(state)

    def is_routable(self, provider_id: str) -> bool:
        state = self._state(provider_id)
        if state["status"] == "unhealthy":
            return False
        if state["circuit_state"] in {"open", "half_open"}:
            return False
        return True

    def _record_success_locked(self, provider: dict[str, Any], state: dict[str, Any], source: str, latency_ms: int | None) -> None:
        previous_status = state["status"]
        previous_circuit = state["circuit_state"]
        state["consecutive_successes"] = int(state.get("consecutive_successes") or 0) + 1
        state["consecutive_failures"] = 0
        state["last_checked_at"] = store.now()
        state["last_success_at"] = state["last_checked_at"]
        state["last_error"] = None
        if latency_ms is not None:
            state["last_latency_ms"] = latency_ms
        if state["circuit_state"] == "half_open" and state["consecutive_successes"] >= self.settings.provider_health_success_threshold:
            state["circuit_state"] = "closed"
            state["opened_at"] = None
            state["half_opened_at"] = None
            state["status"] = "healthy"
            self._resolve_outage_alerts(provider["id"])
            self._append_alert(provider, "provider_recovered", "info", f"{provider['name']} recovered", "Circuit closed after successful recovery probes.")
        elif state["circuit_state"] == "closed":
            state["status"] = "healthy"
        state["updated_at"] = store.now()
        self._append_history(provider, state, source, "success", previous_status, previous_circuit)

    def _record_failure_locked(self, provider: dict[str, Any], state: dict[str, Any], error_code: str, source: str, latency_ms: int | None) -> None:
        previous_status = state["status"]
        previous_circuit = state["circuit_state"]
        state["consecutive_failures"] = int(state.get("consecutive_failures") or 0) + 1
        state["consecutive_successes"] = 0
        state["last_checked_at"] = store.now()
        state["last_failure_at"] = state["last_checked_at"]
        state["last_error"] = error_code
        if latency_ms is not None:
            state["last_latency_ms"] = latency_ms
        if state["circuit_state"] == "half_open" or state["consecutive_failures"] >= self.settings.provider_health_failure_threshold:
            state["status"] = "unhealthy"
            state["circuit_state"] = "open"
            state["opened_at"] = store.now()
            state["half_opened_at"] = None
            self._append_alert(provider, "provider_outage", "critical", f"{provider['name']} unavailable", f"Circuit opened after provider health failures ({error_code}).")
        else:
            state["status"] = "degraded"
        state["updated_at"] = store.now()
        self._append_history(provider, state, source, error_code, previous_status, previous_circuit)

    def _client(self, provider: dict[str, Any]) -> httpx.AsyncClient:
        base_url, api_key = self._provider_settings(provider)
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        timeout = httpx.Timeout(connect=self.settings.gateway_connect_timeout_seconds, read=self.settings.gateway_read_timeout_seconds, write=self.settings.gateway_connect_timeout_seconds, pool=self.settings.gateway_connect_timeout_seconds)
        return httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout, headers=headers, transport=self.transport)

    def _provider_settings(self, provider: dict[str, Any]) -> tuple[str, str]:
        if provider["id"] == "provider-openai":
            return self.settings.openai_base_url or provider.get("base_url", ""), self.settings.openai_api_key or store.get_provider_api_key(provider["id"])
        if provider["id"] == "provider-india-hosted":
            return self.settings.india_hosted_llm_base_url or provider.get("base_url", ""), self.settings.india_hosted_llm_api_key or store.get_provider_api_key(provider["id"])
        return str(provider.get("base_url", "")), store.get_provider_api_key(provider["id"])

    def _provider(self, provider_id: str) -> dict[str, Any]:
        provider = next((item for item in store.PROVIDERS if item["id"] == provider_id), None)
        if not provider:
            raise KeyError(provider_id)
        return provider

    def _state(self, provider_id: str) -> dict[str, Any]:
        if provider_id not in store.PROVIDER_HEALTH:
            store.PROVIDER_HEALTH[provider_id] = {
                "provider_id": provider_id,
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
        return store.PROVIDER_HEALTH[provider_id]

    def _with_provider(self, state: dict[str, Any]) -> dict[str, Any]:
        provider = next((item for item in store.PROVIDERS if item["id"] == state["provider_id"]), {})
        return {**state, "provider_name": provider.get("name", state["provider_id"]), "provider_type": provider.get("provider_type"), "base_url": provider.get("base_url")}

    def _append_history(self, provider: dict[str, Any], state: dict[str, Any], source: str, result: str, previous_status: str | None = None, previous_circuit: str | None = None) -> None:
        store.PROVIDER_HEALTH_HISTORY.insert(0, {
            "id": f"phh-{uuid.uuid4().hex[:12]}",
            "provider_id": provider["id"],
            "provider_name": provider["name"],
            "source": source,
            "result": result,
            "status": state["status"],
            "circuit_state": state["circuit_state"],
            "previous_status": previous_status,
            "previous_circuit_state": previous_circuit,
            "latency_ms": state.get("last_latency_ms"),
            "error": state.get("last_error"),
            "created_at": store.now(),
        })
        del store.PROVIDER_HEALTH_HISTORY[500:]

    def _append_alert(self, provider: dict[str, Any], kind: str, severity: str, title: str, description: str) -> None:
        if kind == "provider_outage":
            existing = next((item for item in store.ALERTS if item.get("type") == kind and item.get("provider_id") == provider["id"] and not item.get("resolved_at")), None)
            if existing:
                return
        store.ALERTS.insert(0, {
            "id": f"alert-{uuid.uuid4().hex[:12]}",
            "type": kind,
            "severity": severity,
            "title": title,
            "description": description,
            "provider_id": provider["id"],
            "provider_name": provider["name"],
            "read": False,
            "resolved_at": None,
            "created_at": store.now(),
        })
        del store.ALERTS[500:]

    def _resolve_outage_alerts(self, provider_id: str) -> None:
        resolved_at = store.now()
        for alert in store.ALERTS:
            if alert.get("type") == "provider_outage" and alert.get("provider_id") == provider_id and not alert.get("resolved_at"):
                alert["resolved_at"] = resolved_at

    def _cooldown_elapsed(self, state: dict[str, Any]) -> bool:
        opened_at = state.get("opened_at")
        if not opened_at:
            return True
        try:
            opened_ts = time.mktime(time.strptime(opened_at[:19], "%Y-%m-%dT%H:%M:%S"))
        except ValueError:
            return True
        return time.time() - opened_ts >= self.settings.provider_health_half_open_after_seconds

    @classmethod
    def _lock(cls, provider_id: str) -> asyncio.Lock:
        if provider_id not in cls._locks:
            cls._locks[provider_id] = asyncio.Lock()
        return cls._locks[provider_id]


async def run_provider_health_monitor(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    service = ProviderHealthService(settings)
    while True:
        await asyncio.sleep(max(5, int(settings.provider_health_check_interval_seconds)))
        for provider in list(store.PROVIDERS):
            if provider.get("is_active", True):
                try:
                    await service.check_provider(provider["id"])
                except Exception:
                    continue
