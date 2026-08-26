from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.errors import stream_event_too_large, stream_malformed_response


@dataclass
class ToolCallBuffer:
    index: int
    id: str | None = None
    type: str = "function"
    name: str = ""
    arguments: str = ""


@dataclass
class AssembledStream:
    response_id: str
    created: int
    provider_model: str | None
    role: str = "assistant"
    content: str = ""
    finish_reason: str | None = "stop"
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, Any] | None = None
    chunk_count: int = 0


class OpenAIStreamAssembler:
    def __init__(self, *, max_event_bytes: int, max_buffer_characters: int) -> None:
        self.max_event_bytes = max_event_bytes
        self.max_buffer_characters = max_buffer_characters
        self.response_id: str | None = None
        self.created: int | None = None
        self.provider_model: str | None = None
        self.role = "assistant"
        self.content_parts: list[str] = []
        self.finish_reason: str | None = None
        self.usage: dict[str, Any] | None = None
        self.chunk_count = 0
        self.tool_calls: dict[int, ToolCallBuffer] = {}

    def add_event(self, event: dict[str, Any] | str) -> None:
        if isinstance(event, str):
            if len(event.encode("utf-8")) > self.max_event_bytes:
                raise stream_event_too_large()
            try:
                event = json.loads(event)
            except json.JSONDecodeError as exc:
                raise stream_malformed_response() from exc
        if not isinstance(event, dict):
            raise stream_malformed_response()
        self.chunk_count += 1
        self.response_id = self.response_id or str(event.get("id") or f"chatcmpl-{int(time.time())}")
        self.created = self.created or int(event.get("created") or time.time())
        self.provider_model = self.provider_model or event.get("model")
        if isinstance(event.get("usage"), dict):
            self.usage = event["usage"]
        choices = event.get("choices")
        if not isinstance(choices, list):
            return
        for choice in choices:
            if not isinstance(choice, dict):
                continue
            if choice.get("finish_reason") is not None:
                self.finish_reason = str(choice["finish_reason"])
            delta = choice.get("delta") or {}
            if not isinstance(delta, dict):
                continue
            if isinstance(delta.get("role"), str):
                self.role = delta["role"]
            if isinstance(delta.get("content"), str):
                self.content_parts.append(delta["content"])
                if len(self.content) > self.max_buffer_characters:
                    from app.core.errors import stream_buffer_limit_exceeded

                    raise stream_buffer_limit_exceeded()
            self._add_tool_calls(delta.get("tool_calls"))

    @property
    def content(self) -> str:
        return "".join(self.content_parts)

    def assemble(self) -> AssembledStream:
        return AssembledStream(
            response_id=self.response_id or f"chatcmpl-{int(time.time())}",
            created=self.created or int(time.time()),
            provider_model=self.provider_model,
            role=self.role,
            content=self.content,
            finish_reason=self.finish_reason or "stop",
            tool_calls=[self._tool_call_json(item) for _, item in sorted(self.tool_calls.items())],
            usage=self.usage,
            chunk_count=self.chunk_count,
        )

    def _add_tool_calls(self, items: Any) -> None:
        if not isinstance(items, list):
            return
        for item in items:
            if not isinstance(item, dict):
                continue
            index = int(item.get("index", 0))
            current = self.tool_calls.setdefault(index, ToolCallBuffer(index=index))
            if isinstance(item.get("id"), str):
                current.id = item["id"]
            if isinstance(item.get("type"), str):
                current.type = item["type"]
            function = item.get("function")
            if isinstance(function, dict):
                if isinstance(function.get("name"), str):
                    current.name += function["name"]
                if isinstance(function.get("arguments"), str):
                    current.arguments += function["arguments"]
                    if len(current.arguments) > self.max_buffer_characters:
                        from app.core.errors import stream_buffer_limit_exceeded

                        raise stream_buffer_limit_exceeded()

    def _tool_call_json(self, item: ToolCallBuffer) -> dict[str, Any]:
        return {
            "index": item.index,
            "id": item.id or f"call_{item.index}",
            "type": item.type,
            "function": {"name": item.name, "arguments": item.arguments},
        }
