from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from app import store
from app.core.config import Settings
from app.core.errors import OpenAIError, secure_streaming_unavailable, stream_privacy_scan_failed, stream_provider_timeout, stream_response_privacy_blocked
from app.services.privacy.masker import PIIMasker
from app.services.privacy.service import PrivacyFirewall, PrivacyRequestResult, ResponseScanResult
from app.services.streaming.chunk_assembler import AssembledStream, OpenAIStreamAssembler
from app.services.streaming.sse_encoder import encode_sse


@dataclass
class BufferedStreamResult:
    events: list[str]
    assembled: AssembledStream
    response_scan: ResponseScanResult | None
    response_privacy_action: str
    response_masking_applied: bool
    response_masked_entity_count: int
    restoration_applied: bool
    restored_entity_count: int


class SecureBufferedStreamer:
    def __init__(self, settings: Settings, privacy: PrivacyFirewall) -> None:
        self.settings = settings
        self.privacy = privacy

    async def process(
        self,
        *,
        upstream: AsyncIterator[dict[str, Any] | str],
        project_id: str,
        public_model: str,
        request_privacy: PrivacyRequestResult,
    ) -> BufferedStreamResult:
        if not self.settings.streaming_privacy_enabled or self.settings.streaming_privacy_mode != "buffered":
            raise secure_streaming_unavailable()
        assembler = OpenAIStreamAssembler(
            max_event_bytes=self.settings.streaming_max_event_bytes,
            max_buffer_characters=self.settings.streaming_max_buffer_characters,
        )
        try:
            async with asyncio.timeout(self.settings.streaming_provider_timeout_seconds):
                async for event in upstream:
                    if event == "[DONE]":
                        break
                    assembler.add_event(event)
            assembled = assembler.assemble()
            scan = self._scan_assembled(project_id, assembled)
            safe_content = scan.text if scan else assembled.content
            safe_tool_calls = self._scan_tool_calls(project_id, assembled.tool_calls)
            events = encode_sse(
                assembled,
                public_model,
                content=safe_content,
                chunk_characters=max(1, self.settings.streaming_output_chunk_characters),
                tool_calls=safe_tool_calls,
            )
            return BufferedStreamResult(
                events=events,
                assembled=assembled,
                response_scan=scan,
                response_privacy_action=scan.action if scan else "allow",
                response_masking_applied=bool(scan and scan.masked_count),
                response_masked_entity_count=scan.masked_count if scan else 0,
                restoration_applied=False,
                restored_entity_count=0,
            )
        except TimeoutError as exc:
            raise stream_provider_timeout() from exc
        except OpenAIError:
            raise
        except Exception as exc:
            raise stream_privacy_scan_failed() from exc
        finally:
            assembler.content_parts.clear()
            assembler.tool_calls.clear()

    def _scan_assembled(self, project_id: str, assembled: AssembledStream) -> ResponseScanResult | None:
        findings = self.privacy.detector.detect(assembled.content)
        if not findings:
            return ResponseScanResult(assembled.content, [], 0, "allow")
        decision = self.privacy.evaluator.evaluate(project_id, findings)
        if decision.action == "block":
            raise stream_response_privacy_blocked()
        masked = PIIMasker().mask(assembled.content, findings)
        return ResponseScanResult(masked.text, findings, masked.masked_count, "mask")

    def _scan_tool_calls(self, project_id: str, tool_calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
        safe_calls: list[dict[str, Any]] = []
        for item in tool_calls:
            safe = dict(item)
            function = dict(safe.get("function") or {})
            arguments = function.get("arguments")
            if isinstance(arguments, str) and arguments:
                findings = self.privacy.detector.detect(arguments)
                if findings:
                    decision = self.privacy.evaluator.evaluate(project_id, findings)
                    if decision.action == "block":
                        raise stream_response_privacy_blocked()
                    masked = PIIMasker().mask(arguments, findings)
                    try:
                        json.loads(masked.text)
                    except json.JSONDecodeError as exc:
                        raise stream_response_privacy_blocked() from exc
                    function["arguments"] = masked.text
            safe["function"] = function
            safe_calls.append(safe)
        return safe_calls


async def iter_buffered_events(events: list[str]) -> AsyncIterator[str]:
    try:
        for event in events:
            yield event
    finally:
        events.clear()
