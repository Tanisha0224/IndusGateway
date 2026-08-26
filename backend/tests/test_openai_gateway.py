from __future__ import annotations

import json
import sys
import unittest
import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import store
from app.api import openai_routes
from app.core.config import Settings
from app.core.errors import OpenAIError
from app.main import app
from app.services.gateway_service import GatewayService
from app.services.governance import GovernanceService
from app.services.provider_health import ProviderHealthService


INITIAL_KEYS = deepcopy(store.VIRTUAL_KEYS)
INITIAL_USERS = deepcopy(store.USERS)
INITIAL_KEY_MAP = deepcopy(store.FULL_KEY_MAP)
INITIAL_ALIASES = deepcopy(store.MODEL_ALIASES)
INITIAL_TARGETS = deepcopy(store.ALIAS_TARGETS)
INITIAL_ROUTING_POLICIES = deepcopy(store.ROUTING_POLICIES)
INITIAL_RATE_LIMIT_POLICIES = deepcopy(store.RATE_LIMIT_POLICIES)
INITIAL_PROJECT_USAGE = deepcopy(store.PROJECT_USAGE)
INITIAL_PROVIDERS = deepcopy(store.PROVIDERS)
INITIAL_PROVIDER_MODELS = deepcopy(store.PROVIDER_MODELS)
INITIAL_PROVIDER_CREDENTIALS = deepcopy(store.PROVIDER_CREDENTIALS)
INITIAL_PROVIDER_HEALTH = deepcopy(store.PROVIDER_HEALTH)
INITIAL_PROVIDER_HEALTH_HISTORY = deepcopy(store.PROVIDER_HEALTH_HISTORY)
INITIAL_ALERTS = deepcopy(store.ALERTS)
INITIAL_AUDIT_LOGS = deepcopy(store.AUDIT_LOGS)
INITIAL_USAGE_RESERVATIONS = deepcopy(store.USAGE_RESERVATIONS)
INITIAL_CACHE_ENTRIES = deepcopy(store.CACHE_ENTRIES)


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, int] = {}
        self.lock = asyncio.Lock()

    async def ping(self) -> bool:
        return True

    async def eval(self, script: str, numkeys: int, *args: object) -> list[object]:
        keys = [str(item) for item in args[:numkeys]]
        argv = [int(item) for item in args[numkeys:]]
        async with self.lock:
            if "INCRBY" in script:
                limits = argv[:numkeys]
                costs = argv[numkeys:]
                for key, limit, cost in zip(keys, limits, costs):
                    if limit >= 0 and self.values.get(key, 0) + cost > limit:
                        return [0, key, 60]
                for key, cost in zip(keys, costs):
                    self.values[key] = self.values.get(key, 0) + cost
                return [1, "", 0]
            for key, cost in zip(keys, argv[:numkeys]):
                self.values[key] = max(0, self.values.get(key, 0) - cost)
            return [1]


def auth_headers(token: str = "ig_sk_test_demo_secret") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def mock_service(handler) -> GatewayService:
    transport = httpx.MockTransport(handler)
    settings = Settings(
        india_hosted_llm_base_url="https://mock-india-hosted.local/v1",
        india_hosted_llm_api_key="test-india-hosted-key",
        openai_base_url="https://mock-openai.local/v1",
        openai_api_key="test-openai-key",
    )
    return GatewayService(settings=settings, provider_transport=transport)


