"""
FastAPI backend for AI Assistant.
Orchestration, auth, and Supabase server-side usage.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from config import settings
from api.v1 import me
from api.v1.admin import integrations as admin_integrations
from api.v1.admin import google_oauth as admin_google_oauth
from api.v1 import conversations
from api.v1 import messages
from api.errors import global_exception_handler, openrouter_exception_handler
from middleware import RequestIdMiddleware, setup_logging
from services.llm.openrouter import OpenRouterError
from services.connectors.registry import register_adapters

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    register_adapters()
    logger.info("Adapters registered")
    yield


app = FastAPI(
    title="AI Assistant API",
    description="Backend for Flixhome AI Assistant",
    version="0.0.1",
    lifespan=lifespan,
)
app.add_middleware(RequestIdMiddleware)
app.add_exception_handler(OpenRouterError, openrouter_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

app.include_router(me.router, prefix="/api/v1")
app.include_router(admin_integrations.router, prefix="/api/v1")
app.include_router(admin_google_oauth.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")


@app.get("/health")
def health(debug: str | None = None) -> dict:
    """GET /health — status. GET /health?debug=1 — status + czy env ustawione (diagnostyka)."""
    out: dict = {"status": "ok"}
    if debug == "1":
        out["auth_config"] = {
            "supabase_url_set": bool(settings.supabase_url),
            "supabase_key_set": bool(settings.supabase_key),
            "supabase_jwt_secret_set": bool(settings.supabase_jwt_secret),
        }
    return out


@app.get("/api/v1/debug-auth-config")
def debug_auth_config() -> dict[str, bool]:
    """Diagnostyka: czy backend widzi env (bez ujawniania sekretów). Usuń w produkcji."""
    return {
        "supabase_url_set": bool(settings.supabase_url),
        "supabase_key_set": bool(settings.supabase_key),
        "supabase_jwt_secret_set": bool(settings.supabase_jwt_secret),
    }
