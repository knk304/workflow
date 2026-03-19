"""RiskAgent — detects and explains risk factors for a case.

Uses rules + YAML palette + LLM for explainable risk flags and overall risk score.
"""

import yaml
from pathlib import Path
from typing import Any
from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from models.ai import RiskFlag, RiskResponse
from database import get_db

_PALETTE_PATH = Path(__file__).parent.parent / "config" / "risk_flags.yaml"


def _load_palette() -> list[dict]:
    if not _PALETTE_PATH.exists():
        return []
    with open(_PALETTE_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or []


class RiskAgent(BaseAgent):
    """Detects risk factors and flags for a case."""

    @property
    def name(self) -> str:
        return "risk"

    async def run(self, case_id: str) -> RiskResponse:
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        if not case:
            raise ValueError(f"Case {case_id} not found")

        palette = _load_palette()
        # Optionally: filter palette by case type, status, etc.

        # System prompt: inject palette and case summary
        system = (
            "You are a risk analyst for workflow cases. Given the case details and the risk flag palette, "
            "identify all relevant risk flags (severity, category, description, source). "
            "Also return an overall risk level: low, medium, high, or critical."
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Case details: {case}\nPalette: {palette}"},
        ]
        client = get_llm_client()
        resp = await client.chat(messages, max_tokens=600)
        import json
        try:
            data = json.loads(resp.content)
            flags = [RiskFlag(**f) for f in data.get("risk_flags", [])]
            overall = data.get("overall_risk", "low")
        except Exception:
            flags = []
            overall = "low"
        return RiskResponse(case_id=str(case_id), risk_flags=flags, overall_risk=overall)
