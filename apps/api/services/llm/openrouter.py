"""OpenRouter LLM client: intent classification and answer synthesis."""

import logging
import re
from pathlib import Path
from typing import Any

import httpx

from config import Settings
from services.llm.interface import LLMInterface, SynthesisResult

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
VALID_INTENTS = ("crm", "documents", "spreadsheets", "mixed")
DEFAULT_INTENT = "crm"
MAX_TOKENS_INTENT = 10
MAX_TOKENS_SYNTHESIS = 2048
TIMEOUT_SECONDS = 60.0

logger = logging.getLogger(__name__)


def _prompts_dir() -> Path:
    """Repo root is 5 levels up from this file (llm -> services -> api -> apps -> repo)."""
    return Path(__file__).resolve().parent.parent.parent.parent.parent / "packages" / "prompts"


def _load_prompt(name: str) -> str:
    path = _prompts_dir() / name
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text(encoding="utf-8").strip()


class OpenRouterError(Exception):
    """OpenRouter API or response error."""

    def __init__(self, message: str, status_code: int | None = None, request_id: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.request_id = request_id


class OpenRouterLLM(LLMInterface):
    """LLM via OpenRouter (OpenAI-compatible API)."""

    def __init__(self, settings: Settings) -> None:
        if not settings.openrouter_api_key:
            raise ValueError("openrouter_api_key is required for OpenRouterLLM")
        self._api_key = settings.openrouter_api_key
        self._model = settings.openrouter_model or "openai/gpt-4o-mini"
        self._intent_prompt: str | None = None
        self._synthesis_prompt: str | None = None

    def _get_intent_prompt(self) -> str:
        if self._intent_prompt is None:
            self._intent_prompt = _load_prompt("intent-classification.txt")
        return self._intent_prompt

    def _get_synthesis_prompt(self) -> str:
        if self._synthesis_prompt is None:
            self._synthesis_prompt = _load_prompt("answer-synthesis.txt")
        return self._synthesis_prompt

    def _chat(self, messages: list[dict[str, str]], max_tokens: int) -> str:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.2,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/flixhome-asystent",
        }
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.post(
                f"{OPENROUTER_BASE}/chat/completions",
                json=payload,
                headers=headers,
            )
        request_id = response.headers.get("x-request-id") or response.headers.get("openrouter-request-id")
        if response.status_code == 401:
            logger.warning("OpenRouter 401 Unauthorized", extra={"request_id": request_id})
            raise OpenRouterError("OpenRouter authentication failed", status_code=401, request_id=request_id)
        if response.status_code == 402:
            logger.warning("OpenRouter 402 Payment required", extra={"request_id": request_id})
            raise OpenRouterError("OpenRouter insufficient credits", status_code=402, request_id=request_id)
        if response.status_code >= 400:
            logger.warning(
                "OpenRouter API error",
                extra={"status_code": response.status_code, "request_id": request_id},
            )
            raise OpenRouterError(
                f"OpenRouter API error: {response.status_code}",
                status_code=response.status_code,
                request_id=request_id,
            )
        data = response.json()
        choices = data.get("choices")
        if not choices or not isinstance(choices, list):
            raise OpenRouterError("OpenRouter response missing choices", request_id=request_id)
        content = choices[0].get("message", {}).get("content")
        if content is None:
            raise OpenRouterError("OpenRouter response missing message content", request_id=request_id)
        return content.strip() if isinstance(content, str) else str(content).strip()

    def classify_intent(self, question: str) -> str:
        system = self._get_intent_prompt()
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": question},
        ]
        raw = self._chat(messages, max_tokens=MAX_TOKENS_INTENT)
        label = raw.split()[0].lower().strip() if raw else ""
        # Normalize: only first word, must be valid intent
        for intent in VALID_INTENTS:
            if intent in label or label == intent:
                return intent
        return DEFAULT_INTENT

    def synthesize_answer(
        self, question: str, fragments_with_labels: list[tuple[str, str]]
    ) -> SynthesisResult:
        if not fragments_with_labels:
            return {"answer": "Brak fragmentów do odpowiedzi.", "cited_indices": []}
        system = self._get_synthesis_prompt()
        parts = [f"{label} {text}" for label, text in fragments_with_labels]
        user_content = f"Question: {question}\n\nFragments:\n" + "\n\n".join(parts)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ]
        answer = self._chat(messages, max_tokens=MAX_TOKENS_SYNTHESIS)
        indices: list[int] = []
        for m in re.finditer(r"\[(\d+)\]", answer):
            idx = int(m.group(1))
            if 1 <= idx <= len(fragments_with_labels) and idx not in indices:
                indices.append(idx)
        if not indices:
            indices = [1]
        return {"answer": answer, "cited_indices": indices}
