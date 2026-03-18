"""Custom HTTP-based LLM provider.

Supports any LLM with an HTTP API by using configurable request templates
and response mappings from llm_providers.yaml.
"""

import httpx
import json
import logging
import re
from typing import AsyncIterator, Optional

from agents.providers.base import BaseLLMProvider, LLMMessage, LLMResponse, LLMConfig

logger = logging.getLogger(__name__)


def _resolve_template_value(template_val, variables: dict):
    """Resolve {{var}} placeholders in a template value."""
    if isinstance(template_val, str):
        def _replace(match):
            key = match.group(1).strip()
            val = variables.get(key, "")
            return str(val) if not isinstance(val, str) else val
        resolved = re.sub(r"\{\{(\w+)\}\}", _replace, template_val)
        # Try to cast back to original type
        if resolved.lower() == "true":
            return True
        if resolved.lower() == "false":
            return False
        try:
            return int(resolved)
        except ValueError:
            pass
        try:
            return float(resolved)
        except ValueError:
            pass
        return resolved
    elif isinstance(template_val, dict):
        return {k: _resolve_template_value(v, variables) for k, v in template_val.items()}
    elif isinstance(template_val, list):
        return [_resolve_template_value(item, variables) for item in template_val]
    return template_val


def _extract_by_path(data: dict, path: str):
    """Extract a value from nested dict using dot-notation path.

    Example: "choices.0.message.content" → data["choices"][0]["message"]["content"]
    """
    parts = path.split(".")
    current = data
    for part in parts:
        if current is None:
            return None
        if isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


class CustomProvider(BaseLLMProvider):
    """Generic HTTP-based LLM provider with configurable req/res mapping."""

    def _build_headers(self) -> dict[str, str]:
        headers = {}
        token = self.config.api_key or ""
        for key, val in (self.config.headers or {}).items():
            headers[key] = val.replace("{{token}}", token)
        if "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"
        return headers

    def _build_body(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int],
        temperature: Optional[float],
        stream: bool = False,
    ) -> dict:
        template = self.config.request_template
        if not template:
            # Fallback to OpenAI-compatible format
            return {
                "model": self.config.model or "",
                "messages": [{"role": m.role, "content": m.content} for m in messages],
                "max_tokens": max_tokens or self.config.max_tokens,
                "temperature": temperature if temperature is not None else self.config.temperature,
                "stream": stream,
            }

        # Build messages in a standard format for the template
        messages_formatted = [{"role": m.role, "content": m.content} for m in messages]

        variables = {
            "messages": messages_formatted,
            "max_tokens": max_tokens or self.config.max_tokens,
            "temperature": temperature if temperature is not None else self.config.temperature,
            "model": self.config.model or "",
            "stream": stream,
            "session_id": "",
        }

        return _resolve_template_value(template, variables)

    def _parse_response(self, data: dict) -> LLMResponse:
        mapping = self.config.response_mapping or {}
        content = _extract_by_path(data, mapping.get("content", "choices.0.message.content")) or ""
        prompt_tokens = _extract_by_path(data, mapping.get("usage_prompt_tokens", "usage.prompt_tokens")) or 0
        completion_tokens = _extract_by_path(data, mapping.get("usage_completion_tokens", "usage.completion_tokens")) or 0
        finish_reason = _extract_by_path(data, mapping.get("finish_reason", "choices.0.finish_reason")) or "stop"

        return LLMResponse(
            content=str(content),
            finish_reason=str(finish_reason),
            prompt_tokens=int(prompt_tokens),
            completion_tokens=int(completion_tokens),
            model=self.config.model or "",
            provider=self.config.name,
        )

    async def chat(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> LLMResponse:
        url = self.config.base_url.rstrip("/")
        headers = self._build_headers()
        body = self._build_body(messages, max_tokens, temperature, stream=False)

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        return self._parse_response(data)

    async def stream(
        self,
        messages: list[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> AsyncIterator[str]:
        url = self.config.base_url.rstrip("/")
        headers = self._build_headers()
        body = self._build_body(messages, max_tokens, temperature, stream=True)

        stream_mapping = self.config.stream_mapping or {}
        content_path = stream_mapping.get("content_delta", "choices.0.delta.content")
        finish_path = stream_mapping.get("finish_reason", "choices.0.finish_reason")

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
                        text = _extract_by_path(chunk, content_path)
                        if text:
                            yield str(text)
                        # Check if done
                        reason = _extract_by_path(chunk, finish_path)
                        if reason and reason != "null":
                            break
                    except (json.JSONDecodeError, KeyError):
                        continue
