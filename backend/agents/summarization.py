"""Case Summarization Agent.

Gathers case data (fields, stages, audit trail, comments, tasks) and
produces a structured narrative summary using the LLM.
"""

import json
import logging
from typing import Any

from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from agents.providers.base import LLMMessage
from database import get_db
from id_utils import find_by_id

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a case analyst for a workflow management platform.
Given the context of a case (metadata, stage history, tasks, comments, and audit trail),
produce a structured summary with the following sections:

1. **Summary**: A concise narrative (2-4 sentences) of the case's current state and history.
2. **Key Decisions**: A list of important decisions or state changes that occurred.
3. **Pending Actions**: A list of actions that still need to be completed.
4. **Risk Flags**: Any potential issues, delays, or concerns you identify.

Respond ONLY in valid JSON with this exact structure:
{
  "summary": "...",
  "key_decisions": ["..."],
  "pending_actions": ["..."],
  "risk_flags": ["..."]
}

Be factual. Do not invent information not present in the context.
"""


class SummarizationAgent(BaseAgent):
    """Generates structured summaries of case history and status."""

    @property
    def name(self) -> str:
        return "summarization"

    def _build_system_prompt(self) -> str:
        return SYSTEM_PROMPT

    async def _gather_context(self, case_id: str, **kwargs) -> dict[str, Any]:
        """Gather case data, stages, tasks, comments, and audit trail."""
        db = get_db()
        case = await find_by_id(db.cases, case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")

        context: dict[str, Any] = {
            "case_id": case_id,
            "type": case.get("type"),
            "status": case.get("status"),
            "stage": case.get("stage"),
            "priority": case.get("priority"),
            "fields": case.get("fields", {}),
            "sla": case.get("sla", {}),
            "created_at": case.get("createdAt"),
            "updated_at": case.get("updatedAt"),
        }

        # Stage history
        context["stages"] = case.get("stages", [])

        # Tasks
        if kwargs.get("include_tasks", True):
            tasks_cursor = db.tasks.find({"caseId": case_id})
            tasks = []
            async for t in tasks_cursor:
                tasks.append({
                    "title": t.get("title"),
                    "status": t.get("status"),
                    "assignee": t.get("assigneeId"),
                    "priority": t.get("priority"),
                    "created": t.get("createdAt"),
                    "completed": t.get("completedAt"),
                })
            context["tasks"] = tasks

        # Comments
        if kwargs.get("include_comments", True):
            comments_cursor = db.comments.find({"caseId": case_id}).sort("createdAt", 1)
            comments = []
            async for c in comments_cursor:
                comments.append({
                    "user": c.get("userName"),
                    "text": c.get("text"),
                    "date": c.get("createdAt"),
                })
            context["comments"] = comments

        # Audit trail
        if kwargs.get("include_audit", True):
            audit_cursor = db.audit_logs.find(
                {"entityType": "case", "entityId": case_id}
            ).sort("timestamp", 1).limit(50)
            audits = []
            async for a in audit_cursor:
                audits.append({
                    "action": a.get("action"),
                    "actor": a.get("actorName"),
                    "changes": a.get("changes", {}),
                    "timestamp": a.get("timestamp"),
                })
            context["audit_trail"] = audits

        return context

    async def run(self, case_id: str, **kwargs) -> dict[str, Any]:
        """Generate a structured case summary.

        Args:
            case_id: The case to summarize.
            include_audit: Include audit trail (default True).
            include_comments: Include comments (default True).
            include_tasks: Include task list (default True).
            max_length: Optional max summary length hint.

        Returns:
            Dict with summary, key_decisions, pending_actions, risk_flags.
        """
        self._log(f"Summarizing case {case_id}")

        context = await self._gather_context(case_id, **kwargs)

        # Build the user message
        user_message = f"Please summarize this case:\n\n{json.dumps(context, indent=2, default=str)}"

        if kwargs.get("max_length"):
            user_message += f"\n\nKeep the summary under {kwargs['max_length']} words."

        messages = [
            LLMMessage(role="system", content=self._build_system_prompt()),
            LLMMessage(role="user", content=user_message),
        ]

        client = get_llm_client()
        response = await client.chat(messages, max_tokens=1500)

        # Parse the structured JSON response
        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            # Fallback: try to extract JSON from the response
            import re
            match = re.search(r"\{.*\}", response.content, re.DOTALL)
            if match:
                result = json.loads(match.group())
            else:
                result = {
                    "summary": response.content,
                    "key_decisions": [],
                    "pending_actions": [],
                    "risk_flags": [],
                }

        result["case_id"] = case_id
        result["generated_by"] = response.provider

        self._log(f"Summary generated for case {case_id} via {response.provider}")
        return result
