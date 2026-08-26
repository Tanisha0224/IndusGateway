from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import Settings
from app import store
from app.core.errors import provider_authentication_error, provider_not_configured, provider_timeout, provider_unavailable
from app.schemas.openai import ChatCompletionRequest, EmbeddingsRequest
from app.services.model_registry import ModelConfig


PASSTHROUGH_CHAT_FIELDS = (
    "temperature",
    "top_p",
    "max_tokens",
    "stop",
    "stream",
    "user",
    "frequency_penalty",
    "presence_penalty",
    "response_format",
    "tools",
    "tool_choice",
    "seed",
)


class OpenAICompatibleProviderClient:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.settings = settings
        self.transport = transport

    def _provider_settings(self, model_config: ModelConfig) -> tuple[str, str]:
        if model_config.provider_id == "provider-openai":
            return self.settings.openai_base_url, self.settings.openai_api_key
        if model_config.provider_id == "provider-india-hosted":
            base_url = self.settings.india_hosted_llm_base_url or model_config.provider.get("base_url", "")
            return base_url, self.settings.india_hosted_llm_api_key or store.get_provider_api_key(model_config.provider_id)
        return str(model_config.provider.get("base_url", "")), store.get_provider_api_key(model_config.provider_id)

    def _client(self, model_config: ModelConfig) -> httpx.AsyncClient:
        base_url, api_key = self._provider_settings(model_config)
        if not base_url or not api_key:
            raise provider_not_configured()
        timeout = httpx.Timeout(
            connect=self.settings.gateway_connect_timeout_seconds,
            read=self.settings.gateway_read_timeout_seconds,
            write=self.settings.gateway_connect_timeout_seconds,
            pool=self.settings.gateway_connect_timeout_seconds,
        )
        return httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers={"Authorization": f"Bearer {api_key}"},
            transport=self.transport,
        )

    def _chat_payload(self, request: ChatCompletionRequest, model_config: ModelConfig) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model_config.provider_model,
            "messages": [message.model_dump(exclude_none=True) for message in request.messages],
        }
        data = request.model_dump(exclude_none=True)
        for field in PASSTHROUGH_CHAT_FIELDS:
            if field in data:
                payload[field] = data[field]
        return payload

    async def chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> dict[str, Any]:
        payload = self._chat_payload(request, model_config)
        payload["stream"] = False
        try:
            async with self._client(model_config) as client:
                response = await client.post("/chat/completions", json=payload)
        except httpx.TimeoutException as exc:
            raise provider_timeout() from exc
        except httpx.HTTPError as exc:
            raise provider_unavailable() from exc
        if response.status_code in {401, 403}:
            raise provider_authentication_error()
        if response.status_code >= 500:
            raise provider_unavailable()
        if response.status_code >= 400:
            raise provider_unavailable()
        return response.json()

    async def stream_chat_completion(self, request: ChatCompletionRequest, model_config: ModelConfig) -> AsyncIterator[dict[str, Any] | str]:
        payload = self._chat_payload(request, model_config)
        payload["stream"] = True
        try:
            async with self._client(model_config) as client:
                async with client.stream("POST", "/chat/completions", json=payload) as response:
                    if response.status_code in {401, 403}:
                        raise provider_authentication_error()
                    if response.status_code >= 400:
                        raise provider_unavailable()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if not line.startswith("data: "):
                            continue
                        data = line.removeprefix("data: ").strip()
                        if data == "[DONE]":
                            yield "[DONE]"
                            return
                        yield response.json() if False else data
        except httpx.TimeoutException as exc:
            raise provider_timeout() from exc
        except httpx.HTTPError as exc:
            raise provider_unavailable() from exc

    async def create_embeddings(self, request: EmbeddingsRequest, model_config: ModelConfig) -> dict[str, Any]:
        payload = request.model_dump(exclude_none=True)
        payload["model"] = model_config.provider_model
        try:
            async with self._client(model_config) as client:
                response = await client.post("/embeddings", json=payload)
        except httpx.TimeoutException as exc:
            raise provider_timeout() from exc
        except httpx.HTTPError as exc:
            raise provider_unavailable() from exc
        if response.status_code in {401, 403}:
            raise provider_authentication_error()
        if response.status_code >= 400:
            raise provider_unavailable()
        return response.json()
