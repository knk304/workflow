"""Abstract base class for all AI agents."""

from abc import ABC, abstractmethod
from typing import Any
import logging

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for AI agents.

    All agents follow the same pattern:
    1. Gather context (case data, documents, history)
    2. Build a prompt from context
    3. Call LLM via the shared llm_client
    4. Parse and validate the response
    5. Return structured output

    Subclasses must implement:
        - name: str property
        - run(**kwargs) -> dict
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Agent identifier used in logging and audit trails."""
        ...

    @abstractmethod
    async def run(self, **kwargs) -> dict[str, Any]:
        """Execute the agent's task and return structured output."""
        ...

    def _build_system_prompt(self) -> str:
        """Return the system prompt for this agent. Override in subclasses."""
        return "You are a helpful workflow automation assistant."

    async def _gather_context(self, **kwargs) -> dict[str, Any]:
        """Gather relevant context for the agent. Override in subclasses."""
        return kwargs

    def _log(self, message: str, **extra):
        logger.info(f"[{self.name}] {message}", extra=extra)

    def _log_error(self, message: str, **extra):
        logger.error(f"[{self.name}] {message}", extra=extra)
