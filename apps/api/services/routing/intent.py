"""Intent classification via LLM (or mock)."""

from services.llm import get_llm


def classify_intent(question: str) -> str:
    """Return one of crm, documents, spreadsheets, mixed. Never query-all fallback."""
    label = get_llm().classify_intent(question)
    if label not in ("crm", "documents", "spreadsheets", "mixed"):
        return "crm"
    return label
