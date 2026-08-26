from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI(title="Mock OpenAI-Compatible Provider")


@app.get("/v1/models")
async def models():
    return {"object": "list", "data": [{"id": "mock-model", "object": "model", "owned_by": "mock"}]}


@app.post("/v1/chat/completions")
async def chat_completions(payload: dict):
    model = payload["model"]
    if payload.get("stream"):
        async def events() -> AsyncIterator[str]:
            chunk = {
                "id": "mock-stream",
                "object": "chat.completion.chunk",
                "model": model,
                "choices": [{"index": 0, "delta": {"content": "Mock streaming response"}, "finish_reason": None}],
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(events(), media_type="text/event-stream")
    return {
        "id": "mock-chat",
        "object": "chat.completion",
        "model": model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": "Mock provider response"}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 6, "completion_tokens": 4, "total_tokens": 10},
    }


@app.post("/v1/embeddings")
async def embeddings(payload: dict):
    values = payload["input"] if isinstance(payload["input"], list) else [payload["input"]]
    return {
        "object": "list",
        "data": [{"object": "embedding", "index": index, "embedding": [0.012, -0.043]} for index, _ in enumerate(values)],
        "model": payload["model"],
        "usage": {"prompt_tokens": len(" ".join(values).split()), "total_tokens": len(" ".join(values).split())},
    }
