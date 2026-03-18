"""Provider-agnostic LLM client.

Loads provider config from llm_providers.yaml, instantiates the correct
provider class, and exposes a simple chat() / stream() interface.
Supports hot-switching between providers.
"""

import os
import logging
from pathlib import Path
from typing import AsyncIterator, Optional

import yaml

from agents.providers.base import BaseLLMProvider, LLMMessage, LLMResponse, LLMConfig
from agents.providers.openai_provider import OpenAIProvider
from agents.providers.custom_provider import CustomProvider

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"

# Provider type → class mapping
_PROVIDER_CLASSES: dict[str, type[BaseLLMProvider]] = {
    "openai": OpenAIProvider,
    "azure_openai": OpenAIProvider,
    "ollama": OpenAIProvider,
    "custom": CustomProvider,
}


def _resolve_env(val: str | None) -> str:
    """Resolve ${VAR} and ${VAR:-default} patterns in a string."""
    if not val or not isinstance(val, str):
        return val or ""
    import re
    def _replace(match):
        var = match.group(1)
        if ":-" in var:
            name, default = var.split(":-", 1)
            return os.environ.get(name, default)
        return os.environ.get(var, "")
    return re.sub(r"\$\{([^}]+)\}", _replace, val)


def _load_provider_config(provider_name: str | None = None) -> LLMConfig:
    """Load LLM config for the given (or active) provider from YAML."""
    filepath = CONFIG_DIR / "llm_providers.yaml"
    with open(filepath, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if not provider_name:
        provider_name = _resolve_env(raw.get("active_provider", "openai"))

    providers = raw.get("providers", {})
    if provider_name not in providers:
        raise ValueError(f"LLM provider '{provider_name}' not found in config. Available: {list(providers.keys())}")

    p = providers[provider_name]

    # Resolve env vars in key fields
    base_url = _resolve_env(p.get("base_url", ""))
    model = _resolve_env(p.get("model")) or None
    api_version = _resolve_env(p.get("api_version")) if p.get("api_version") else None

    # Load API key from env
    env_key = p.get("env_key")
    api_key = os.environ.get(env_key, "") if env_key else None

    # Resolve headers
    raw_headers = p.get("headers", {})
    headers = {}
    for k, v in raw_headers.items():
        headers[k] = _resolve_env(v) if isinstance(v, str) else str(v)

    return LLMConfig(
        name=provider_name,
        type=p.get("type", "openai"),
        label=p.get("label", provider_name),
        base_url=base_url,
        model=model,
        api_key=api_key,
        api_version=api_version,
        max_tokens=p.get("max_tokens", 4096),
        temperature=p.get("temperature", 0.3),
        streaming=p.get("streaming", True),
        request_template=p.get("request_template"),
        response_mapping=p.get("response_mapping"),
        stream_mapping=p.get("stream_mapping"),
        headers=headers,
    )


def get_provider(provider_name: str | None = None) -> BaseLLMProvider:
    """Create and return an LLM provider instance.

    Args:
        provider_name: Specific provider to load. If None, uses active_provider from config.
    """
    config = _load_provider_config(provider_name)
    provider_cls = _PROVIDER_CLASSES.get(config.type)
    if not provider_cls:
        raise ValueError(f"Unknown provider type: {config.type}. Supported: {list(_PROVIDER_CLASSES.keys())}")
    return provider_cls(config)


class LLMClient:
    """High-level LLM client with provider management and fallback support."""

    def __init__(self, provider_name: str | None = None):
        self._provider_name = provider_name
        self._provider: BaseLLMProvider | None = None

    @property
    def provider(self) -> BaseLLMProvider:
        if self._provider is None:
            self._provider = get_provider(self._provider_name)
        return self._provider

    def switch_provider(self, provider_name: str):
        """Switch to a different provider at runtime."""
        self._provider_name = provider_name
        self._provider = None  # Will be re-created on next access

    async def chat(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> LLMResponse:
        """Send a chat request and get a complete response.

        Falls back to fallback_provider from config if primary fails.
        """
        try:
            return await self.provider.chat(messages, max_tokens, temperature)
        except Exception as e:
            logger.warning(f"Primary provider {self.provider.name} failed: {e}")
            fallback = self._get_fallback()
            if fallback:
                logger.info(f"Falling back to provider: {fallback.name}")
                return await fallback.chat(messages, max_tokens, temperature)
            raise

    async def stream(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> AsyncIterator[str]:
        """Stream a chat response as text chunks."""
        async for chunk in self.provider.stream(messages, max_tokens, temperature):
            yield chunk

    async def health_check(self) -> dict[str, bool]:
        """Check health of the active provider."""
        return {
            "provider": self.provider.name,
            "healthy": await self.provider.health_check(),
        }

    def _get_fallback(self) -> BaseLLMProvider | None:
        """Load fallback provider if configured."""
        try:
            filepath = CONFIG_DIR / "llm_providers.yaml"
            with open(filepath, "r", encoding="utf-8") as f:
                raw = yaml.safe_load(f)
            fb = raw.get("fallback_provider")
            if fb and fb != self.provider.name:
                return get_provider(fb)
        except Exception:
            pass
        return None


# Module-level singleton for convenience
_default_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """Get the shared LLM client singleton."""
    global _default_client
    if _default_client is None:
        _default_client = LLMClient()
    return _default_client
