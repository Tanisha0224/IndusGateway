from __future__ import annotations

import json
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any

from app import store
from app.core.config import Settings, get_settings
from app.core.errors import OpenAIError, all_routes_failed, invalid_request, provider_unavailable
from app.schemas.openai import ChatCompletionRequest, ChatMessage, EmbeddingsRequest
from app.services.cache_service import CacheService
from app.services.model_registry import ModelConfig
from app.services.governance import GovernanceService, GovernanceDecision
from app.services.provider_clients.demo import DemoProviderClient
from app.services.provider_clients.gemini import GeminiProviderClient
from app.services.provider_clients.openai_compatible import OpenAICompatibleProviderClient
from app.services.provider_health import FAILURE_CODES, ProviderHealthService
from app.services.privacy.detector import DETECTOR_VERSION
from app.services.privacy.masker import PIIMasker
from app.services.privacy.service import PrivacyFirewall, PrivacyRequestResult, ResponseScanResult
from app.services.routing_service import RoutingDecision, list_public_aliases_for_key, resolve_route, routing_trace_fields
from app.services.streaming.privacy_stream import SecureBufferedStreamer, iter_buffered_events


class GatewayService:
    def __init__(self, settings: Settings | None = None, provider_transport: Any | None = None) -> None:
        self.settings = settings or get_settings()
        self.openai_client = OpenAICompatibleProviderClient(self.settings, transport=provider_transport)
        self.gemini_client = GeminiProviderClient()
        self.demo_client = DemoProviderClient()
        self.privacy = PrivacyFirewall()
        self.governance = GovernanceService(self.settings)
        self.provider_health = ProviderHealthService(self.settings, transport=provider_transport)
        self.cache = CacheService()

    def list_models(self, key: dict[str, Any]) -> dict[str, Any]:
        data = [
            {"id": alias["alias"], "object": "model", "created": alias.get("created", 1720000000), "owned_by": alias.get("owned_by", "indusgate")}
            for alias in list_public_aliases_for_key(key)
        ]
        return {"object": "list", "data": data}

    def _client_for(self, model_config: ModelConfig) -> Any:
        if model_config.provider_type == "demo":
            return self.demo_client
        if model_config.provider_type == "gemini":
            return self.gemini_client
        return self.openai_client

    def _audit_gateway(self, key: dict[str, Any], action: str, request_id: str | None, metadata: dict[str, Any]) -> None:
        store.AUDIT_LOGS.insert(0, {
            "id": str(uuid.uuid4()),
            "actor_type": "virtual_key",
            "actor_id": key["id"],
            "action": action,
            "resource_type": "gateway_request",
            "resource_id": request_id,
            "metadata_json": metadata,
            "created_at": store.now(),
        })
        store.persist_state()

    def _privacy_trace_fields(self, privacy: PrivacyRequestResult | None = None, response_scan: ResponseScanResult | None = None) -> dict[str, Any]:
        findings = privacy.findings if privacy else []
        decision = privacy.decision if privacy else None
        response_findings = response_scan.findings if response_scan else []
        return {
            "pii_detected": bool(findings),
            "pii_types": sorted({item.entity_type for item in findings}),
            "pii_entity_count": len(findings),
            "privacy_policy_ids": decision.policy_ids if decision else [],
            "privacy_action": decision.action if decision else "allow",
            "masking_applied": bool(privacy and privacy.masked_count),
            "masked_entity_count": privacy.masked_count if privacy else 0,
            "external_egress_allowed": bool(decision.external_egress_allowed) if decision else True,
            "response_scan_performed": response_scan is not None,
            "response_pii_types": sorted({item.entity_type for item in response_findings}),
            "response_masked_entity_count": response_scan.masked_count if response_scan else 0,
            "restoration_applied": False,
            "restored_entity_count": 0,
            "detector_version": DETECTOR_VERSION,
            "privacy_processing_ms": privacy.processing_ms if privacy else 0,
            "stream_requested": False,
            "stream_mode": None,
            "provider_stream_started": False,
            "provider_chunk_count": 0,
            "buffered_character_count": 0,
            "stream_buffer_limit": get_settings().streaming_max_buffer_characters,
            "response_pii_detected": bool(response_findings),
            "response_pii_entity_count": len(response_findings),
            "response_privacy_action": response_scan.action if response_scan else "allow",
            "response_masking_applied": bool(response_scan and response_scan.masked_count),
            "client_disconnected": False,
            "stream_completed": False,
            "stream_error_code": None,
        }

    def _create_trace(self, key: dict[str, Any], model_config: ModelConfig, operation: str, stream: bool, decision: RoutingDecision, privacy: PrivacyRequestResult | None = None, sanitized_prompt: str | None = None) -> dict[str, Any]:
        created = store.now()
        policy_action = privacy.decision.action if privacy else "allow"
        pii = privacy.pii_types if privacy else []
        trace = {
            "id": f"gwr-{uuid.uuid4().hex[:12]}",
            "operation": operation,
            "virtual_key_id": key["id"],
            "project_id": key["project_id"],
            "provider_id": model_config.provider_id,
            "provider_name": model_config.provider.get("name"),
            "provider_model": model_config.provider_model,
            "model_requested": model_config.alias,
            "model_routed": model_config.alias,
            "stream": stream,
            "request_status": "started",
            "http_status": None,
            "error_category": None,
            "policy_id": (privacy.decision.policy_ids[0] if privacy and privacy.decision.policy_ids else "policy-general"),
            "policy_action": policy_action,
            "detected_pii_types": pii or [],
            "masked_fields_count": len(pii or []),
            "sanitized_prompt": sanitized_prompt,
            "provider_response_status": None,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "usage_estimated": False,
            "latency_ms": None,
            "created_at": created,
            "started_at": created,
            "completed_at": None,
            "cache_status": "bypass_stream" if stream else "pending",
            "cache_entry_id": None,
            "cache_similarity": None,
            "cache_saved_provider_call": False,
            **routing_trace_fields(decision),
            **self._privacy_trace_fields(privacy),
            **self._governance_trace_fields(),
        }
        store.GATEWAY_REQUESTS.insert(0, trace)
        store.persist_state()
        return trace

    def _create_privacy_block_trace(self, key: dict[str, Any], operation: str, model: str, privacy: PrivacyRequestResult) -> dict[str, Any]:
        created = store.now()
        trace = {
            "id": f"gwr-{uuid.uuid4().hex[:12]}",
            "operation": operation,
            "virtual_key_id": key["id"],
            "project_id": key["project_id"],
            "provider_id": None,
            "provider_name": None,
            "provider_model": None,
            "model_requested": model,
            "model_routed": None,
            "stream": False,
            "request_status": "blocked",
            "http_status": 403,
            "error_category": "pii_policy_blocked",
            "policy_id": privacy.decision.policy_ids[0] if privacy.decision.policy_ids else None,
            "policy_action": privacy.decision.action,
            "detected_pii_types": privacy.pii_types,
            "masked_fields_count": 0,
            "sanitized_prompt": None,
            "provider_response_status": None,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "usage_estimated": False,
            "latency_ms": None,
            "created_at": created,
            "started_at": created,
            "completed_at": created,
            "cache_status": "bypass_blocked",
            "cache_entry_id": None,
            "cache_similarity": None,
            "cache_saved_provider_call": False,
            "requested_public_alias": model,
            "selected_alias_id": None,
            "selected_target_id": None,
            "selected_provider_id": None,
            "selected_provider_model": None,
            "matched_routing_policy_ids": [],
            "sovereignty_mode": None,
            "routing_reason": "Request blocked by privacy policy before routing.",
            "attempt_count": 0,
            "fallback_used": False,
            "attempted_targets": [],
            "provider_failure_categories": [],
            **self._privacy_trace_fields(privacy),
            **self._governance_trace_fields(),
        }
        store.GATEWAY_REQUESTS.insert(0, trace)
        self._audit_gateway(key, "privacy.request_blocked", trace["id"], {"project_id": key["project_id"], "policy_ids": privacy.decision.policy_ids, "pii_types": privacy.pii_types, "count": len(privacy.findings), "action": privacy.decision.action})
        store.persist_state()
        return trace

    def _governance_trace_fields(self, decision: GovernanceDecision | None = None, *, settled: bool = False) -> dict[str, Any]:
        return {
            "governance_enforced": decision is not None,
            "governance_reservation_id": decision.reservation_id if decision else None,
            "estimated_tokens_reserved": decision.estimated_tokens if decision else 0,
            "estimated_cost_reserved_inr": decision.estimated_cost_inr if decision else 0,
            "rate_limit_scopes": decision.redis_keys if decision else [],
            "budget_reserved": decision is not None,
            "budget_settled": settled,
        }

    def _stream_trace_fields(self, *, chunk_count: int = 0, buffered_characters: int = 0, completed: bool = False, error_code: str | None = None) -> dict[str, Any]:
        return {
            "stream_requested": True,
            "stream_mode": "buffered",
            "provider_stream_started": chunk_count > 0 or error_code is None,
            "provider_chunk_count": chunk_count,
            "buffered_character_count": buffered_characters,
            "stream_buffer_limit": self.settings.streaming_max_buffer_characters,
            "client_disconnected": False,
            "stream_completed": completed,
            "stream_error_code": error_code,
        }

    def _finish_trace(self, trace: dict[str, Any], status: str, http_status: int, usage: dict[str, Any] | None = None, error_category: str | None = None, started: float | None = None) -> None:
        usage = usage or {}
        trace["request_status"] = status
        trace["http_status"] = http_status
        trace["provider_response_status"] = http_status if status == "completed" else None
        trace["prompt_tokens"] = int(usage.get("prompt_tokens") or 0)
        trace["completion_tokens"] = int(usage.get("completion_tokens") or 0)
        trace["total_tokens"] = int(usage.get("total_tokens") or trace["prompt_tokens"] + trace["completion_tokens"])
        trace["usage_estimated"] = not bool(usage)
        trace["error_category"] = error_category
        trace["completed_at"] = store.now()
        if started is not None:
            trace["latency_ms"] = round((time.perf_counter() - started) * 1000, 2)
        store.persist_state()

    def _public_chat_response(self, body: dict[str, Any], request_id: str, model_alias: str) -> dict[str, Any]:
        body = dict(body)
        body["id"] = body.get("id") or f"chatcmpl-{uuid.uuid4().hex[:12]}"
        body["object"] = body.get("object") or "chat.completion"
        body["model"] = model_alias
        return body

    def _public_embeddings_response(self, body: dict[str, Any], model_alias: str) -> dict[str, Any]:
        body = dict(body)
        body["object"] = body.get("object") or "list"
        body["model"] = model_alias
        body.setdefault("usage", {"prompt_tokens": 0, "total_tokens": 0})
        return body

    def _extract_chat_text(self, request: ChatCompletionRequest) -> str:
        chunks: list[str] = []
        for message in request.messages:
            if isinstance(message.content, str):
                chunks.append(message.content)
            elif isinstance(message.content, list):
                for part in message.content:
                    if isinstance(part, dict) and isinstance(part.get("text"), str):
                        chunks.append(part["text"])
            if message.tool_calls:
                chunks.append(json.dumps(message.tool_calls, separators=(",", ":"), ensure_ascii=False))
        return "\n".join(chunks)

    def _masked_chat_request(self, request: ChatCompletionRequest, project_id: str, privacy: PrivacyRequestResult) -> ChatCompletionRequest:
        masker = PIIMasker()
        messages: list[ChatMessage] = []
        for message in request.messages:
            content = message.content
            if isinstance(content, str):
                findings = self.privacy.detector.detect(content)
                maskable = [finding for finding in findings if privacy.decision.action == "mask_and_allow"]
                content = masker.mask(content, maskable).text
            elif isinstance(content, list):
                parts = []
                for part in content:
                    item = dict(part)
                    if isinstance(item.get("text"), str):
                        findings = self.privacy.detector.detect(item["text"])
                        maskable = [finding for finding in findings if privacy.decision.action == "mask_and_allow"]
                        item["text"] = masker.mask(item["text"], maskable).text
                    parts.append(item)
                content = parts
            messages.append(message.model_copy(update={"content": content}))
        return request.model_copy(update={"messages": messages})

    def _masked_embeddings_request(self, request: EmbeddingsRequest, key: dict[str, Any]) -> tuple[EmbeddingsRequest, PrivacyRequestResult]:
        values = [request.input] if isinstance(request.input, str) else list(request.input)
        detector_results = [self.privacy.detector.detect(value) for value in values]
        all_findings = [finding for findings in detector_results for finding in findings]
        decision = self.privacy.evaluator.evaluate(key["project_id"], all_findings)
        if decision.action == "block":
            raise OpenAIError("The request was blocked by the configured privacy policy.", status_code=403, error_type="privacy_policy_error", code="pii_policy_blocked")
        masker = PIIMasker()
        sanitized_values: list[str] = []
        masked_count = 0
        for value, findings in zip(values, detector_results):
            maskable = [finding for finding in findings if decision.action == "mask_and_allow"]
            masked = masker.mask(value, maskable)
            sanitized_values.append(masked.text)
            masked_count += masked.masked_count
        aggregate = PrivacyRequestResult(
            original_text="\n".join(values),
            sanitized_text="\n".join(sanitized_values),
            findings=all_findings,
            decision=decision,
            masked_count=masked_count,
            placeholder_count=masker.placeholder_count,
            processing_ms=0,
        )
        masked_input: str | list[str] = sanitized_values[0] if isinstance(request.input, str) else sanitized_values
        return request.model_copy(update={"input": masked_input}), aggregate

    def _scan_chat_response(self, body: dict[str, Any], key: dict[str, Any]) -> tuple[dict[str, Any], ResponseScanResult | None]:
        scan: ResponseScanResult | None = None
        body = dict(body)
        choices = body.get("choices")
        if isinstance(choices, list):
            for choice in choices:
                message = choice.get("message") if isinstance(choice, dict) else None
                if isinstance(message, dict) and isinstance(message.get("content"), str):
                    scan = self.privacy.scan_response_text(key["project_id"], message["content"])
                    message["content"] = scan.text
                if isinstance(message, dict) and isinstance(message.get("tool_calls"), list):
                    for tool_call in message["tool_calls"]:
                        function = tool_call.get("function") if isinstance(tool_call, dict) else None
                        if isinstance(function, dict) and isinstance(function.get("arguments"), str):
                            scan = self.privacy.scan_response_text(key["project_id"], function["arguments"])
                            function["arguments"] = scan.text
        return body, scan

    async def chat_completion(self, key: dict[str, Any], request: ChatCompletionRequest) -> tuple[dict[str, Any], dict[str, str]]:
        try:
            privacy = self.privacy.inspect_text(key["project_id"], self._extract_chat_text(request))
        except OpenAIError as exc:
            if exc.code == "pii_policy_blocked":
                text = self._extract_chat_text(request)
                findings = self.privacy.detector.detect(text)
                decision = self.privacy.evaluator.evaluate(key["project_id"], findings)
                blocked = PrivacyRequestResult("", "", findings, decision, 0, 0, 0)
                self._create_privacy_block_trace(key, "chat.completions", request.model, blocked)
            raise
        privacy_context = {"external_egress_allowed": privacy.decision.external_egress_allowed}
        decision = resolve_route(request.model, "chat", key, privacy_context)
        model_config = decision.model_config
        masked_request = self._masked_chat_request(request, key["project_id"], privacy)
        sanitized_prompt = privacy.sanitized_text if privacy.masked_count else None
        trace = self._create_trace(key, model_config, "chat.completions", False, decision, privacy, sanitized_prompt)
        policy_action = privacy.decision.action
        started = time.perf_counter()
        governance: GovernanceDecision | None = None
        response_headers: dict[str, str] = {"X-IndusGate-Gateway-Request-Id": trace["id"], "X-IndusGate-Policy-Action": policy_action}
        try:
            governance = await self.governance.acquire(key=key, alias=model_config.alias, estimated_tokens=self.governance.estimate_tokens_for_chat(masked_request.messages, masked_request.max_tokens))
            trace.update(self._governance_trace_fields(governance))
            response_headers.update(governance.headers)
            cache_prompt = self._extract_chat_text(masked_request)
            if privacy.findings:
                trace["cache_status"] = "bypass_sensitive"
            else:
                cached = self.cache.lookup(project_id=key["project_id"], alias=model_config.alias, prompt_text=cache_prompt)
                if cached:
                    public_body = self._public_chat_response(cached["response_body"], trace["id"], model_config.alias)
                    trace["cache_status"] = "hit"
                    trace["cache_entry_id"] = cached["id"]
                    trace["cache_similarity"] = cached["similarity"]
                    trace["cache_saved_provider_call"] = True
                    self._finish_trace(trace, "completed", 200, public_body.get("usage"), started=started)
                    await self.governance.settle(governance.reservation_id if governance else None, 0)
                    trace.update(self._governance_trace_fields(governance, settled=True))
                    trace.update(routing_trace_fields(decision, attempted_targets=[], fallback_used=False, failure_categories=[]))
                    response_headers["X-IndusGate-Cache"] = "hit"
                    store.persist_state()
                    return public_body, response_headers
                trace["cache_status"] = "miss"
                response_headers["X-IndusGate-Cache"] = "miss"
        except OpenAIError as exc:
            status = "budget_blocked" if exc.code == "budget_exceeded" else "blocked"
            self._finish_trace(trace, status, exc.status_code, error_category=exc.code, started=started)
            self._audit_gateway(key, f"governance.{exc.code}", trace["id"], {"project_id": key["project_id"], "alias": model_config.alias, "action": "blocked"})
            store.persist_state()
            raise
        attempts: list[dict[str, Any]] = []
        failures: list[str] = []
        first_route_error: OpenAIError | None = None
        targets_to_try = [(decision.target, decision.provider)]
        if decision.effective_restrictions.get("fallback_allowed"):
            for target in decision.eligible_targets:
                if target["id"] != decision.target["id"] and target.get("fallback_eligible", True):
                    provider = next((item for item in store.PROVIDERS if item["id"] == target["provider_id"]), None)
                    if provider:
                        targets_to_try.append((target, provider))
        try:
            for index, (target, provider) in enumerate(targets_to_try):
                attempt_config = ModelConfig(
                    alias=decision.alias["alias"],
                    provider_id=provider["id"],
                    provider_type=provider.get("provider_type", "openai_compatible"),
                    provider_model=target["provider_model_name"],
                    owned_by=decision.alias.get("owned_by", "indusgate"),
                    created=int(decision.alias.get("created", 1720000000)),
                    supports_chat=True,
                    supports_streaming=bool(provider.get("supports_streaming", True)),
                    supports_embeddings=False,
                    provider=provider,
                )
                max_attempts = int(target.get("max_retries", 0)) + 1
                for retry_index in range(max_attempts):
                    attempts.append({"target_id": target["id"], "provider_id": provider["id"], "provider_model": target["provider_model_name"], "attempt": retry_index + 1, "result": "started"})
                    trace.update(routing_trace_fields(decision, attempted_targets=attempts, fallback_used=index > 0, failure_categories=failures))
                    try:
                        body = await self._client_for(attempt_config).chat_completion(masked_request, attempt_config)
                        await self.provider_health.record_success(provider["id"])
                        attempts[-1]["result"] = "completed"
                        trace["selected_target_id"] = target["id"]
                        trace["selected_provider_id"] = provider["id"]
                        trace["selected_provider_model"] = target["provider_model_name"]
                        trace["provider_id"] = provider["id"]
                        trace["provider_name"] = provider.get("name")
                        trace["provider_model"] = target["provider_model_name"]
                        scanned_body, response_scan = self._scan_chat_response(body, key)
                        public_body = self._public_chat_response(scanned_body, trace["id"], model_config.alias)
                        self._finish_trace(trace, "completed", 200, public_body.get("usage"), started=started)
                        actual_tokens = int((public_body.get("usage") or {}).get("total_tokens") or trace["total_tokens"] or (governance.estimated_tokens if governance else 0))
                        await self.governance.settle(governance.reservation_id if governance else None, actual_tokens)
                        if trace.get("cache_status") == "miss" and not privacy.findings:
                            entry = self.cache.store_response(
                                project_id=key["project_id"],
                                alias=model_config.alias,
                                prompt_text=self._extract_chat_text(masked_request),
                                response_body=public_body,
                                provider_id=provider["id"],
                                provider_model=target["provider_model_name"],
                                estimated_cost_inr=float(trace.get("estimated_cost_reserved_inr") or 0),
                            )
                            if entry:
                                trace["cache_entry_id"] = entry["id"]
                        trace.update(self._governance_trace_fields(governance, settled=True))
                        trace.update(self._privacy_trace_fields(privacy, response_scan))
                        trace.update(routing_trace_fields(decision, attempted_targets=attempts, fallback_used=index > 0, failure_categories=failures))
                        store.persist_state()
                        return public_body, response_headers
                    except OpenAIError as exc:
                        if exc.code in FAILURE_CODES:
                            await self.provider_health.record_failure(provider["id"], exc.code)
                        if first_route_error is None:
                            first_route_error = exc
                        attempts[-1]["result"] = "failed"
                        attempts[-1]["failure_category"] = exc.code
                        failures.append(exc.code)
                        if exc.code not in {"provider_timeout", "provider_unavailable"}:
                            raise
                        if retry_index + 1 < max_attempts:
                            continue
                        break
            self._finish_trace(trace, "failed", 503, error_category="all_routes_failed", started=started)
            trace.update(routing_trace_fields(decision, attempted_targets=attempts, fallback_used=len(attempts) > 1, failure_categories=failures))
            await self.governance.release(governance.reservation_id if governance else None)
            raise first_route_error or all_routes_failed()
        except OpenAIError as exc:
            self._finish_trace(trace, "failed", exc.status_code, error_category=exc.code, started=started)
            trace.update(routing_trace_fields(decision, attempted_targets=attempts, fallback_used=len(attempts) > 1, failure_categories=failures))
            await self.governance.release(governance.reservation_id if governance else None)
            raise
        except Exception as exc:
            self._finish_trace(trace, "failed", 503, error_category="provider_unavailable", started=started)
            await self.governance.release(governance.reservation_id if governance else None)
            await self.provider_health.record_failure(model_config.provider_id, "provider_unavailable")
            raise provider_unavailable() from exc

    async def stream_chat_completion(self, key: dict[str, Any], request: ChatCompletionRequest) -> tuple[AsyncIterator[str], dict[str, str]]:
        privacy = self.privacy.inspect_text(key["project_id"], self._extract_chat_text(request))
        decision = resolve_route(request.model, "chat", key, {"external_egress_allowed": privacy.decision.external_egress_allowed})
        model_config = decision.model_config
        if not model_config.supports_streaming:
            raise invalid_request("The requested model does not support streaming", "stream")
        masked_request = self._masked_chat_request(request, key["project_id"], privacy)
        policy_action = privacy.decision.action
        trace = self._create_trace(key, model_config, "chat.completions", True, decision, privacy, privacy.sanitized_text if privacy.masked_count else None)
        trace.update(self._stream_trace_fields())
        started = time.perf_counter()
        governance: GovernanceDecision | None = None
        response_headers: dict[str, str] = {"X-IndusGate-Gateway-Request-Id": trace["id"], "X-IndusGate-Policy-Action": policy_action}
        try:
            governance = await self.governance.acquire(key=key, alias=model_config.alias, estimated_tokens=self.governance.estimate_tokens_for_chat(masked_request.messages, masked_request.max_tokens))
            trace.update(self._governance_trace_fields(governance))
            response_headers.update(governance.headers)
            upstream = self._client_for(model_config).stream_chat_completion(masked_request, model_config)
            result = await SecureBufferedStreamer(self.settings, self.privacy).process(
                upstream=upstream,
                project_id=key["project_id"],
                public_model=model_config.alias,
                request_privacy=privacy,
            )
            await self.provider_health.record_success(model_config.provider_id)
            self._finish_trace(trace, "completed", 200, result.assembled.usage, started=started)
            actual_tokens = int((result.assembled.usage or {}).get("total_tokens") or (governance.estimated_tokens if governance else 0))
            await self.governance.settle(governance.reservation_id if governance else None, actual_tokens)
            trace.update(self._governance_trace_fields(governance, settled=True))
            trace.update(self._privacy_trace_fields(privacy, result.response_scan))
            trace.update(self._stream_trace_fields(chunk_count=result.assembled.chunk_count, buffered_characters=len(result.assembled.content), completed=True))
            trace["response_privacy_action"] = result.response_privacy_action
            trace["response_masking_applied"] = result.response_masking_applied
            trace["response_masked_entity_count"] = result.response_masked_entity_count
            trace["restoration_applied"] = result.restoration_applied
            trace["restored_entity_count"] = result.restored_entity_count
            store.persist_state()
            return iter_buffered_events(result.events), response_headers
        except OpenAIError as exc:
            status = "budget_blocked" if exc.code == "budget_exceeded" else ("blocked" if exc.code in {"rate_limit_exceeded", "governance_unavailable"} else "failed")
            self._finish_trace(trace, status, exc.status_code, error_category=exc.code, started=started)
            trace.update(self._stream_trace_fields(completed=False, error_code=exc.code))
            await self.governance.release(governance.reservation_id if governance else None)
            if exc.code in FAILURE_CODES:
                await self.provider_health.record_failure(model_config.provider_id, exc.code)
            if exc.code in {"stream_response_privacy_blocked", "stream_privacy_scan_failed", "stream_buffer_limit_exceeded", "stream_event_too_large", "stream_malformed_response", "secure_streaming_unavailable"}:
                self._audit_gateway(key, f"privacy.{exc.code}", trace["id"], {"project_id": key["project_id"], "alias": request.model, "error_code": exc.code})
            if exc.code in {"rate_limit_exceeded", "budget_exceeded", "governance_unavailable"}:
                self._audit_gateway(key, f"governance.{exc.code}", trace["id"], {"project_id": key["project_id"], "alias": request.model, "action": "blocked"})
            store.persist_state()
            raise
        except Exception as exc:
            self._finish_trace(trace, "failed", 503, error_category="secure_streaming_unavailable", started=started)
            trace.update(self._stream_trace_fields(completed=False, error_code="secure_streaming_unavailable"))
            await self.governance.release(governance.reservation_id if governance else None)
            store.persist_state()
            from app.core.errors import secure_streaming_unavailable

            raise secure_streaming_unavailable() from exc

    async def embeddings(self, key: dict[str, Any], request: EmbeddingsRequest) -> tuple[dict[str, Any], dict[str, str]]:
        try:
            masked_request, privacy = self._masked_embeddings_request(request, key)
        except OpenAIError as exc:
            if exc.code == "pii_policy_blocked":
                findings = self.privacy.detector.detect(json.dumps(request.input))
                decision = self.privacy.evaluator.evaluate(key["project_id"], findings)
                self._create_privacy_block_trace(key, "embeddings", request.model, PrivacyRequestResult("", "", findings, decision, 0, 0, 0))
            raise
        decision = resolve_route(request.model, "embedding", key, {"external_egress_allowed": privacy.decision.external_egress_allowed})
        model_config = decision.model_config
        trace = self._create_trace(key, model_config, "embeddings", False, decision, privacy, privacy.sanitized_text if privacy.masked_count else None)
        started = time.perf_counter()
        governance: GovernanceDecision | None = None
        response_headers: dict[str, str] = {"X-IndusGate-Gateway-Request-Id": trace["id"], "X-IndusGate-Policy-Action": privacy.decision.action}
        try:
            governance = await self.governance.acquire(key=key, alias=model_config.alias, estimated_tokens=self.governance.estimate_tokens_for_embeddings(masked_request.input))
            trace.update(self._governance_trace_fields(governance))
            response_headers.update(governance.headers)
            body = await self._client_for(model_config).create_embeddings(masked_request, model_config)
            await self.provider_health.record_success(model_config.provider_id)
            public_body = self._public_embeddings_response(body, model_config.alias)
            self._finish_trace(trace, "completed", 200, public_body.get("usage"), started=started)
            actual_tokens = int((public_body.get("usage") or {}).get("total_tokens") or (governance.estimated_tokens if governance else 0))
            await self.governance.settle(governance.reservation_id if governance else None, actual_tokens)
            trace.update(self._governance_trace_fields(governance, settled=True))
            trace.update(self._privacy_trace_fields(privacy))
            store.persist_state()
            return public_body, response_headers
        except OpenAIError as exc:
            status = "budget_blocked" if exc.code == "budget_exceeded" else ("blocked" if exc.code in {"rate_limit_exceeded", "governance_unavailable"} else "failed")
            self._finish_trace(trace, status, exc.status_code, error_category=exc.code, started=started)
            await self.governance.release(governance.reservation_id if governance else None)
            if exc.code in FAILURE_CODES:
                await self.provider_health.record_failure(model_config.provider_id, exc.code)
            if exc.code in {"rate_limit_exceeded", "budget_exceeded", "governance_unavailable"}:
                self._audit_gateway(key, f"governance.{exc.code}", trace["id"], {"project_id": key["project_id"], "alias": request.model, "action": "blocked"})
            store.persist_state()
            raise
        except Exception as exc:
            self._finish_trace(trace, "failed", 503, error_category="provider_unavailable", started=started)
            await self.governance.release(governance.reservation_id if governance else None)
            await self.provider_health.record_failure(model_config.provider_id, "provider_unavailable")
            raise provider_unavailable() from exc
