"""Load prompt text and taxonomy from packages/prompts. Path from env or default relative to repo."""

import os
from pathlib import Path

PROMPTS_ENV = "PROMPTS_PATH"

def _prompts_dir() -> Path:
    raw = os.environ.get(PROMPTS_ENV)
    if raw:
        return Path(raw)
    # Default: repo root / packages / prompts (from apps/api: ../../packages/prompts)
    return Path(__file__).resolve().parent.parent.parent.parent / "packages" / "prompts"


def load_intent_classification_prompt() -> str:
    p = _prompts_dir() / "intent-classification.txt"
    if not p.exists():
        return "Respond with one word: crm, documents, spreadsheets, or mixed."
    return p.read_text(encoding="utf-8").strip()


def load_synthesis_prompt() -> str:
    p = _prompts_dir() / "answer-synthesis.txt"
    if not p.exists():
        return "Answer based only on the provided fragments. Cite sources as [1], [2]."
    return p.read_text(encoding="utf-8").strip()


def get_intent_labels() -> list[str]:
    return ["crm", "documents", "spreadsheets", "mixed"]
