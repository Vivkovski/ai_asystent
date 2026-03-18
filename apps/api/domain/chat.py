"""Conversations and messages persistence. Tenant- and user-scoped."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from domain.integrations import _client

def _serialize(row: dict) -> dict:
    d = dict(row)
    for k, v in list(d.items()):
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat() if v else None
        elif hasattr(v, "hex"):
            d[k] = str(v)
    return d


def create_conversation(tenant_id: str, user_id: str, title: str | None = None) -> dict[str, Any]:
    client = _client()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    r = client.table("conversations").insert({
        "tenant_id": tenant_id,
        "user_id": user_id,
        "title": title,
        "updated_at": now,
    }).execute()
    if not r.data or len(r.data) != 1:
        raise ValueError("Insert failed")
    return _serialize(r.data[0])


def get_conversation(tenant_id: str, user_id: str, conversation_id: str) -> dict | None:
    client = _client()
    r = (
        client.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return _serialize(r.data) if r.data else None


def list_conversations(tenant_id: str, user_id: str, limit: int = 50) -> list[dict]:
    client = _client()
    r = (
        client.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [_serialize(row) for row in (r.data or [])]


def create_message(
    conversation_id: str,
    role: str,
    content: str,
    status: str | None = "pending",
) -> dict[str, Any]:
    client = _client()
    r = client.table("messages").insert({
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "status": status,
    }).execute()
    if not r.data or len(r.data) != 1:
        raise ValueError("Insert failed")
    return _serialize(r.data[0])


def update_message(message_id: str, content: str | None = None, status: str | None = None) -> None:
    client = _client()
    updates: dict = {}
    if content is not None:
        updates["content"] = content
    if status is not None:
        updates["status"] = status
    if not updates:
        return
    client.table("messages").update(updates).eq("id", message_id).execute()


def get_messages(conversation_id: str) -> list[dict]:
    client = _client()
    r = (
        client.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    return [_serialize(row) for row in (r.data or [])]


def insert_answer_sources(
    message_id: str,
    sources: list[dict],
) -> None:
    """sources: list of {source_type, title, link, fragment_count}."""
    if not sources:
        return
    client = _client()
    rows = [
        {
            "message_id": message_id,
            "source_type": s.get("type", "unknown"),
            "title": s.get("title", ""),
            "link": s.get("link"),
            "fragment_count": s.get("fragment_count", 0),
        }
        for s in sources
    ]
    client.table("answer_sources").insert(rows).execute()
