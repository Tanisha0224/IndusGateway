from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.core.errors import provider_not_configured
from app.schemas.openai import ChatCompletionRequest, EmbeddingsRequest
from app.services.model_registry import ModelConfig


class GeminiProviderClient:
    async def chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> dict[str, Any]:
        raise provider_not_configured()

    async def stream_chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> AsyncIterator[dict[str, Any] | str]:
        raise provider_not_configured()
        yield {}

    async def create_embeddings(self, request: EmbeddingsRequest, model_config: ModelConfig) -> dict[str, Any]:
        raise provider_not_configured()
