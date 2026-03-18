"""LLM abstraction: intent classification and answer synthesis."""

from typing import TypedDict


class SynthesisResult(TypedDict):
    answer: str
    cited_indices: list[int]


class LLMInterface:
    def classify_intent(self, question: str) -> str:
        """Return one of: crm, documents, spreadsheets, mixed."""
        ...

    def synthesize_answer(self, question: str, fragments_with_labels: list[tuple[str, str]]) -> SynthesisResult:
        """fragments_with_labels: [(label, text), ...] e.g. [("[1]", "content"), ("[2]", "content")]. Return answer and cited indices."""
        ...
