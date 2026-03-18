"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional


@dataclass
class LLMMessage:
    """A single message in a chat conversation."""
    role: str           # system | user | assistant
    content: str


@dataclass
class LLMResponse:
    """Standardized response from any LLM provider."""
    content: str
    finish_reason: str = "stop"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""
    provider: str = ""


@dataclass
class LLMConfig:
    """Configuration for a single LLM provider."""
    name: str
    type: str
    label: str
    base_url: str
    model: Optional[str] = None
    api_key: Optional[str] = None
    api_version: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.3
    streaming: bool = True
    # Custom provider fields
    request_template: Optional[dict] = None
    response_mapping: Optional[dict] = None
    stream_mapping: Optional[dict] = None
    headers: dict = field(default_factory=dict)


class BaseLLMProvider(ABC):
    """Abstract interface for LLM providers.

    All providers must implement:
        - chat(): single-shot request → LLMResponse
        - stream(): streaming request → async iterator of content chunks
    """

    def __init__(self, config: LLMConfig):
        self.config = config

    @property
    def name(self) -> str:
        return self.config.name

    @abstractmethod
    async def chat(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> LLMResponse:
        """Send messages and get a complete response."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> AsyncIterator[str]:
        """Send messages and stream response chunks."""
        ...

    async def health_check(self) -> bool:
        """Test if the provider is reachable. Returns True if healthy."""
        try:
            resp = await self.chat(
                [LLMMessage(role="user", content="ping")],
                max_tokens=5,
            )
            return bool(resp.content)
        except Exception:
            return False
