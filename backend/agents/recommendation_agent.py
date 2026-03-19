"""RecommendationAgent — suggests next actions and improvements for a case.

Uses LLM + rules + YAML palette for actionable, explainable recommendations.
"""

import yaml
from pathlib import Path
from typing import Any
from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from models.ai import Recommendation, RecommendationResponse
from database import get_db

_PALETTE_PATH = Path(__file__).parent.parent / "config" / "recommendations.yaml"


def _load_palette() -> list[dict]:
    if not _PALETTE_PATH.exists():
        return []
    with open(_PALETTE_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or []


class RecommendationAgent(BaseAgent):
    """Suggests next actions, improvements, and risk mitigations for a case."""

    @property
    def name(self) -> str:
        return "recommendation"

    async def run(self, case_id: str) -> RecommendationResponse:
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        if not case:
            raise ValueError(f"Case {case_id} not found")

        palette = _load_palette()
        # Optionally: filter palette by case type, status, etc.

        # System prompt: inject palette and case summary
        system = (
            "You are an expert workflow advisor. Given the case details and the recommendation palette, "
            "suggest 3-5 actionable next steps or improvements. For each, provide: action, label, description, "
            "confidence (0-1), and a short reason. Only suggest actions that are relevant and not already completed."
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Case details: {case}\nPalette: {palette}"},
        ]
        client = get_llm_client()
        resp = await client.chat(messages, max_tokens=600)
        # Try to parse as list of Recommendation
        import json
        try:
            data = json.loads(resp.content)
            recs = [Recommendation(**r) for r in data]
        except Exception:
            # fallback: single recommendation
            recs = [Recommendation(action="none", label="No recommendation", description=resp.content, confidence=0.0)]
        return RecommendationResponse(case_id=str(case_id), recommendations=recs)
