from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


class OpenAIError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_type: str = "invalid_request_error",
        code: str = "invalid_request",
        param: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.error_type = error_type
        self.code = code
        self.param = param
        self.headers = headers or {}


def openai_error_body(error: OpenAIError) -> dict[str, dict[str, str | None]]:
    return {
        "error": {
            "message": error.message,
            "type": error.error_type,
            "param": error.param,
            "code": error.code,
        }
    }


def invalid_api_key(message: str = "Invalid virtual key") -> OpenAIError:
    return OpenAIError(message, status_code=401, error_type="authentication_error", code="invalid_api_key")


def expired_api_key() -> OpenAIError:
    return OpenAIError("Virtual key has expired", status_code=401, error_type="authentication_error", code="expired_api_key")


def revoked_api_key() -> OpenAIError:
    return OpenAIError("Virtual key has been revoked", status_code=401, error_type="authentication_error", code="revoked_api_key")


def model_not_found() -> OpenAIError:
    return OpenAIError("The requested model does not exist", status_code=404, code="model_not_found", param="model")


def model_disabled() -> OpenAIError:
    return OpenAIError("The requested model alias is disabled", status_code=404, code="model_disabled", param="model")


def model_not_allowed() -> OpenAIError:
    return OpenAIError("The requested model is not allowed for this virtual key", status_code=403, code="model_not_allowed", param="model")


def model_capability_mismatch(message: str = "The requested model does not support this operation") -> OpenAIError:
    return OpenAIError(message, status_code=400, code="model_capability_mismatch", param="model")


def invalid_request(message: str, param: str | None = None) -> OpenAIError:
    return OpenAIError(message, status_code=400, code="invalid_request", param=param)


def provider_not_configured() -> OpenAIError:
    return OpenAIError("The selected provider is not configured", status_code=502, code="provider_not_configured")


def provider_authentication_error() -> OpenAIError:
    return OpenAIError("The selected provider rejected gateway authentication", status_code=502, code="provider_authentication_error")


def provider_timeout() -> OpenAIError:
    return OpenAIError("The selected provider timed out", status_code=503, code="provider_timeout")


def provider_unavailable() -> OpenAIError:
    return OpenAIError("The selected provider is unavailable", status_code=503, code="provider_unavailable")


def no_alias_targets() -> OpenAIError:
    return OpenAIError("No enabled targets are configured for this model alias.", status_code=404, error_type="routing_error", code="no_alias_targets", param="model")


def no_eligible_route() -> OpenAIError:
    return OpenAIError("No eligible route is available for this model alias.", status_code=403, error_type="routing_error", code="no_eligible_route", param="model")


def external_egress_blocked() -> OpenAIError:
    return OpenAIError("External egress is blocked for this model alias.", status_code=403, error_type="routing_error", code="external_egress_blocked", param="model")


def sovereignty_requirement_unsatisfied() -> OpenAIError:
    return OpenAIError("No route satisfies the sovereignty requirement for this model alias.", status_code=403, error_type="routing_error", code="sovereignty_requirement_unsatisfied", param="model")


def all_routes_failed() -> OpenAIError:
    return OpenAIError("All eligible routes failed.", status_code=503, error_type="routing_error", code="all_routes_failed", param="model")

def rate_limit_exceeded(message: str = "Rate limit exceeded.", headers: dict[str, str] | None = None) -> OpenAIError:
    return OpenAIError(message, status_code=429, error_type="rate_limit_error", code="rate_limit_exceeded", headers=headers)


def budget_exceeded(headers: dict[str, str] | None = None) -> OpenAIError:
    return OpenAIError("Project budget would be exceeded by this request.", status_code=429, error_type="rate_limit_error", code="budget_exceeded", headers=headers)


def governance_unavailable(headers: dict[str, str] | None = None) -> OpenAIError:
    return OpenAIError("Governance enforcement is unavailable.", status_code=429, error_type="rate_limit_error", code="governance_unavailable", headers=headers)


def pii_policy_blocked(message: str = "The request was blocked by the configured privacy policy.", code: str = "pii_policy_blocked") -> OpenAIError:
    return OpenAIError(message, status_code=403, error_type="privacy_policy_error", code=code)


def pii_detection_failed() -> OpenAIError:
    return OpenAIError("Privacy detection failed.", status_code=503, error_type="privacy_policy_error", code="pii_detection_failed")


def pii_masking_failed() -> OpenAIError:
    return OpenAIError("Privacy masking failed.", status_code=503, error_type="privacy_policy_error", code="pii_masking_failed")


def privacy_policy_not_configured() -> OpenAIError:
    return OpenAIError("Privacy policy is not configured.", status_code=503, error_type="privacy_policy_error", code="privacy_policy_not_configured")


def request_too_large(message: str = "Request text is too large.") -> OpenAIError:
    return OpenAIError(message, status_code=413, error_type="privacy_policy_error", code="request_too_large")


def secure_streaming_unavailable() -> OpenAIError:
    return OpenAIError("Secure response streaming is unavailable.", status_code=503, error_type="privacy_policy_error", code="secure_streaming_unavailable", param="stream")


def stream_buffer_limit_exceeded() -> OpenAIError:
    return OpenAIError("The streamed response exceeded the secure privacy buffer limit.", status_code=413, error_type="privacy_policy_error", code="stream_buffer_limit_exceeded")


def stream_event_too_large() -> OpenAIError:
    return OpenAIError("A provider stream event exceeded the secure privacy event limit.", status_code=413, error_type="privacy_policy_error", code="stream_event_too_large")


def stream_provider_timeout() -> OpenAIError:
    return OpenAIError("The provider stream timed out before privacy scanning could complete.", status_code=503, error_type="privacy_policy_error", code="stream_provider_timeout")


def stream_malformed_response() -> OpenAIError:
    return OpenAIError("The provider stream could not be assembled safely.", status_code=502, error_type="privacy_policy_error", code="stream_malformed_response")


def stream_privacy_scan_failed() -> OpenAIError:
    return OpenAIError("The streamed response privacy scan failed.", status_code=503, error_type="privacy_policy_error", code="stream_privacy_scan_failed")


def stream_response_privacy_blocked() -> OpenAIError:
    return OpenAIError("The streamed response was blocked by the privacy policy.", status_code=403, error_type="privacy_policy_error", code="stream_response_privacy_blocked")


def internal_error() -> OpenAIError:
    return OpenAIError("Internal gateway error", status_code=500, code="internal_error")


async def openai_exception_handler(request: Request, exc: OpenAIError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=openai_error_body(exc), headers=exc.headers)


async def validation_exception_handler(request: Request, exc: RequestValidationError | ValidationError) -> JSONResponse:
    message = "Invalid request body"
    param = None
    errors = exc.errors()
    if errors:
        first = errors[0]
        loc = first.get("loc", [])
        param = str(loc[-1]) if loc else None
        message = str(first.get("msg", message))
    error = invalid_request(message, param)
    return JSONResponse(status_code=error.status_code, content=openai_error_body(error))


def register_openai_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(OpenAIError, openai_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
