"""
Decision table evaluator.

A decision table is an ordered list of rows. Each row has:
  - conditions (compound condition dict)
  - output (any value)
  - priority (higher = evaluated first)

Evaluation modes:
  - first_match: returns output of the first matching row
  - evaluate_all: returns all matching rows (for scoring/weighted)
"""

from typing import Any, Optional
from engine.rule_engine import rule_engine, RuleEngineError


class DecisionTableError(Exception):
    """Raised when a decision table cannot be evaluated."""


class DecisionTableEngine:
    """Evaluates decision tables against a data context."""

    def evaluate(self, table: dict, data: dict) -> tuple[Any, Optional[int]]:
        """
        First-match evaluation.
        Returns (output_value, matched_row_index) or (default_output, None).
        """
        rows = self._sorted_rows(table.get("rows", []))
        for idx, row in rows:
            conditions = row.get("conditions", {})
            if not conditions or rule_engine.evaluate(conditions, data):
                return row.get("output"), idx
        return table.get("default_output"), None

    def evaluate_all(self, table: dict, data: dict) -> list[dict]:
        """
        Returns all matching rows with their index and output.
        Useful for scoring / aggregation.
        """
        results = []
        rows = self._sorted_rows(table.get("rows", []))
        for idx, row in rows:
            conditions = row.get("conditions", {})
            if not conditions or rule_engine.evaluate(conditions, data):
                results.append({
                    "row_index": idx,
                    "output": row.get("output"),
                    "priority": row.get("priority", 0),
                })
        return results

    @staticmethod
    def _sorted_rows(rows: list) -> list[tuple[int, dict]]:
        """Sort rows by priority descending, preserving original index."""
        indexed = list(enumerate(rows))
        indexed.sort(key=lambda x: x[1].get("priority", 0), reverse=True)
        return indexed


# Module-level singleton
decision_table_engine = DecisionTableEngine()
