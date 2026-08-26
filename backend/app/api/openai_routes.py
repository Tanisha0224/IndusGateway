from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse

from app.core.authentication import current_virtual_key
from app.schemas.openai import ChatCompletionRequest, EmbeddingsRequest
from app.services.gateway_service import GatewayService

router = APIRouter(prefix="/v1", tags=["openai-compatible"])


def get_gateway_service() -> GatewayService:
    return GatewayService()


@router.get("/models")
def list_models(key: dict = Depends(current_virtual_key), service: GatewayService = Depends(get_gateway_service)) -> dict:
    return service.list_models(key)


@router.post("/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    response: Response,
    key: dict = Depends(current_virtual_key),
    service: GatewayService = Depends(get_gateway_service),
):
    if request.stream:
        events, headers = await service.stream_chat_completion(key, request)
        return StreamingResponse(events, media_type="text/event-stream", headers=headers)
    body, headers = await service.chat_completion(key, request)
    for name, value in headers.items():
        response.headers[name] = value
    return body


@router.post("/embeddings")
async def embeddings(
    request: EmbeddingsRequest,
    response: Response,
    key: dict = Depends(current_virtual_key),
    service: GatewayService = Depends(get_gateway_service),
) -> dict:
    body, headers = await service.embeddings(key, request)
    for name, value in headers.items():
        response.headers[name] = value
    return body
