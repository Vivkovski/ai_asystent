"""Unit tests for OpenRouterLLM with mocked HTTP."""

from unittest.mock import MagicMock, patch

import pytest

from config import Settings
from services.llm.openrouter import OpenRouterError, OpenRouterLLM


def _make_response(status_code: int = 200, json_data: dict | None = None, headers: dict | None = None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.headers = headers or {}
    resp.json.return_value = json_data or {}
    return resp


def _chat_completion_response(content: str) -> dict:
    return {
        "choices": [
            {"message": {"role": "assistant", "content": content}}
        ],
    }


@pytest.fixture
def openrouter_settings():
    return Settings(
        openrouter_api_key="sk-test-key",
        openrouter_model="openai/gpt-4o-mini",
    )


@pytest.fixture
def llm(openrouter_settings):
    return OpenRouterLLM(openrouter_settings)


def test_classify_intent_returns_valid_label(llm):
    """classify_intent returns normalized intent from API response."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(
            json_data=_chat_completion_response("crm"),
        )
        label = llm.classify_intent("Kto jest klientem?")
        assert label == "crm"
        assert mock_client.post.called


def test_classify_intent_normalizes_documents(llm):
    """classify_intent normalizes 'documents' from response."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(
            json_data=_chat_completion_response("documents"),
        )
        label = llm.classify_intent("Gdzie są pliki?")
        assert label == "documents"


def test_classify_intent_fallback_when_invalid(llm):
    """classify_intent falls back to crm when response is not a valid intent."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(
            json_data=_chat_completion_response("unknown_label"),
        )
        label = llm.classify_intent("Something random")
        assert label == "crm"


def test_synthesize_answer_returns_answer_and_cited_indices(llm):
    """synthesize_answer returns SynthesisResult with answer and cited_indices from response."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(
            json_data=_chat_completion_response(
                "Na podstawie [1] i [2] wynika, że oferta jest aktualna."
            ),
        )
        result = llm.synthesize_answer(
            "Jaka jest oferta?",
            [("[1]", "Fragment A"), ("[2]", "Fragment B")],
        )
        assert isinstance(result, dict)
        assert "answer" in result
        assert "cited_indices" in result
        assert result["answer"] == "Na podstawie [1] i [2] wynika, że oferta jest aktualna."
        assert result["cited_indices"] == [1, 2]


def test_synthesize_answer_empty_fragments_returns_placeholder(llm):
    """synthesize_answer with no fragments returns placeholder and empty cited_indices."""
    result = llm.synthesize_answer("Pytanie?", [])
    assert result["answer"] == "Brak fragmentów do odpowiedzi."
    assert result["cited_indices"] == []


def test_synthesize_answer_default_cited_indices_when_none_in_text(llm):
    """When answer has no [n] citations, cited_indices defaults to [1]."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(
            json_data=_chat_completion_response("Brak cytowań w odpowiedzi."),
        )
        result = llm.synthesize_answer("Pytanie?", [("[1]", "Tekst")])
        assert result["cited_indices"] == [1]


def test_openrouter_401_raises_openrouter_error(llm):
    """401 response raises OpenRouterError with status_code."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(status_code=401)
        with pytest.raises(OpenRouterError) as exc_info:
            llm.classify_intent("test")
        assert exc_info.value.status_code == 401


def test_openrouter_402_raises_openrouter_error(llm):
    """402 response raises OpenRouterError."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(status_code=402)
        with pytest.raises(OpenRouterError) as exc_info:
            llm.classify_intent("test")
        assert exc_info.value.status_code == 402


def test_openrouter_missing_choices_raises(llm):
    """Response without choices raises OpenRouterError."""
    with patch("services.llm.openrouter.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.return_value = _make_response(json_data={})
        with pytest.raises(OpenRouterError) as exc_info:
            llm.classify_intent("test")
        assert "choices" in str(exc_info.value).lower() or "missing" in str(exc_info.value).lower()


def test_openrouter_llm_requires_api_key():
    """OpenRouterLLM raises ValueError when api_key is empty."""
    settings = Settings(openrouter_api_key="", openrouter_model="openai/gpt-4o-mini")
    with pytest.raises(ValueError, match="openrouter_api_key"):
        OpenRouterLLM(settings)
