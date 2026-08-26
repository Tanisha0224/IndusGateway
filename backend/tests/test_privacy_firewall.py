from __future__ import annotations

import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path
from typing import Any

import httpx
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import store
from app.api import openai_routes
from app.core.config import Settings
from app.main import app
from app.services.gateway_service import GatewayService
from app.services.privacy.detector import PIIDetector
from app.services.privacy.masker import PIIMasker


INITIAL_KEYS = deepcopy(store.VIRTUAL_KEYS)
INITIAL_KEY_MAP = deepcopy(store.FULL_KEY_MAP)
INITIAL_KEY_HASH_MAP = deepcopy(store.KEY_HASH_MAP)
INITIAL_POLICIES = deepcopy(store.POLICIES)
INITIAL_ALIASES = deepcopy(store.MODEL_ALIASES)
INITIAL_TARGETS = deepcopy(store.ALIAS_TARGETS)
INITIAL_ROUTING_POLICIES = deepcopy(store.ROUTING_POLICIES)
INITIAL_RATE_LIMIT_POLICIES = deepcopy(store.RATE_LIMIT_POLICIES)
INITIAL_PROJECT_USAGE = deepcopy(store.PROJECT_USAGE)
INITIAL_USAGE_RESERVATIONS = deepcopy(store.USAGE_RESERVATIONS)
INITIAL_PROVIDER_HEALTH = deepcopy(store.PROVIDER_HEALTH)
INITIAL_PROVIDER_HEALTH_HISTORY = deepcopy(store.PROVIDER_HEALTH_HISTORY)
INITIAL_ALERTS = deepcopy(store.ALERTS)
INITIAL_AUDIT_LOGS = deepcopy(store.AUDIT_LOGS)


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


class PrivacyDetectorTests(unittest.TestCase):
    def test_detects_supported_synthetic_entities_and_rejects_invalid_checksums(self) -> None:
        detector = PIIDetector()
        text = (
            "Email synthetic.user@example.test mobile +91 9876543210 PAN ABCDE1234F "
            "Aadhaar 2345 6789 0124 GSTIN 22AAAAA0000A1Z5 card 4111 1111 1111 1111 "
            "IFSC HDFC0001234 UPI synthetic@oksbi passport Z1234567 IP 203.0.113.10 "
            "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.signature123 "
            "api key sk-syntheticsecretvalue000000 and bank account 123456789012345 with IFSC."
        )
        entity_types = {finding.entity_type for finding in detector.detect(text)}
        self.assertTrue({"EMAIL", "INDIAN_MOBILE", "PAN", "AADHAAR", "GSTIN", "CARD", "IFSC", "UPI", "PASSPORT", "IP_ADDRESS", "JWT", "API_KEY", "BANK_ACCOUNT"}.issubset(entity_types))
        invalid = detector.detect("Invalid Aadhaar 2345 6789 0123 and card 4111 1111 1111 1112.")
        self.assertNotIn("AADHAAR", {finding.entity_type for finding in invalid})
        self.assertNotIn("CARD", {finding.entity_type for finding in invalid})

    def test_masking_uses_stable_request_local_placeholders(self) -> None:
        detector = PIIDetector()
        text = "Email alpha@example.test and alpha@example.test then beta@example.test."
        findings = detector.detect(text)
        masked = PIIMasker().mask(text, findings)
        self.assertEqual(masked.text.count("[EMAIL_1]"), 2)
        self.assertEqual(masked.text.count("[EMAIL_2]"), 1)
        second = PIIMasker().mask("Email beta@example.test.", detector.detect("Email beta@example.test."))
        self.assertIn("[EMAIL_1]", second.text)


class GatewayPrivacyIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        store.VIRTUAL_KEYS[:] = deepcopy(INITIAL_KEYS)
        store.FULL_KEY_MAP.clear()
        store.FULL_KEY_MAP.update(deepcopy(INITIAL_KEY_MAP))
        store.KEY_HASH_MAP.clear()
        store.KEY_HASH_MAP.update(deepcopy(INITIAL_KEY_HASH_MAP))
        store.POLICIES[:] = deepcopy(INITIAL_POLICIES)
        store.MODEL_ALIASES[:] = deepcopy(INITIAL_ALIASES)
        store.ALIAS_TARGETS[:] = deepcopy(INITIAL_TARGETS)
        store.ROUTING_POLICIES[:] = deepcopy(INITIAL_ROUTING_POLICIES)
        store.RATE_LIMIT_POLICIES[:] = deepcopy(INITIAL_RATE_LIMIT_POLICIES)
        store.PROJECT_USAGE.clear()
        store.PROJECT_USAGE.update(deepcopy(INITIAL_PROJECT_USAGE))
        store.USAGE_RESERVATIONS.clear()
        store.USAGE_RESERVATIONS.update(deepcopy(INITIAL_USAGE_RESERVATIONS))
        store.PROVIDER_HEALTH.clear()
        store.PROVIDER_HEALTH.update(deepcopy(INITIAL_PROVIDER_HEALTH))
        store.PROVIDER_HEALTH_HISTORY[:] = deepcopy(INITIAL_PROVIDER_HEALTH_HISTORY)
        store.ALERTS[:] = deepcopy(INITIAL_ALERTS)
        store.AUDIT_LOGS[:] = deepcopy(INITIAL_AUDIT_LOGS)
        store.GATEWAY_REQUESTS.clear()
        app.dependency_overrides.clear()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def override_gateway(self, handler) -> None:
        app.dependency_overrides[openai_routes.get_gateway_service] = lambda: mock_service(handler)

    def test_mask_and_allow_sends_only_masked_chat_content_to_provider(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": "ok"}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}})

        self.override_gateway(handler)
        raw_email = "alpha@example.test"
        response = self.client.post("/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": f"Contact {raw_email} for the synthetic case."}]})
        self.assertEqual(response.status_code, 200)
        provider_json = json.dumps(captured["body"])
        self.assertIn("[EMAIL_1]", provider_json)
        self.assertNotIn(raw_email, provider_json)
        trace_json = json.dumps(store.GATEWAY_REQUESTS)
        self.assertNotIn(raw_email, trace_json)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["privacy_action"], "mask_and_allow")
        self.assertEqual(store.GATEWAY_REQUESTS[0]["pii_types"], ["EMAIL"])

    def test_privacy_block_stops_provider_call_and_records_safe_audit(self) -> None:
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(200, json={"choices": [{"message": {"content": "should not happen"}}]})

        self.override_gateway(handler)
        raw_aadhaar = "2345 6789 0124"
        response = self.client.post("/v1/chat/completions", headers=auth_headers("ig_sk_live_demo_secret"), json={"model": "indusgate-sensitive", "messages": [{"role": "user", "content": f"Synthetic Aadhaar {raw_aadhaar}"}]})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "pii_policy_blocked")
        self.assertEqual(calls, 0)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["request_status"], "blocked")
        safe_json = json.dumps({"traces": store.GATEWAY_REQUESTS, "audit": store.AUDIT_LOGS})
        self.assertNotIn(raw_aadhaar, safe_json)
        self.assertIn("privacy.request_blocked", safe_json)

    def test_embeddings_list_input_is_masked_before_provider_call(self) -> None:
        captured: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={"object": "list", "data": [{"object": "embedding", "index": 0, "embedding": [0.1]}, {"object": "embedding", "index": 1, "embedding": [0.2]}], "usage": {"prompt_tokens": 2, "total_tokens": 2}})

        self.override_gateway(handler)
        response = self.client.post("/v1/embeddings", headers=auth_headers(), json={"model": "indusgate-embedding", "input": ["alpha@example.test", "beta@example.test"]})
        self.assertEqual(response.status_code, 200)
        provider_json = json.dumps(captured["body"])
        self.assertIn("[EMAIL_1]", provider_json)
        self.assertIn("[EMAIL_2]", provider_json)
        self.assertNotIn("alpha@example.test", provider_json)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["pii_entity_count"], 2)

    def test_provider_response_is_scanned_and_masked(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": "Synthetic reply to alpha@example.test"}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}})

        self.override_gateway(handler)
        response = self.client.post("/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}]})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("alpha@example.test", json.dumps(response.json()))
        self.assertIn("[EMAIL_1]", json.dumps(response.json()))
        self.assertEqual(store.GATEWAY_REQUESTS[0]["response_pii_types"], ["EMAIL"])

    def test_policy_simulation_does_not_persist_sample_text(self) -> None:
        self.client.post("/api/auth/session", json={"email": "platform.admin@indusgate.example", "password": "demo123"})
        sample = "Synthetic PAN ABCDE1234F belongs to alpha@example.test."
        response = self.client.post("/api/policies/simulate", json={"project_id": "proj-knowledge", "text": sample})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["decision"], "mask_and_allow")
        self.assertIn("[PAN_1]", body["masked_preview"])
        self.assertEqual(store.GATEWAY_REQUESTS, [])
        self.assertNotIn(sample, json.dumps(store.AUDIT_LOGS))

    def test_safe_buffered_stream_succeeds_with_public_alias_and_single_done(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            content = (
                'data: {"id":"upstream-stream","created":1780000000,"object":"chat.completion.chunk","model":"internal-model","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n'
                'data: {"id":"upstream-stream","created":1780000000,"object":"chat.completion.chunk","model":"internal-model","choices":[{"index":0,"delta":{"content":"Safe streamed text"},"finish_reason":null}]}\n\n'
                'data: {"id":"upstream-stream","created":1780000000,"object":"chat.completion.chunk","model":"internal-model","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'
                "data: [DONE]\n\n"
            )
            return httpx.Response(200, content=content, headers={"content-type": "text/event-stream"})

        self.override_gateway(handler)
        with self.client.stream("POST", "/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}], "stream": True}) as response:
            text = response.read().decode("utf-8")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers["content-type"])
        self.assertIn('"model":"indusgate-general"', text)
        self.assertNotIn("internal-model", text)
        self.assertEqual(text.count("data: [DONE]"), 1)
        self.assertTrue(text.rstrip().endswith("data: [DONE]"))
        trace = store.GATEWAY_REQUESTS[0]
        self.assertTrue(trace["stream_requested"])
        self.assertEqual(trace["stream_mode"], "buffered")
        self.assertEqual(trace["provider_chunk_count"], 3)
        self.assertTrue(trace["stream_completed"])

    def test_cross_chunk_streamed_email_is_masked_before_client_output(self) -> None:
        raw_email = "alpha@example.test"

        def handler(request: httpx.Request) -> httpx.Response:
            content = (
                'data: {"id":"upstream-stream","object":"chat.completion.chunk","model":"internal","choices":[{"index":0,"delta":{"content":"Contact alpha@"},"finish_reason":null}]}\n\n'
                'data: {"id":"upstream-stream","object":"chat.completion.chunk","model":"internal","choices":[{"index":0,"delta":{"content":"example.test now"},"finish_reason":null}]}\n\n'
                'data: {"id":"upstream-stream","object":"chat.completion.chunk","model":"internal","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'
                "data: [DONE]\n\n"
            )
            return httpx.Response(200, content=content, headers={"content-type": "text/event-stream"})

        self.override_gateway(handler)
        with self.client.stream("POST", "/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}], "stream": True}) as response:
            text = response.read().decode("utf-8")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(raw_email, text)
        self.assertIn("[EMAIL_1]", text)
        trace_json = json.dumps(store.GATEWAY_REQUESTS)
        self.assertNotIn(raw_email, trace_json)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["response_pii_types"], ["EMAIL"])
        self.assertEqual(store.GATEWAY_REQUESTS[0]["response_masked_entity_count"], 1)

    def test_streamed_response_block_returns_json_error_before_sse_starts(self) -> None:
        raw_aadhaar = "2345 6789 0124"

        def handler(request: httpx.Request) -> httpx.Response:
            content = (
                'data: {"id":"upstream-stream","object":"chat.completion.chunk","model":"internal","choices":[{"index":0,"delta":{"content":"Aadhaar 2345 "},"finish_reason":null}]}\n\n'
                'data: {"id":"upstream-stream","object":"chat.completion.chunk","model":"internal","choices":[{"index":0,"delta":{"content":"6789 0124"},"finish_reason":null}]}\n\n'
                "data: [DONE]\n\n"
            )
            return httpx.Response(200, content=content, headers={"content-type": "text/event-stream"})

        self.override_gateway(handler)
        response = self.client.post("/v1/chat/completions", headers=auth_headers("ig_sk_live_demo_secret"), json={"model": "indusgate-sensitive", "messages": [{"role": "user", "content": "Hello"}], "stream": True})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "stream_response_privacy_blocked")
        self.assertNotIn(raw_aadhaar, response.text)
        self.assertEqual(store.GATEWAY_REQUESTS[0]["stream_error_code"], "stream_response_privacy_blocked")
        self.assertNotIn(raw_aadhaar, json.dumps({"traces": store.GATEWAY_REQUESTS, "audit": store.AUDIT_LOGS}))

    def test_split_streamed_tool_call_arguments_are_masked_and_json_valid(self) -> None:
        raw_email = "alpha@example.test"

        def handler(request: httpx.Request) -> httpx.Response:
            chunks = [
                {"id": "upstream-stream", "object": "chat.completion.chunk", "model": "internal", "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0, "id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": '{"email":"alpha@'}}]}, "finish_reason": None}]},
                {"id": "upstream-stream", "object": "chat.completion.chunk", "model": "internal", "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0, "function": {"arguments": 'example.test"}'}}]}, "finish_reason": None}]},
                {"id": "upstream-stream", "object": "chat.completion.chunk", "model": "internal", "choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}]},
            ]
            content = "".join(f"data: {json.dumps(chunk)}\n\n" for chunk in chunks) + "data: [DONE]\n\n"
            return httpx.Response(200, content=content, headers={"content-type": "text/event-stream"})

        self.override_gateway(handler)
        with self.client.stream("POST", "/v1/chat/completions", headers=auth_headers(), json={"model": "indusgate-general", "messages": [{"role": "user", "content": "Hello"}], "stream": True}) as response:
            text = response.read().decode("utf-8")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(raw_email, text)
        self.assertIn("[EMAIL_1]", text)
        payloads = [line.removeprefix("data: ") for line in text.splitlines() if line.startswith("data: {")]
        tool_chunks = [json.loads(item) for item in payloads if "tool_calls" in item]
        arguments = tool_chunks[0]["choices"][0]["delta"]["tool_calls"][0]["function"]["arguments"]
        parsed = json.loads(arguments)
        self.assertEqual(parsed["email"], "[EMAIL_1]")


if __name__ == "__main__":
    unittest.main()
