"""OpenAI-compatible LLM provider.

Supports OpenAI, Azure OpenAI, and Ollama (all use the OpenAI chat completions API).
"""

import httpx
import json
import logging
from typing import AsyncIterator, Optional

from agents.providers.base import BaseLLMProvider, LLMMessage, LLMResponse, LLMConfig

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    """Provider for OpenAI-compatible APIs (OpenAI, Azure, Ollama)."""

    def _build_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        if self.config.type == "azure_openai" and self.config.api_key:
            headers["api-key"] = self.config.api_key
            headers.pop("Authorization", None)
        return headers

    def _build_url(self) -> str:
        base = self.config.base_url.rstrip("/")
        if self.config.type == "azure_openai":
            model = self.config.model or "gpt-4o"
            version = self.config.api_version or "2024-08-01-preview"
            return f"{base}/openai/deployments/{model}/chat/completions?api-version={version}"
        return f"{base}/chat/completions"

    def _build_body(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int],
        temperature: Optional[float],
        stream: bool = False,
    ) -> dict:
        return {
            "model": self.config.model or "gpt-4o",
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": max_tokens or self.config.max_tokens,
            "temperature": temperature if temperature is not None else self.config.temperature,
            "stream": stream,
        }

    async def chat(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> LLMResponse:
        url = self._build_url()
        headers = self._build_headers()
        body = self._build_body(messages, max_tokens, temperature, stream=False)

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        usage = data.get("usage", {})
        return LLMResponse(
            content=choice["message"]["content"],
            finish_reason=choice.get("finish_reason", "stop"),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            model=data.get("model", self.config.model or ""),
            provider=self.config.name,
        )

    async def stream(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> AsyncIterator[str]:
        url = self._build_url()
        headers = self._build_headers()
        body = self._build_body(messages, max_tokens, temperature, stream=True)

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                        delta = chunk["choices"][0].get("delta", {})
                        text = delta.get("content")
                        if text:
                            yield text
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
