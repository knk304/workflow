"""Form builder agent — converts natural language into a form definition JSON.

Reads the YAML field palette (config/form_fields.yaml) to constrain generation
to valid field types. Output follows the FormDefinitionCreate schema used by
POST /api/forms.
"""

import json
import logging
import re
from typing import Any

import yaml
from pathlib import Path

from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from agents.providers.base import LLMMessage

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def _load_field_palette() -> list[dict]:
    """Load available field types from YAML config."""
    filepath = CONFIG_DIR / "form_fields.yaml"
    with open(filepath, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("fields", [])


class FormBuilderAgent(BaseAgent):
    """Generates a form definition from natural language description."""

    @property
    def name(self) -> str:
        return "form_builder"

    def _build_system_prompt(self) -> str:
        fields = _load_field_palette()
        type_list = ", ".join(f['type'] for f in fields)
        field_docs = "\n".join(
            f"  - {f['type']}: {f['description']}"
            for f in fields
        )

        return (
            "You are a form builder for a workflow management system.\n"
            "Given a natural language description, generate a form definition JSON.\n\n"
            f"Available field types: {type_list}\n"
            f"Field type details:\n{field_docs}\n\n"
            "Respond ONLY in valid JSON with this structure:\n"
            "{\n"
            '  "name": "Form Name",\n'
            '  "description": "Brief description",\n'
            '  "sections": [\n'
            '    {"id": "section_1", "title": "Section Title", "order": 0}\n'
            "  ],\n"
            '  "fields": [\n'
            "    {\n"
            '      "id": "field_1",\n'
            '      "type": "text",\n'
            '      "label": "Field Label",\n'
            '      "placeholder": "Enter value...",\n'
            '      "validation": {"required": true},\n'
            '      "order": 0,\n'
            '      "section": "section_1"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- Use ONLY field types from the available list above\n"
            "- Generate unique IDs using snake_case (e.g., applicant_name)\n"
            "- Mark obviously important fields as required\n"
            "- Group related fields into sections\n"
            "- Order fields logically (name before email, dates chronologically)\n"
            "- Add helpful placeholders\n"
            "- For select/radio/checkbox fields, include options in validation\n"
        )

    async def run(self, description: str, **kwargs) -> dict[str, Any]:
        self._log(f"Building form from: {description[:80]}...")

        messages = [
            LLMMessage(role="system", content=self._build_system_prompt()),
            LLMMessage(role="user", content=f"Create a form for: {description}"),
        ]

        client = get_llm_client()
        response = await client.chat(messages, max_tokens=3000, temperature=0.2)

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", response.content, re.DOTALL)
            result = json.loads(m.group()) if m else {
                "name": "Generated Form",
                "fields": [],
                "sections": [],
                "description": "Failed to parse form — please refine description.",
            }

        # Validate field types against palette
        valid_types = {f["type"] for f in _load_field_palette()}
        result["fields"] = [
            f for f in result.get("fields", [])
            if f.get("type") in valid_types
        ]

        result["generated_by"] = response.provider
        self._log(f"Generated form '{result.get('name')}' with {len(result.get('fields', []))} fields")
        return result
