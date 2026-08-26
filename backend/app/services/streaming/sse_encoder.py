from __future__ import annotations

import json
from typing import Any

from app.services.streaming.chunk_assembler import AssembledStream


def _event(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, separators=(',', ':'))}\n\n"


def _chunk_base(stream: AssembledStream, public_model: str) -> dict[str, Any]:
    return {
        "id": stream.response_id,
        "object": "chat.completion.chunk",
        "created": stream.created,
        "model": public_model,
        "choices": [],
    }


def encode_sse(stream: AssembledStream, public_model: str, *, content: str, chunk_characters: int, tool_calls: list[dict[str, Any]] | None = None) -> list[str]:
    events: list[str] = []
    role = _chunk_base(stream, public_model)
    role["choices"] = [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}]
    events.append(_event(role))

    if content:
        for start in range(0, len(content), chunk_characters):
            part = content[start:start + chunk_characters]
            if not part:
                continue
            chunk = _chunk_base(stream, public_model)
            chunk["choices"] = [{"index": 0, "delta": {"content": part}, "finish_reason": None}]
            events.append(_event(chunk))

    if tool_calls:
        for item in tool_calls:
            chunk = _chunk_base(stream, public_model)
            chunk["choices"] = [{"index": 0, "delta": {"tool_calls": [item]}, "finish_reason": None}]
            events.append(_event(chunk))

    final = _chunk_base(stream, public_model)
    final["choices"] = [{"index": 0, "delta": {}, "finish_reason": stream.finish_reason}]
    if stream.usage:
        final["usage"] = stream.usage
    events.append(_event(final))
    events.append("data: [DONE]\n\n")
    return events