class OpenAIGatewayTests(unittest.TestCase):
    def setUp(self) -> None:
        store.USERS[:] = deepcopy(INITIAL_USERS)
        store.VIRTUAL_KEYS[:] = deepcopy(INITIAL_KEYS)
        store.FULL_KEY_MAP.clear()
        store.FULL_KEY_MAP.update(deepcopy(INITIAL_KEY_MAP))
        store.MODEL_ALIASES[:] = deepcopy(INITIAL_ALIASES)
        store.ALIAS_TARGETS[:] = deepcopy(INITIAL_TARGETS)
        store.ROUTING_POLICIES[:] = deepcopy(INITIAL_ROUTING_POLICIES)
        store.RATE_LIMIT_POLICIES[:] = deepcopy(INITIAL_RATE_LIMIT_POLICIES)
        store.PROJECT_USAGE.clear()
        store.PROJECT_USAGE.update(deepcopy(INITIAL_PROJECT_USAGE))
        store.PROVIDERS[:] = deepcopy(INITIAL_PROVIDERS)
        store.PROVIDER_MODELS.clear()
        store.PROVIDER_MODELS.update(deepcopy(INITIAL_PROVIDER_MODELS))
        store.PROVIDER_CREDENTIALS.clear()
        store.PROVIDER_CREDENTIALS.update(deepcopy(INITIAL_PROVIDER_CREDENTIALS))
        store.PROVIDER_HEALTH.clear()
        store.PROVIDER_HEALTH.update(deepcopy(INITIAL_PROVIDER_HEALTH))
        store.PROVIDER_HEALTH_HISTORY[:] = deepcopy(INITIAL_PROVIDER_HEALTH_HISTORY)
        store.ALERTS[:] = deepcopy(INITIAL_ALERTS)
        store.USAGE_RESERVATIONS.clear()
        store.USAGE_RESERVATIONS.update(deepcopy(INITIAL_USAGE_RESERVATIONS))
        store.AUDIT_LOGS[:] = deepcopy(INITIAL_AUDIT_LOGS)
        store.CACHE_ENTRIES[:] = deepcopy(INITIAL_CACHE_ENTRIES)
        store.GATEWAY_REQUESTS.clear()
        app.dependency_overrides.clear()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def override_gateway(self, handler) -> GatewayService:
        service = mock_service(handler)
        app.dependency_overrides[openai_routes.get_gateway_service] = lambda: service
        return service

    def login_admin(self) -> None:
        response = self.client.post("/api/auth/session", json={"email": "platform.admin@indusgate.example", "password": "demo123"})
        self.assertEqual(response.status_code, 200)

    def test_missing_bearer_token_returns_401(self) -> None:
        response = self.client.get("/v1/models")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "invalid_api_key")

    def test_invalid_key_returns_401(self) -> None:
        response = self.client.get("/v1/models", headers=auth_headers("bad"))
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "invalid_api_key")

    def test_revoked_key_returns_401(self) -> None:
        store.VIRTUAL_KEYS[1]["status"] = "revoked"
        response = self.client.get("/v1/models", headers=auth_headers())
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "revoked_api_key")

    def test_expired_key_returns_401(self) -> None:
        store.VIRTUAL_KEYS[1]["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        response = self.client.get("/v1/models", headers=auth_headers())
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "expired_api_key")

    def test_models_returns_allowed_public_aliases_only(self) -> None:
        response = self.client.get("/v1/models", headers=auth_headers())
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["object"], "list")
        ids = {item["id"] for item in body["data"]}
        self.assertEqual(ids, {"indusgate-demo", "indusgate-general", "indusgate-fast", "indusgate-premium", "indusgate-embedding"})
        self.assertNotIn("llama-3.1-8b-instruct", json.dumps(body))
        self.assertNotIn("api_key", json.dumps(body).lower())

    def test_chat_completion_forwards_internal_model_and_returns_public_alias(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["path"] = request.url.path
            captured["authorization"] = request.headers.get("authorization")
            captured["body"] = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "id": "upstream-chat",
                    "object": "chat.completion",
                    "model": "llama-3.1-8b-instruct",
                    "choices": [{"index": 0, "message": {"role": "assistant", "content": "Real upstream text"}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 7, "completion_tokens": 3, "total_tokens": 10},
                },
            )

        self.override_gateway(handler)
        response = self.client.post(
            "/v1/chat/completions",
            headers=auth_headers(),
            json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}], "temperature": 0.3},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["path"], "/v1/chat/completions")
        self.assertEqual(captured["authorization"], "Bearer test-india-hosted-key")
        self.assertEqual(captured["body"]["model"], "llama-3.1-8b-instruct")
        self.assertEqual(response.json()["model"], "indusgate-general")
        self.assertEqual(response.json()["choices"][0]["message"]["content"], "Real upstream text")
        self.assertEqual(response.headers["X-IndusGate-Policy-Action"], "allow")
        self.assertTrue(response.headers["X-IndusGate-Gateway-Request-Id"])
        self.assertEqual(store.GATEWAY_REQUESTS[0]["prompt_tokens"], 7)
        self.assertNotIn("ig_sk_test_demo_secret", json.dumps(store.GATEWAY_REQUESTS))
        self.assertTrue(store.GATEWAY_REQUESTS[0]["budget_settled"])
        self.assertEqual(store.GATEWAY_REQUESTS[0]["estimated_tokens_reserved"], 513)
        self.assertEqual(next(iter(store.USAGE_RESERVATIONS.values()))["status"], "settled")

    def test_repeated_chat_completion_is_served_from_cache(self) -> None:
        provider_calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal provider_calls
            provider_calls += 1
            return httpx.Response(
                200,
                json={
                    "id": f"upstream-chat-{provider_calls}",
                    "object": "chat.completion",
                    "model": "llama-3.1-8b-instruct",
                    "choices": [{"index": 0, "message": {"role": "assistant", "content": "Cached upstream text"}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 6, "completion_tokens": 4, "total_tokens": 10},
                },
            )

        self.override_gateway(handler)
        payload = {"model": "indusgate-general", "messages": [{"role": "user", "content": "Summarize the quarterly platform migration plan."}]}
        first = self.client.post("/v1/chat/completions", headers=auth_headers(), json=payload)
        second = self.client.post("/v1/chat/completions", headers=auth_headers(), json=payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(provider_calls, 1)
        self.assertEqual(first.headers["X-IndusGate-Cache"], "miss")
        self.assertEqual(second.headers["X-IndusGate-Cache"], "hit")
        self.assertEqual(second.json()["choices"][0]["message"]["content"], "Cached upstream text")
        self.assertEqual(store.GATEWAY_REQUESTS[0]["cache_status"], "hit")
        self.assertTrue(store.GATEWAY_REQUESTS[0]["cache_saved_provider_call"])
        self.assertEqual(store.GATEWAY_REQUESTS[1]["cache_status"], "miss")
        self.assertEqual(len(store.CACHE_ENTRIES), 1)
        self.assertEqual(store.CACHE_ENTRIES[0]["hits"], 1)
        self.assertEqual(store.CACHE_ENTRIES[0]["tokens_saved"], 10)

    def test_demo_provider_returns_without_external_credentials_and_caches(self) -> None:
        service = GatewayService(settings=Settings(redis_url="", governance_fail_mode="open"))
        app.dependency_overrides[openai_routes.get_gateway_service] = lambda: service
        payload = {"model": "indusgate-demo", "messages": [{"role": "user", "content": "Summarize gateway privacy controls for demo."}]}
        first = self.client.post("/v1/chat/completions", headers=auth_headers(), json=payload)
        second = self.client.post("/v1/chat/completions", headers=auth_headers(), json=payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertIn("Demo provider response", first.json()["choices"][0]["message"]["content"])
        self.assertEqual(first.headers["X-IndusGate-Cache"], "miss")
        self.assertEqual(second.headers["X-IndusGate-Cache"], "hit")
        self.assertEqual(store.GATEWAY_REQUESTS[0]["selected_provider_id"], "provider-demo-local")
        self.assertEqual(store.GATEWAY_REQUESTS[0]["cache_status"], "hit")

    def test_admin_can_list_and_invalidate_cache_entry(self) -> None:
        self.login_admin()
        store.CACHE_ENTRIES.append({
            "id": "cache-test",
            "project_id": "proj-knowledge",
            "alias": "indusgate-general",
            "prompt_hash": "abc",
            "prompt_preview": "Hello",
            "token_fingerprint": ["hello"],
            "response_body": {"choices": []},
            "usage": {"total_tokens": 2},
            "provider_id": "provider-india-hosted",
            "provider_model": "llama-3.1-8b-instruct",
            "estimated_cost_inr": 0.01,
            "hits": 0,
            "tokens_saved": 0,
            "cost_saved_inr": 0,
            "last_similarity": 1.0,
            "ttl_minutes": 60,
            "active": True,
            "created_at": store.now(),
            "last_hit_at": None,
            "expires_at": None,
        })
        listed = self.client.get("/api/cache/entries")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["summary"]["active_entries"], 1)
        self.assertNotIn("response_body", json.dumps(listed.json()))
        invalidated = self.client.delete("/api/cache/entries/cache-test")
        self.assertEqual(invalidated.status_code, 200)
        self.assertFalse(invalidated.json()["active"])
        self.assertTrue(any(item["action"] == "cache.invalidate" for item in store.AUDIT_LOGS))

    def test_enabled_rate_policy_fails_closed_when_redis_is_unavailable(self) -> None:
        provider_called = False
        store.RATE_LIMIT_POLICIES.insert(0, {"id": "rl-test-fail-closed", "scope": "virtual_key", "scope_id": "key-2", "name": "Fail closed test", "enabled": True, "requests_per_minute": 1, "tokens_per_minute": 1000, "max_concurrent_requests": 1, "created_at": store.now(), "updated_at": store.now()})

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal provider_called
            provider_called = True
            return httpx.Response(200, json={})

        service = self.override_gateway(handler)
        service.governance.settings.redis_url = ""
        response = self.client.post(
            "/v1/chat/completions",
            headers=auth_headers(),
            json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}]},
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"]["code"], "governance_unavailable")
        self.assertEqual(response.headers["Retry-After"], "60")
        self.assertFalse(provider_called)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["request_status"], "blocked")

    def test_requests_per_minute_limit_returns_openai_compatible_429(self) -> None:
        provider_calls = 0
        store.RATE_LIMIT_POLICIES.insert(0, {"id": "rl-test-rpm", "scope": "virtual_key", "scope_id": "key-2", "name": "RPM test", "enabled": True, "requests_per_minute": 1, "tokens_per_minute": 1000, "max_concurrent_requests": 10, "created_at": store.now(), "updated_at": store.now()})

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal provider_calls
            provider_calls += 1
            return httpx.Response(
                200,
                json={"id": "upstream-chat", "object": "chat.completion", "model": "internal", "choices": [{"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 2, "completion_tokens": 1, "total_tokens": 3}},
            )

        service = self.override_gateway(handler)
        service.governance = GovernanceService(service.settings, FakeRedis())
        first = self.client.post("/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}]})
        second = self.client.post("/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello again"}]})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(second.json()["error"]["type"], "rate_limit_error")
        self.assertEqual(second.json()["error"]["code"], "rate_limit_exceeded")
        self.assertEqual(second.headers["Retry-After"], "60")
        self.assertEqual(provider_calls, 1)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["request_status"], "blocked")

    def test_provider_failure_releases_concurrent_reservation(self) -> None:
        store.RATE_LIMIT_POLICIES.insert(0, {"id": "rl-test-concurrency-release", "scope": "virtual_key", "scope_id": "key-2", "name": "Concurrency release test", "enabled": True, "requests_per_minute": 100, "tokens_per_minute": 100000, "max_concurrent_requests": 1, "created_at": store.now(), "updated_at": store.now()})

        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("timeout")

        service = self.override_gateway(handler)
        fake = FakeRedis()
        service.governance = GovernanceService(service.settings, fake)
        response = self.client.post("/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}]})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(next(iter(store.USAGE_RESERVATIONS.values()))["status"], "released")
        self.assertTrue(all(value == 0 for key, value in fake.values.items() if key.startswith("ig:conc:")))

    def test_max_concurrent_requests_are_enforced_atomically(self) -> None:
        async def scenario() -> None:
            store.RATE_LIMIT_POLICIES.insert(0, {"id": "rl-test-concurrent", "scope": "virtual_key", "scope_id": "key-2", "name": "Concurrent test", "enabled": True, "requests_per_minute": 100, "tokens_per_minute": 100000, "max_concurrent_requests": 1, "created_at": store.now(), "updated_at": store.now()})
            governance = GovernanceService(Settings(redis_url="redis://unit-test"), FakeRedis())
            key = store.VIRTUAL_KEYS[1]
            first = await governance.acquire(key=key, alias="indusgate-general", estimated_tokens=10)
            with self.assertRaises(OpenAIError) as ctx:
                await governance.acquire(key=key, alias="indusgate-general", estimated_tokens=10)
            self.assertEqual(ctx.exception.code, "rate_limit_exceeded")
            await governance.release(first.reservation_id)
            second = await governance.acquire(key=key, alias="indusgate-general", estimated_tokens=10)
            await governance.release(second.reservation_id)

        asyncio.run(scenario())

    def test_unknown_alias_returns_404(self) -> None:
        response = self.client.post(
            "/v1/chat/completions",
            headers=auth_headers(),
            json={"model": "missing-model", "messages": [{"role": "user", "content": "Hello"}]},
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "model_not_found")

    def test_disallowed_alias_returns_403(self) -> None:
        response = self.client.post(
            "/v1/chat/completions",
            headers=auth_headers(),
            json={"model": "indusgate-sensitive", "messages": [{"role": "user", "content": "Hello"}]},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "model_not_allowed")

    def test_provider_timeout_returns_503(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("timeout")

        self.override_gateway(handler)
        response = self.client.post(
            "/v1/chat/completions",
            headers=auth_headers(),
            json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}]},
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"]["code"], "provider_timeout")
        self.assertEqual(store.PROVIDER_HEALTH["provider-india-hosted"]["consecutive_failures"], 2)
        self.assertEqual(store.PROVIDER_HEALTH["provider-india-hosted"]["status"], "degraded")

    def test_manual_provider_health_check_and_reset(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.path, "/v1/models")
            return httpx.Response(200, json={"object": "list", "data": []})

        service = ProviderHealthService(Settings(india_hosted_llm_base_url="https://mock-india-hosted.local/v1", india_hosted_llm_api_key="test"), httpx.MockTransport(handler))

        async def scenario() -> None:
            checked = await service.check_provider("provider-india-hosted", force=True)
            self.assertEqual(checked["status"], "healthy")
            self.assertEqual(checked["circuit_state"], "closed")
            reset = await service.reset_circuit("provider-india-hosted")
            self.assertEqual(reset["status"], "unknown")
            self.assertEqual(reset["circuit_state"], "closed")

        asyncio.run(scenario())
        self.assertEqual(len(store.PROVIDER_HEALTH_HISTORY), 2)

    def test_provider_outage_alerts_are_deduplicated_and_resolved_on_recovery(self) -> None:
        service = ProviderHealthService(Settings(provider_health_failure_threshold=2, provider_health_success_threshold=1))

        async def scenario() -> None:
            await service.record_failure("provider-india-hosted", "provider_timeout")
            await service.record_failure("provider-india-hosted", "provider_timeout")
            await service.record_failure("provider-india-hosted", "provider_timeout")
            self.assertEqual(store.PROVIDER_HEALTH["provider-india-hosted"]["circuit_state"], "open")
            outage_alerts = [alert for alert in store.ALERTS if alert["type"] == "provider_outage"]
            self.assertEqual(len(outage_alerts), 1)
            store.PROVIDER_HEALTH["provider-india-hosted"]["circuit_state"] = "half_open"
            await service.record_success("provider-india-hosted")

        asyncio.run(scenario())
        outage_alerts = [alert for alert in store.ALERTS if alert["type"] == "provider_outage"]
        self.assertEqual(len(outage_alerts), 1)
        self.assertTrue(outage_alerts[0]["resolved_at"])
        self.assertEqual(store.PROVIDER_HEALTH["provider-india-hosted"]["circuit_state"], "closed")
        self.assertTrue(any(alert["type"] == "provider_recovered" for alert in store.ALERTS))

    def test_unhealthy_primary_falls_back_only_when_policy_allows_external_egress(self) -> None:
        captured: list[str] = []
        store.PROVIDER_HEALTH["provider-india-hosted"]["status"] = "unhealthy"
        store.PROVIDER_HEALTH["provider-india-hosted"]["circuit_state"] = "open"

        def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request.url.host or "")
            return httpx.Response(
                200,
                json={"id": "upstream-chat", "object": "chat.completion", "model": "gpt-4o-mini", "choices": [{"index": 0, "message": {"role": "assistant", "content": "external ok"}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}},
            )

        self.override_gateway(handler)
        response = self.client.post("/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["selected_provider_id"], "provider-openai")
        self.assertFalse(store.GATEWAY_REQUESTS[0]["fallback_used"])
        self.assertIn("mock-openai.local", captured)

    def test_unhealthy_india_provider_never_falls_back_when_external_egress_is_blocked(self) -> None:
        provider_called = False
        key = next(item for item in store.VIRTUAL_KEYS if item["id"] == "key-1")
        key["allowed_provider_ids"] = ["provider-india-hosted", "provider-openai"]
        store.ALIAS_TARGETS.append({"id": "target-sensitive-openai", "model_alias_id": "alias-sensitive", "provider_id": "provider-openai", "provider_model_name": "gpt-4o-mini", "priority": 2, "enabled": True, "region": "us", "is_india_hosted": False, "timeout_seconds": 30, "max_retries": 0, "fallback_eligible": True, "created_at": store.now(), "updated_at": store.now()})
        store.PROVIDER_HEALTH["provider-india-hosted"]["status"] = "unhealthy"
        store.PROVIDER_HEALTH["provider-india-hosted"]["circuit_state"] = "open"

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal provider_called
            provider_called = True
            return httpx.Response(200, json={})

        self.override_gateway(handler)
        response = self.client.post("/v1/chat/completions", headers=auth_headers("ig_sk_live_demo_secret"), json={"model": "indusgate-sensitive", "messages": [{"role": "user", "content": "Hello"}]})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "sovereignty_requirement_unsatisfied")
        self.assertFalse(provider_called)

    def test_concurrent_provider_failures_open_circuit_once(self) -> None:
        service = ProviderHealthService(Settings(provider_health_failure_threshold=3))

        async def scenario() -> None:
            await asyncio.gather(*(service.record_failure("provider-india-hosted", "provider_timeout") for _ in range(5)))

        asyncio.run(scenario())
        state = store.PROVIDER_HEALTH["provider-india-hosted"]
        self.assertEqual(state["consecutive_failures"], 5)
        self.assertEqual(state["status"], "unhealthy")
        self.assertEqual(state["circuit_state"], "open")
        self.assertEqual(len([alert for alert in store.ALERTS if alert["type"] == "provider_outage"]), 1)

    def test_streaming_returns_sse_chunks(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            content = (
                'data: {"id":"upstream","object":"chat.completion.chunk","model":"internal","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n'
                "data: [DONE]\n\n"
            )
            return httpx.Response(200, content=content, headers={"content-type": "text/event-stream"})

        self.override_gateway(handler)
        with self.client.stream(
            "POST",
            "/v1/chat/completions",
            headers=auth_headers(),
            json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}], "stream": True},
        ) as response:
            text = response.read().decode("utf-8")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers["content-type"])
        self.assertIn('"object":"chat.completion.chunk"', text)
        self.assertIn('"model":"indusgate-general"', text)
        self.assertTrue(text.rstrip().endswith("data: [DONE]"))

    def test_embeddings_single_string_succeeds(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            self.assertEqual(body["model"], "bge-large-en-v1.5")
            self.assertEqual(body["input"], "Sovereign enterprise AI")
            return httpx.Response(
                200,
                json={"object": "list", "data": [{"object": "embedding", "index": 0, "embedding": [0.012, -0.043]}], "model": "bge-large-en-v1.5", "usage": {"prompt_tokens": 3, "total_tokens": 3}},
            )

        self.override_gateway(handler)
        response = self.client.post("/v1/embeddings", headers=auth_headers(), json={"model": "indusgate-embedding", "input": "Sovereign enterprise AI"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["model"], "indusgate-embedding")
        self.assertEqual(response.json()["data"][0]["embedding"], [0.012, -0.043])

    def test_embeddings_list_input_succeeds(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            self.assertEqual(body["input"], ["First document", "Second document"])
            return httpx.Response(
                200,
                json={
                    "object": "list",
                    "data": [
                        {"object": "embedding", "index": 0, "embedding": [0.1]},
                        {"object": "embedding", "index": 1, "embedding": [0.2]},
                    ],
                    "model": "bge-large-en-v1.5",
                    "usage": {"prompt_tokens": 4, "total_tokens": 4},
                },
            )

        self.override_gateway(handler)
        response = self.client.post("/v1/embeddings", headers=auth_headers(), json={"model": "indusgate-embedding", "input": ["First document", "Second document"]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["data"]), 2)

    def test_non_embedding_model_is_rejected(self) -> None:
        response = self.client.post("/v1/embeddings", headers=auth_headers(), json={"model": "indusgate-general", "input": "Hello"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "invalid_request")

    def test_admin_can_create_alias_and_target_and_audit_is_written(self) -> None:
        self.login_admin()
        response = self.client.post(
            "/api/model-aliases",
            json={
                "project_id": "proj-knowledge",
                "alias": "indusgate-test_alias",
                "display_name": "Test Alias",
                "capability": "chat",
                "sovereignty_mode": "protected_external",
                "fallback_enabled": True,
            },
        )
        self.assertEqual(response.status_code, 200)
        alias_id = response.json()["id"]
        target = self.client.post(
            f"/api/model-aliases/{alias_id}/targets",
            json={
                "provider_id": "provider-india-hosted",
                "provider_model_name": "llama-3.1-8b-instruct",
                "priority": 1,
                "enabled": True,
                "region": "in-west-1",
                "is_india_hosted": True,
                "timeout_seconds": 30,
                "max_retries": 1,
                "fallback_eligible": True,
            },
        )
        self.assertEqual(target.status_code, 200)
        self.assertTrue(any(item["action"] == "model_alias.create" for item in store.AUDIT_LOGS))
        self.assertTrue(any(item["action"] == "model_alias_target.create" for item in store.AUDIT_LOGS))

    def test_admin_can_manage_users_and_disabled_users_cannot_login(self) -> None:
        self.login_admin()
        created = self.client.post(
            "/api/users",
            json={
                "name": "Test Auditor",
                "email": "test.auditor@indusgate.example",
                "app_role": "auditor",
                "status": "active",
                "department_id": "dept-infosec",
                "team_id": "team-compliance",
                "project_ids": ["proj-compliance"],
            },
        )
        self.assertEqual(created.status_code, 200)
        user_id = created.json()["id"]
        duplicate = self.client.post(
            "/api/users",
            json={
                "name": "Duplicate",
                "email": "test.auditor@indusgate.example",
                "app_role": "developer",
                "status": "active",
                "project_ids": [],
            },
        )
        self.assertEqual(duplicate.status_code, 409)
        updated = self.client.patch(f"/api/users/{user_id}", json={"app_role": "billing_viewer", "project_ids": []})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["role"], "member")
        self.assertEqual(updated.json()["app_role"], "billing_viewer")
        disabled = self.client.post(f"/api/users/{user_id}/disable")
        self.assertEqual(disabled.status_code, 200)
        blocked_login = self.client.post("/api/auth/session", json={"email": "test.auditor@indusgate.example", "password": "demo123"})
        self.assertEqual(blocked_login.status_code, 403)
        deleted = self.client.delete(f"/api/users/{user_id}")
        self.assertEqual(deleted.status_code, 204)
        self.assertTrue(any(item["action"] == "user.create" for item in store.AUDIT_LOGS))
        self.assertTrue(any(item["action"] == "user.delete" for item in store.AUDIT_LOGS))

    def test_member_cannot_manage_users(self) -> None:
        response = self.client.post("/api/auth/session", json={"email": "developer@indusgate.example", "password": "demo123"})
        self.assertEqual(response.status_code, 200)
        users = self.client.get("/api/users")
        self.assertEqual(users.status_code, 403)

    def test_admin_can_manage_provider_without_exposing_credential(self) -> None:
        self.login_admin()
        created = self.client.post(
            "/api/providers",
            json={
                "name": "Acme Compatible",
                "provider_type": "openai_compatible",
                "base_url": "https://acme.example/v1/",
                "is_active": True,
                "supports_chat": True,
                "supports_streaming": False,
                "supports_embeddings": True,
                "models": ["acme-chat", "acme-embed"],
                "pricing_json": {"input_per_1k_inr": 0.2, "output_per_1k_inr": 0.4},
            },
        )
        self.assertEqual(created.status_code, 200)
        provider_id = created.json()["id"]
        self.assertEqual(created.json()["base_url"], "https://acme.example/v1")
        self.assertEqual(created.json()["models"], ["acme-chat", "acme-embed"])
        credential = self.client.post(f"/api/providers/{provider_id}/credential", json={"api_key": "sk-test-secret"})
        self.assertEqual(credential.status_code, 200)
        self.assertTrue(credential.json()["credential_configured"])
        self.assertEqual(credential.json()["credential_source"], "encrypted_store")
        self.assertNotIn("sk-test-secret", json.dumps(credential.json()))
        self.assertEqual(store.get_provider_api_key(provider_id), "sk-test-secret")
        models = self.client.put(f"/api/providers/{provider_id}/models", json={"models": ["z-model", "a-model", "a-model"]})
        self.assertEqual(models.status_code, 200)
        self.assertEqual(models.json(), ["a-model", "z-model"])
        updated = self.client.patch(f"/api/providers/{provider_id}", json={"name": "Acme Updated", "supports_streaming": True})
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["name"], "Acme Updated")
        disabled = self.client.delete(f"/api/providers/{provider_id}")
        self.assertEqual(disabled.status_code, 200)
        self.assertFalse(disabled.json()["is_active"])
        self.assertTrue(any(item["action"] == "provider.credential.update" for item in store.AUDIT_LOGS))

    def test_duplicate_alias_is_rejected(self) -> None:
        self.login_admin()
        response = self.client.post(
            "/api/model-aliases",
            json={
                "project_id": "proj-knowledge",
                "alias": "indusgate-general",
                "display_name": "Duplicate",
                "capability": "chat",
                "sovereignty_mode": "protected_external",
                "fallback_enabled": True,
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_policy_simulation_excludes_external_for_india_only(self) -> None:
        self.login_admin()
        alias = next(item for item in store.MODEL_ALIASES if item["alias"] == "indusgate-sensitive")
        key = next(item for item in store.VIRTUAL_KEYS if item["id"] == "key-1")
        key["allowed_provider_ids"] = ["provider-india-hosted", "provider-openai"]
        store.ALIAS_TARGETS.append({
            "id": "target-sensitive-external",
            "model_alias_id": alias["id"],
            "provider_id": "provider-openai",
            "provider_model_name": "gpt-4o",
            "priority": 2,
            "enabled": True,
            "region": "us",
            "is_india_hosted": False,
            "timeout_seconds": 30,
            "max_retries": 1,
            "fallback_eligible": True,
            "created_at": store.now(),
            "updated_at": store.now(),
        })
        response = self.client.post("/api/routing-policies/simulate", json={"virtual_key_id": "key-1", "alias": "indusgate-sensitive", "capability": "chat"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual([target["id"] for target in body["eligible_targets"]], ["target-sensitive-india"])
        self.assertTrue(any(target["id"] == "target-sensitive-external" and "India-hosting" in target["reason"] for target in body["excluded_targets"]))

    def test_routing_fields_are_persisted_in_trace(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "id": "upstream-chat",
                    "object": "chat.completion",
                    "model": "llama-3.1-8b-instruct",
                    "choices": [{"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 2, "completion_tokens": 1, "total_tokens": 3},
                },
            )

        self.override_gateway(handler)
        response = self.client.post("/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}]})
        self.assertEqual(response.status_code, 200)
        trace = store.GATEWAY_REQUESTS[0]
        self.assertEqual(trace["requested_public_alias"], "indusgate-general")
        self.assertEqual(trace["selected_target_id"], "target-general-india")
        self.assertEqual(trace["selected_provider_id"], "provider-india-hosted")
        self.assertEqual(trace["matched_routing_policy_ids"], ["route-knowledge-protected"])
        self.assertNotIn("test-india-hosted-key", json.dumps(trace))


if __name__ == "__main__":
    unittest.main()
