"""Workflow builder agent — converts natural language into a workflow definition JSON.

Reads the YAML node palette (config/workflow_nodes.yaml) to constrain generation
to valid node types with correct allowedNext / property schemas.  Output follows
the WorkflowCreate schema used by POST /api/workflows.
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


def _load_node_palette() -> list[dict]:
    """Load available node types from YAML config."""
    filepath = CONFIG_DIR / "workflow_nodes.yaml"
    with open(filepath, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("nodes", [])


def _valid_node_types() -> set[str]:
    return {n["type"] for n in _load_node_palette()}


class WorkflowBuilderAgent(BaseAgent):
    """Generates a workflow definition from natural language description."""

    @property
    def name(self) -> str:
        return "workflow_builder"

    def _build_system_prompt(self) -> str:
        nodes = _load_node_palette()
        node_docs = "\n".join(
            f"  - {n['type']} ({n['category']}): {n['description']}  "
            f"allowedNext: {n.get('allowedNext', [])}"
            for n in nodes
        )

        return (
            "You are a workflow builder for a case management system.\n"
            "Given a natural language description, generate a workflow definition JSON.\n\n"
            f"Available node types:\n{node_docs}\n\n"
            "Respond ONLY in valid JSON with this structure:\n"
            "{\n"
            '  "name": "Workflow Name",\n'
            '  "description": "Brief description",\n'
            '  "definition": {\n'
            '    "nodes": [\n'
            '      {"id": "node_1", "type": "start", "label": "Start", '
            '"position": {"x": 0, "y": 200}},\n'
            '      {"id": "node_2", "type": "task", "label": "Review Application", '
            '"position": {"x": 250, "y": 200}, "assigneeRole": "REVIEWER", '
            '"config": {"slaHours": 24, "instructions": "Review the submitted application"}},\n'
            '      {"id": "node_3", "type": "end", "label": "End", '
            '"position": {"x": 500, "y": 200}}\n'
            "    ],\n"
            '    "edges": [\n'
            '      {"id": "edge_1", "source": "node_1", "target": "node_2", "label": ""},\n'
            '      {"id": "edge_2", "source": "node_2", "target": "node_3", "label": "Done"}\n'
            "    ]\n"
            "  }\n"
            "}\n\n"
            "Rules:\n"
            "- Every workflow MUST start with exactly one 'start' node\n"
            "- Every workflow MUST end with at least one 'end' node\n"
            "- All paths must lead to an 'end' node (no dead-ends)\n"
            "- Edges must respect allowedNext constraints\n"
            "- Use unique node IDs: node_1, node_2, ...\n"
            "- Use unique edge IDs: edge_1, edge_2, ...\n"
            "- Position nodes left-to-right with x spacing of ~250px\n"
            "- For decisions, offset branches vertically (y +/- 150)\n"
            "- Include assigneeRole for task and approval nodes\n"
            "- Add slaHours in config for time-sensitive tasks\n"
            "- Label edges meaningfully (e.g., 'Approved', 'Rejected')\n"
        )

    async def run(self, description: str, **kwargs) -> dict[str, Any]:
        self._log(f"Building workflow from: {description[:80]}...")

        messages = [
            LLMMessage(role="system", content=self._build_system_prompt()),
            LLMMessage(role="user", content=f"Create a workflow for: {description}"),
        ]

        client = get_llm_client()
        response = await client.chat(messages, max_tokens=4000, temperature=0.2)

        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", response.content, re.DOTALL)
            result = json.loads(m.group()) if m else {
                "name": "Generated Workflow",
                "description": "Failed to parse — please refine description.",
                "definition": {
                    "nodes": [
                        {"id": "node_1", "type": "start", "label": "Start",
                         "position": {"x": 0, "y": 200}},
                        {"id": "node_2", "type": "end", "label": "End",
                         "position": {"x": 250, "y": 200}},
                    ],
                    "edges": [
                        {"id": "edge_1", "source": "node_1", "target": "node_2",
                         "label": ""},
                    ],
                },
            }

        # Validate node types
        valid = _valid_node_types()
        definition = result.get("definition", {})
        definition["nodes"] = [
            n for n in definition.get("nodes", [])
            if n.get("type") in valid
        ]

        # Validate edge references
        node_ids = {n["id"] for n in definition.get("nodes", [])}
        definition["edges"] = [
            e for e in definition.get("edges", [])
            if e.get("source") in node_ids and e.get("target") in node_ids
        ]

        # Ensure start and end nodes exist
        has_start = any(n["type"] == "start" for n in definition["nodes"])
        has_end = any(n["type"] == "end" for n in definition["nodes"])

        if not has_start:
            definition["nodes"].insert(0, {
                "id": "node_auto_start", "type": "start",
                "label": "Start", "position": {"x": 0, "y": 200},
            })
        if not has_end:
            definition["nodes"].append({
                "id": "node_auto_end", "type": "end",
                "label": "End", "position": {"x": 1000, "y": 200},
            })

        result["definition"] = definition
        result["generated_by"] = response.provider
        self._log(
            f"Generated workflow '{result.get('name')}' with "
            f"{len(definition['nodes'])} nodes, {len(definition['edges'])} edges"
        )
        return result
