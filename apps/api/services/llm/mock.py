"""Mock LLM for dev/tests. No API key required."""

import re
from .interface import LLMInterface, SynthesisResult


class MockLLM(LLMInterface):
    def classify_intent(self, question: str) -> str:
        q = question.lower()
        if "dokument" in q or "plik" in q or "drive" in q:
            return "documents"
        if "arkusz" in q or "sheet" in q or "tabela" in q:
            return "spreadsheets"
        if "klient" in q or "deal" in q or "crm" in q or "bitrix" in q or "oferta" in q:
            return "crm"
        return "crm"

    def synthesize_answer(self, question: str, fragments_with_labels: list[tuple[str, str]]) -> SynthesisResult:
        if not fragments_with_labels:
            return {"answer": "Brak fragmentów do odpowiedzi.", "cited_indices": []}
        parts = [f"{label} {text}" for label, text in fragments_with_labels]
        combined = "\n\n".join(parts)
        indices = []
        for m in re.finditer(r"\[(\d+)\]", combined):
            idx = int(m.group(1))
            if 1 <= idx <= len(fragments_with_labels) and idx not in indices:
                indices.append(idx)
        if not indices:
            indices = [1]
        return {
            "answer": f"Na podstawie źródeł: {combined[:200]}...",
            "cited_indices": indices,
        }
