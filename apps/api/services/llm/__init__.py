from config import settings

from .interface import LLMInterface, SynthesisResult
from .mock import MockLLM
from .openrouter import OpenRouterError, OpenRouterLLM

_llm_instance: LLMInterface | None = None


def get_llm() -> LLMInterface:
    """Return LLM implementation: OpenRouter when API key is set, else MockLLM."""
    global _llm_instance
    if _llm_instance is None:
        if settings.openrouter_api_key:
            _llm_instance = OpenRouterLLM(settings)
        else:
            _llm_instance = MockLLM()
    return _llm_instance


__all__ = ["LLMInterface", "MockLLM", "OpenRouterLLM", "OpenRouterError", "get_llm", "SynthesisResult"]
