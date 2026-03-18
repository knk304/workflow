"""Copilot orchestrator agent — ties together command parsing, form/workflow
builders, summarization, and conversational Q&A into a single streaming
chat interface.

Flow:
1. Parse intent via CommandParser (fast regex then LLM fallback)
2. Dispatch to the appropriate sub-agent
3. Return CopilotResponse with optional structured CopilotAction
"""

import json
import logging
from typing import Any, AsyncIterator

from agents.base import BaseAgent
from agents.command_parser import CommandParser
from agents.llm_client import get_llm_client
from agents.providers.base import LLMMessage

logger = logging.getLogger(__name__)


class CopilotAgent(BaseAgent):
    """Main copilot: classifies intent, dispatches to sub-agents, returns reply + action."""

    @property
    def name(self) -> str:
        return "copilot"

    async def run(
        self,
        message: str,
        case_id: str | None = None,
        history: list[dict] | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        self._log(f"User: {message[:100]}")

        # 1. Parse intent
        parser = CommandParser()
        intent_data = await parser.run(message=message)
        intent = intent_data.get("intent", "unknown")
        self._log(f"Intent: {intent}")

        # 2. Dispatch
        if intent == "navigate":
            return self._navigate_response(intent_data)

        if intent == "create_form":
            return await self._handle_create_form(message)

        if intent == "create_workflow":
            return await self._handle_create_workflow(message)

        if intent == "summarize":
            return await self._handle_summarize(intent_data, case_id)

        # Default: conversational Q&A
        return await self._handle_conversation(message, history or [])

    # ── Intent handlers ───────────────────────────────────

    def _navigate_response(self, intent_data: dict) -> dict[str, Any]:
        route = intent_data.get("route", "/dashboard")
        desc = intent_data.get("description", "Navigate")
        return {
            "reply": f"Navigating to **{desc.replace('Navigate to ', '')}**.",
            "action": {
                "action": "navigate",
                "route": route,
                "description": desc,
            },
        }

    async def _handle_create_form(self, message: str) -> dict[str, Any]:
        from agents.form_builder import FormBuilderAgent

        agent = FormBuilderAgent()
        form = await agent.run(description=message)

        return {
            "reply": (
                f"I've drafted a form called **{form.get('name', 'Untitled')}** "
                f"with {len(form.get('fields', []))} fields. "
                "Would you like me to save it?"
            ),
            "action": {
                "action": "create_form",
                "payload": form,
                "description": f"Create form: {form.get('name', 'Untitled')}",
            },
        }

    async def _handle_create_workflow(self, message: str) -> dict[str, Any]:
        from agents.workflow_builder import WorkflowBuilderAgent

        agent = WorkflowBuilderAgent()
        wf = await agent.run(description=message)
        defn = wf.get("definition", {})
        node_count = len(defn.get("nodes", []))
        edge_count = len(defn.get("edges", []))

        return {
            "reply": (
                f"I've drafted a workflow called **{wf.get('name', 'Untitled')}** "
                f"with {node_count} nodes and {edge_count} edges. "
                "Would you like me to save it?"
            ),
            "action": {
                "action": "create_workflow",
                "payload": wf,
                "description": f"Create workflow: {wf.get('name', 'Untitled')}",
            },
        }

    async def _handle_summarize(
        self, intent_data: dict, fallback_case_id: str | None
    ) -> dict[str, Any]:
        from agents.summarization import SummarizationAgent

        cid = intent_data.get("case_id") or fallback_case_id
        if not cid:
            return {
                "reply": "Which case would you like me to summarize? Please supply a case ID.",
                "action": None,
            }

        agent = SummarizationAgent()
        try:
            result = await agent.run(case_id=cid)
        except ValueError:
            return {"reply": f"Case **{cid}** was not found.", "action": None}

        summary = result.get("summary", "")
        pending = result.get("pending_actions", [])
        pending_text = (
            "\n\n**Pending actions:**\n" + "\n".join(f"- {a}" for a in pending)
            if pending else ""
        )

        return {
            "reply": f"**Summary for case {cid}:**\n\n{summary}{pending_text}",
            "action": None,
            "sources": [f"case:{cid}"],
        }

    async def _handle_conversation(
        self, message: str, history: list[dict]
    ) -> dict[str, Any]:
        """General-purpose conversational Q&A with the LLM."""
        system = (
            "You are a helpful assistant inside a workflow management platform. "
            "Answer concisely about cases, tasks, workflow design, and team management. "
            "If the user wants to perform an action, instruct them to use a specific command "
            "(e.g., 'create a form for …' or 'go to cases')."
        )

        msgs: list[LLMMessage] = [LLMMessage(role="system", content=system)]
        for h in history[-10:]:  # keep context window reasonable
            msgs.append(LLMMessage(role=h.get("role", "user"), content=h.get("content", "")))
        msgs.append(LLMMessage(role="user", content=message))

        client = get_llm_client()
        response = await client.chat(msgs, max_tokens=1000, temperature=0.4)

        return {"reply": response.content, "action": None}

    # ── Streaming variant ────────────────────────────────

    async def stream(
        self,
        message: str,
        case_id: str | None = None,
        history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """SSE-friendly streaming: yields JSON lines.

        First yields an `action` event if applicable, then streams
        text chunks as `delta` events, and finally a `done` event.
        """
        # Parse intent first (non-streaming)
        parser = CommandParser()
        intent_data = await parser.run(message=message)
        intent = intent_data.get("intent", "unknown")

        # For navigation, the reply is instant — no streaming needed
        if intent == "navigate":
            resp = self._navigate_response(intent_data)
            yield json.dumps({"type": "action", "data": resp["action"]}) + "\n"
            yield json.dumps({"type": "delta", "data": resp["reply"]}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
            return

        # For create_form / create_workflow, generate then stream
        if intent == "create_form":
            resp = await self._handle_create_form(message)
            if resp.get("action"):
                yield json.dumps({"type": "action", "data": resp["action"]}) + "\n"
            yield json.dumps({"type": "delta", "data": resp["reply"]}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
            return

        if intent == "create_workflow":
            resp = await self._handle_create_workflow(message)
            if resp.get("action"):
                yield json.dumps({"type": "action", "data": resp["action"]}) + "\n"
            yield json.dumps({"type": "delta", "data": resp["reply"]}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
            return

        if intent == "summarize":
            resp = await self._handle_summarize(intent_data, case_id)
            yield json.dumps({"type": "delta", "data": resp["reply"]}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
            return

        # Default: stream the LLM response token-by-token
        system = (
            "You are a helpful assistant inside a workflow management platform. "
            "Answer concisely about cases, tasks, workflow design, and team management."
        )
        msgs: list[LLMMessage] = [LLMMessage(role="system", content=system)]
        for h in (history or [])[-10:]:
            msgs.append(LLMMessage(role=h.get("role", "user"), content=h.get("content", "")))
        msgs.append(LLMMessage(role="user", content=message))

        client = get_llm_client()
        async for chunk in client.stream(msgs, max_tokens=1000, temperature=0.4):
            yield json.dumps({"type": "delta", "data": chunk}) + "\n"
        yield json.dumps({"type": "done"}) + "\n"
