from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from app.schemas.openai import ChatCompletionRequest, EmbeddingsRequest
from app.services.model_registry import ModelConfig


class DemoProviderClient:
    async def chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> dict[str, Any]:
        user_text = self._latest_user_text(request)
        content = (
            "Demo provider response: the gateway accepted this request, applied policy checks, "
            "routed it to the local demo provider, and wrote a full audit trace. "
            f"Prompt preview: {user_text[:160]}"
        )
        prompt_tokens = max(1, len(json.dumps([message.model_dump(exclude_none=True) for message in request.messages])) // 4)
        completion_tokens = max(18, len(content) // 4)
        return {
            "id": f"chatcmpl-demo-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "model": model_config.provider_model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    async def stream_chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> AsyncIterator[dict[str, Any] | str]:
        body = await self.chat_completion(request, model_config)
        content = body["choices"][0]["message"]["content"]
        for index in range(0, len(content), 48):
            yield json.dumps({
                "id": body["id"],
                "object": "chat.completion.chunk",
                "model": model_config.provider_model,
                "choices": [{"index": 0, "delta": {"content": content[index:index + 48]}, "finish_reason": None}],
            })
        yield "[DONE]"

    async def create_embeddings(self, request: EmbeddingsRequest, model_config: ModelConfig) -> dict[str, Any]:
        values = [request.input] if isinstance(request.input, str) else request.input
        return {
            "object": "list",
            "model": model_config.provider_model,
            "data": [{"object": "embedding", "index": index, "embedding": [0.01, 0.02, 0.03]} for index, _ in enumerate(values)],
            "usage": {"prompt_tokens": sum(max(1, len(value) // 4) for value in values), "total_tokens": sum(max(1, len(value) // 4) for value in values)},
        }

    def _latest_user_text(self, request: ChatCompletionRequest) -> str:
        for message in reversed(request.messages):
            if message.role != "user":
                continue
            if isinstance(message.content, str):
                return message.content
            if isinstance(message.content, list):
                return " ".join(str(part.get("text", "")) for part in message.content if isinstance(part, dict))
        return "No user prompt supplied."
