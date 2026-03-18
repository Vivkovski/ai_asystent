"""Full ask pipeline: auth -> conversation/message -> intent -> sources -> fetch -> synthesis -> persist -> audit -> response."""

from typing import Any

from domain import chat as chat_domain
from domain import audit as audit_domain
from domain.integrations import load_config
from services.connectors.contract import ConnectorLimits
from services.connectors.runner import fetch_all
from services.routing.intent import classify_intent
from services.routing.source_selector import get_sources_for_intent
from services.llm import get_llm

LIMITS = ConnectorLimits()


async def run_ask(
    tenant_id: str,
    user_id: str,
    conversation_id: str | None,
    content: str,
) -> dict[str, Any]:
    """
    Run full pipeline. Create or load conversation; create user message; classify intent;
    get sources; fetch; synthesize; update message + answer_sources; return message + sources.
    """
    # Resolve conversation
    conv = None
    if conversation_id:
        conv = chat_domain.get_conversation(tenant_id, user_id, conversation_id)
    if not conv:
        conv = chat_domain.create_conversation(tenant_id, user_id)
        conversation_id = str(conv["id"])

    # Create user message (pending)
    user_msg = chat_domain.create_message(conversation_id, "user", content, status="pending")
    user_msg_id = str(user_msg["id"])

    # Intent + source selection
    intent = classify_intent(content)
    source_ids = get_sources_for_intent(tenant_id, intent)

    if not source_ids:
        chat_domain.update_message(user_msg_id, status="failed")
        assistant_content = "Brak podłączonych źródeł dla tego typu zapytania. Skonfiguruj integracje w panelu admin."
        assistant_msg = chat_domain.create_message(
            conversation_id, "assistant", assistant_content, status="completed"
        )
        return _response(assistant_msg, [], None)

    # Fetch from connectors
    outputs = await fetch_all(source_ids, tenant_id, content, LIMITS)
    all_fragments: list[tuple[str, str]] = []  # (label, text)
    idx = 1
    for out in outputs:
        label = f"[{idx}]"
        for f in out.fragments:
            all_fragments.append((label, f.content))
        idx += 1

    if not all_fragments:
        chat_domain.update_message(user_msg_id, status="failed")
        assistant_content = "Nie udało się pobrać danych z wybranych źródeł. Spróbuj ponownie lub sprawdź integracje."
        assistant_msg = chat_domain.create_message(
            conversation_id, "assistant", assistant_content, status="failed"
        )
        return _response(assistant_msg, [], "Jedno lub więcej źródeł niedostępne.")

    # Synthesis
    fragments_with_labels = [(label, text) for label, text in all_fragments]
    result = get_llm().synthesize_answer(content, fragments_with_labels)
    answer = result["answer"]
    cited_indices = result.get("cited_indices") or [1]

    # Build sources list (order by source order; mark unavailable from failed outputs)
    sources_meta = [out.source_metadata for out in outputs]
    sources_for_response = []
    for i, meta in enumerate(sources_meta):
        sources_for_response.append({
            "id": i + 1,
            "type": meta.type,
            "title": meta.title,
            "link": meta.link,
            "unavailable": not outputs[i].success,
        })

    # Persist assistant message
    assistant_content = answer
    status = "partial" if any(not o.success for o in outputs) else "completed"
    assistant_msg = chat_domain.create_message(
        conversation_id, "assistant", assistant_content, status=status
    )
    assistant_msg_id = str(assistant_msg["id"])

    # Persist answer_sources (one row per source)
    chat_domain.insert_answer_sources(assistant_msg_id, [
        {"type": out.source_metadata.type, "title": out.source_metadata.title, "link": out.source_metadata.link, "fragment_count": len(out.fragments)}
        for out in outputs
    ])

    # Audit: message_created (no question/answer text)
    try:
        audit_domain.log(
            tenant_id=tenant_id,
            user_id=user_id,
            action="message_created",
            resource_type="message",
            resource_id=assistant_msg_id,
            metadata={"sources_used": source_ids, "status": status},
        )
    except Exception:
        pass

    warning = "Jedno lub więcej źródeł tymczasowo niedostępne." if status == "partial" else None
    return _response(assistant_msg, sources_for_response, warning)


def _response(assistant_msg: dict, sources: list[dict], warning: str | None) -> dict:
    return {
        "message": {
            "id": assistant_msg["id"],
            "role": "assistant",
            "content": assistant_msg["content"],
            "answer": assistant_msg["content"],
            "sources": sources,
            "status": assistant_msg.get("status", "completed"),
            "created_at": assistant_msg["created_at"],
        },
        "warning": warning,
    }
