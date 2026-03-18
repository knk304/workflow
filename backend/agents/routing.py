"""Routing agent — suggests optimal task/case assignees based on workload,
skills, and availability.

Uses the LLM to reason about team members' capabilities and current load
to produce ranked RoutingSuggestion objects.
"""

import json
import logging
import re
from typing import Any

from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from agents.providers.base import LLMMessage
from database import get_db

logger = logging.getLogger(__name__)


class RoutingAgent(BaseAgent):
    """Suggests best assignees for a case or task."""

    @property
    def name(self) -> str:
        return "routing"

    async def _gather_context(self, case_id: str) -> dict[str, Any]:
        """Collect case details and team member workloads."""
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        if not case:
            raise ValueError(f"Case {case_id} not found")

        # Get all active users with their roles
        users_cursor = db.users.find({"is_active": True})
        users = await users_cursor.to_list(length=200)

        # Count open tasks per user
        pipeline = [
            {"$match": {"status": {"$in": ["open", "in_progress"]}}},
            {"$group": {"_id": "$assigned_to", "count": {"$sum": 1}}},
        ]
        task_counts_cursor = db.tasks.aggregate(pipeline)
        task_counts_raw = await task_counts_cursor.to_list(length=200)
        task_counts = {tc["_id"]: tc["count"] for tc in task_counts_raw}

        team_info = []
        for u in users:
            uid = str(u.get("_id", ""))
            team_info.append({
                "user_id": uid,
                "user_name": u.get("name", u.get("full_name", u.get("email", ""))),
                "role": u.get("role", "AGENT"),
                "open_tasks": task_counts.get(uid, 0),
            })

        return {
            "case": {
                "id": str(case.get("_id", "")),
                "title": case.get("title", case.get("fields", {}).get("applicantName", "")),
                "case_type": case.get("type", ""),
                "priority": case.get("priority", "medium"),
                "current_stage": case.get("stage", ""),
                "description": (case.get("description") or "")[:500],
            },
            "team": team_info,
        }

    async def run(self, case_id: str, **kwargs) -> dict[str, Any]:
        self._log(f"Routing case {case_id}")

        try:
            context = await self._gather_context(case_id)
        except ValueError as e:
            return {"case_id": case_id, "suggestions": [], "error": str(e)}

        if not context["team"]:
            return {"case_id": case_id, "suggestions": []}

        system_prompt = (
            "You are an intelligent task routing assistant for a workflow management system.\n"
            "Given a case and team members with their workloads, suggest the best assignees.\n\n"
            "Consider:\n"
            "- Role appropriateness (ADMIN > MANAGER > AGENT for complexity)\n"
            "- Current workload (fewer open tasks = more available)\n"
            "- Priority alignment (high-priority cases need experienced users)\n\n"
            "Respond ONLY in valid JSON:\n"
            "{\n"
            '  "suggestions": [\n'
            "    {\n"
            '      "user_id": "id",\n'
            '      "user_name": "name",\n'
            '      "score": 0.0-1.0,\n'
            '      "reasons": ["reason1", "reason2"]\n'
            "    }\n"
            "  ]\n"
            "}\n"
            "Return up to 3 suggestions sorted by score descending.\n"
        )

        user_msg = json.dumps(context, default=str)

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_msg),
        ]

        client = get_llm_client()
        response = await client.chat(messages, max_tokens=800, temperature=0.2)

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", response.content, re.DOTALL)
            result = json.loads(m.group()) if m else {"suggestions": []}

        suggestions = result.get("suggestions", [])

        # Validate user_ids exist in team
        valid_ids = {t["user_id"] for t in context["team"]}
        suggestions = [s for s in suggestions if s.get("user_id") in valid_ids]

        # Clamp scores
        for s in suggestions:
            s["score"] = max(0.0, min(1.0, float(s.get("score", 0.5))))

        return {"case_id": case_id, "suggestions": suggestions[:3]}
