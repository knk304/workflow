"""Command parser — detects intent from natural language and maps to structured actions.

Supports intents: navigate, create_form, create_workflow, query, summarize, configure, unknown.
Uses keyword + pattern matching first (fast path), then falls back to LLM classification
for ambiguous inputs.
"""

import json
import logging
import re
from typing import Any

from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from agents.providers.base import LLMMessage

logger = logging.getLogger(__name__)

# ── Fast-path pattern matchers ────────────────────────────

_NAVIGATE_PATTERNS = [
    # Specific entity by ID (require ID that isn't just "s" or "list")
    (r"(?:show|open|go\s+to|navigate\s+to|view)\s+(?:case|ticket)\s*[#]?(\w{2,})\b", "case"),
    (r"(?:show|open|go\s+to|navigate\s+to|view)\s+(?:task)\s*[#]?(\w{2,})\b", "task"),
    # Page-level navigation
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?dashboard", "dashboard"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?documents?(?:\s+list)?$", "documents"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+|my\s+)?tasks?(?:\s+list)?$", "tasks"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?cases?(?:\s+list)?$", "cases"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?approvals?", "approvals"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?notifications?", "notifications"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?sla", "sla"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?workflows?", "workflows"),
    (r"(?:go\s+to|open|show|navigate\s+to|view)\s+(?:the\s+)?forms?", "forms"),
]

_CREATE_FORM_PATTERNS = [
    r"(?:create|build|make|generate)\s+(?:a\s+)?(?:new\s+)?form\b",
    r"(?:add|design)\s+(?:a\s+)?(?:new\s+)?form\b",
]

_CREATE_WORKFLOW_PATTERNS = [
    r"(?:create|build|make|generate)\s+(?:a\s+)?(?:new\s+)?workflow\b",
    r"(?:add|design)\s+(?:a\s+)?(?:new\s+)?workflow\b",
]

_SUMMARIZE_PATTERNS = [
    r"(?:summarize|summarise|summary\s+of)\s+(?:case|ticket)\s*[#]?(\S+)",
    r"(?:what(?:'?s| is)\s+(?:happening|going on)\s+(?:with|in))\s+(?:case|ticket)\s*[#]?(\S+)",
]

_QUERY_PATTERNS = [
    r"(?:how\s+many|list|find|search|what|which|who|count)\b",
    r"(?:cases?\s+(?:are|is|that|with))\b",
    r"(?:overdue|pending|blocked)\s+(?:cases?|tasks?)",
    r"(?:open)\s+(?:cases|tasks)\b",  # plural only to avoid "open case <id>"
]

ROUTE_MAP = {
    "dashboard": "/dashboard",
    "cases": "/cases",
    "tasks": "/tasks",
    "documents": "/documents",
    "approvals": "/approvals",
    "notifications": "/notifications",
    "sla": "/sla",
    "workflows": "/workflows",
    "forms": "/forms",
}


def parse_intent_fast(message: str) -> dict[str, Any] | None:
    """Try fast regex-based intent detection. Returns action dict or None."""
    text = message.strip()

    # Create form (check before navigate to avoid false positives)
    for pattern in _CREATE_FORM_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return {
                "intent": "create_form",
                "action": "create_form",
                "description": "Create a new form from natural language",
            }

    # Create workflow
    for pattern in _CREATE_WORKFLOW_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return {
                "intent": "create_workflow",
                "action": "create_workflow",
                "description": "Create a new workflow from natural language",
            }

    # Summarize
    for pattern in _SUMMARIZE_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            case_id = m.group(1) if m.lastindex else None
            return {
                "intent": "summarize",
                "action": "none",
                "case_id": case_id,
                "description": f"Summarize case {case_id}" if case_id else "Summarize a case",
            }

    # Query (check before navigate to prevent "how many cases" → navigate)
    for pattern in _QUERY_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return {
                "intent": "query",
                "action": "none",
                "description": "Answer a question about the system",
            }

    # Navigate to specific entity or page
    for pattern, target in _NAVIGATE_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            if target in ("case", "task"):
                entity_id = m.group(1)  # preserve original case
                route = f"/cases/{entity_id}" if target == "case" else f"/tasks"
                return {
                    "intent": "navigate",
                    "action": "navigate",
                    "route": route,
                    "description": f"Navigate to {target} {entity_id}",
                }
            else:
                return {
                    "intent": "navigate",
                    "action": "navigate",
                    "route": ROUTE_MAP.get(target, f"/{target}"),
                    "description": f"Navigate to {target}",
                }

    return None


class CommandParser(BaseAgent):
    """Classifies user messages into structured intents using LLM fallback."""

    @property
    def name(self) -> str:
        return "command_parser"

    def _build_system_prompt(self) -> str:
        return (
            "You are an intent classifier for a workflow management system.\n"
            "Given a user message, classify it into ONE of these intents:\n"
            "- navigate: User wants to navigate/view something (case, task, dashboard, etc.)\n"
            "- create_form: User wants to create/build a form\n"
            "- create_workflow: User wants to create/build a workflow\n"
            "- summarize: User wants a case summary\n"
            "- query: User is asking a question about cases, tasks, or the system\n"
            "- configure: User wants to change settings or add case types\n"
            "- unknown: Cannot determine intent\n\n"
            "Respond ONLY in valid JSON:\n"
            '{"intent": "navigate|create_form|create_workflow|summarize|query|configure|unknown", '
            '"action": "navigate|create_form|create_workflow|confirm|none", '
            '"route": "/path (for navigate only, else null)", '
            '"case_id": "extracted case ID or null", '
            '"description": "brief description of what user wants"}'
        )

    async def run(self, message: str, **kwargs) -> dict[str, Any]:
        """Parse intent from a user message."""
        # Fast path: regex match
        fast_result = parse_intent_fast(message)
        if fast_result:
            self._log(f"Fast-path intent: {fast_result['intent']}")
            return fast_result

        # Slow path: LLM classification
        self._log("LLM classification fallback")
        messages = [
            LLMMessage(role="system", content=self._build_system_prompt()),
            LLMMessage(role="user", content=message),
        ]
        client = get_llm_client()
        response = await client.chat(messages, max_tokens=200, temperature=0.1)

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", response.content, re.DOTALL)
            result = json.loads(m.group()) if m else {
                "intent": "unknown", "action": "none", "description": "Could not parse intent",
            }

        return result
