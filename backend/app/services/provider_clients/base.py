from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Protocol

from app.schemas.openai import ChatCompletionRequest, EmbeddingsRequest
from app.services.model_registry import ModelConfig


class BaseProviderClient(Protocol):
    async def chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> dict[str, Any]:
        ...

    async def stream_chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> AsyncIterator[dict[str, Any] | str]:
        ...

    async def create_embeddings(self, request: EmbeddingsRequest, model_config: ModelConfig) -> dict[str, Any]:
        ...
