"""Ask: POST /conversations/:id/messages - full pipeline."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_context
from core.context import CurrentContext
from domain import chat as chat_domain
from services.orchestration.ask import run_ask

router = APIRouter(tags=["messages"])


@router.post("/conversations/{conversation_id}/messages")
async def ask(
  conversation_id: str,
  body: dict,
  ctx: CurrentContext = Depends(get_current_context),
):
    """
    Send a message (ask). Body: { "content": "user question" }.
    Runs: intent -> source selection -> connector fetch -> synthesis -> persist.
    Returns assistant message + sources.
    """
    content = body.get("content") if isinstance(body, dict) else None
    if not content or not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=400, detail="content required")
    conv = chat_domain.get_conversation(ctx.tenant_id, ctx.user_id, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    result = await run_ask(
        ctx.tenant_id,
        ctx.user_id,
        conversation_id,
        content.strip(),
    )
    return result
