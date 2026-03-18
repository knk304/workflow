"""Stub LLM provider — works offline without any API key.

Returns canned responses so the platform degrades gracefully when no real
LLM provider is configured.  Navigation, form creation, workflow creation,
and summarization all use regex fast-paths and never hit this provider.
Only conversational Q&A falls through here.
"""

import logging
from typing import AsyncIterator, Optional

from agents.providers.base import BaseLLMProvider, LLMConfig, LLMMessage, LLMResponse

logger = logging.getLogger(__name__)

_FALLBACK_REPLY = (
    "I'm running in offline mode — no LLM provider is configured. "
    "I can still help you navigate, create forms, create workflows, and summarize cases. "
    "To enable full conversational AI, configure an LLM provider "
    "(set the OPENAI_API_KEY environment variable, or switch to Ollama/custom)."
)


class StubProvider(BaseLLMProvider):
    """Returns a helpful offline message instead of calling an external API."""

    @property
    def name(self) -> str:
        return "stub"

    async def chat(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> LLMResponse:
        logger.info("StubProvider.chat — returning offline response")
        return LLMResponse(
            content=_FALLBACK_REPLY,
            finish_reason="stop",
            model="stub",
            provider="stub",
        )

    async def stream(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> AsyncIterator[str]:
        logger.info("StubProvider.stream — returning offline response")
        yield _FALLBACK_REPLY

    async def health_check(self) -> bool:
        return True
