"""Common error response shape and exception handler."""

import logging

from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.llm.openrouter import OpenRouterError

logger = logging.getLogger(__name__)


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict | None = None


def error_response(code: str, message: str, status_code: int = 400, details: dict | None = None) -> JSONResponse:
    """Return JSON error with consistent shape. Never expose secrets or stack traces."""
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "details": details},
    )


async def openrouter_exception_handler(request: Request, exc: OpenRouterError) -> JSONResponse:
    """Return structured error for OpenRouter failures; log request_id only, no prompt content."""
    request_id = getattr(request.state, "request_id", None)
    logger.warning(
        "OpenRouter error status_code=%s request_id=%s path=%s",
        exc.status_code,
        exc.request_id or request_id,
        request.url.path,
    )
    status_code = exc.status_code or 502
    if status_code == 401:
        code, msg = "LLM_AUTH_ERROR", "Błąd autoryzacji usługi LLM."
    elif status_code == 402:
        code, msg = "LLM_QUOTA_ERROR", "Niewystarczające środki w usłudze LLM."
    else:
        code, msg = "LLM_UNAVAILABLE", "Usługa LLM tymczasowo niedostępna. Spróbuj ponownie."
    return error_response(code=code, message=msg, status_code=status_code)


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unhandled exceptions; log with request_id; return safe message."""
    request_id = getattr(request.state, "request_id", None)
    logger.exception("Unhandled error request_id=%s path=%s", request_id, request.url.path)
    return error_response(
        code="INTERNAL_ERROR",
        message="Wystąpił błąd. Spróbuj ponownie.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
