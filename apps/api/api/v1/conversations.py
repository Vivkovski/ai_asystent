"""Conversations: list, get one, create (optional)."""

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_context
from core.context import CurrentContext
from domain import chat as chat_domain

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def list_conversations(
    ctx: CurrentContext = Depends(get_current_context),
    limit: int = 50,
):
    """List current user's conversations (tenant-scoped)."""
    items = chat_domain.list_conversations(ctx.tenant_id, ctx.user_id, limit=limit)
    return {"items": items}


@router.post("")
def create_conversation(
    body: dict | None = None,
    ctx: CurrentContext = Depends(get_current_context),
):
    """Create a new conversation. Optional body: { "title": "..." }."""
    title = (body or {}).get("title") if isinstance(body, dict) else None
    conv = chat_domain.create_conversation(ctx.tenant_id, ctx.user_id, title=title)
    return conv


@router.get("/{conversation_id}")
def get_conversation(
  conversation_id: str,
  ctx: CurrentContext = Depends(get_current_context),
):
    """Get one conversation with messages. 404 if not found or not own."""
    conv = chat_domain.get_conversation(ctx.tenant_id, ctx.user_id, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    messages = chat_domain.get_messages(conversation_id)
    conv["messages"] = messages
    return conv
