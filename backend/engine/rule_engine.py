"""
Rule engine — evaluates conditions against a data context (case fields).

Supports:
  - Simple conditions:   {"field": "amount", "operator": "gt", "value": 100}
  - Compound AND:        {"all": [...conditions...]}
  - Compound OR:         {"any": [...conditions...]}
  - Nested compounds:    {"all": [{"any": [...]}, {"field": ...}]}
  - Dot-notation fields: "customer.address.city"
  - Array indexing:      "items[0].price"
"""

import re
from datetime import datetime
from typing import Any, Optional


class RuleEngineError(Exception):
    """Raised when a rule cannot be evaluated."""


class RuleEngine:
    """Evaluates conditions against a data dict."""

    def evaluate(self, condition: dict, data: dict, trace: Optional[list] = None) -> bool:
        """
        Entry point.  Returns True if the condition matches the data.

        ``trace`` (optional): append evaluation steps for debugging.
        """
        if trace is None:
            trace = []

        if not condition:
            trace.append("empty condition → True")
            return True

        # Compound
        if "all" in condition:
            return self._evaluate_all(condition["all"], data, trace)
        if "any" in condition:
            return self._evaluate_any(condition["any"], data, trace)

        # Simple
        return self._evaluate_simple(condition, data, trace)

    # ── Compound ───────────────────────────────────────────

    def _evaluate_all(self, conditions: list, data: dict, trace: list) -> bool:
        """All conditions must be true (AND)."""
        trace.append(f"AND group ({len(conditions)} conditions)")
        for cond in conditions:
            if not self.evaluate(cond, data, trace):
                trace.append("AND → False (short-circuit)")
                return False
        trace.append("AND → True")
        return True

    def _evaluate_any(self, conditions: list, data: dict, trace: list) -> bool:
        """At least one condition must be true (OR)."""
        trace.append(f"OR group ({len(conditions)} conditions)")
        for cond in conditions:
            if self.evaluate(cond, data, trace):
                trace.append("OR → True (short-circuit)")
                return True
        trace.append("OR → False")
        return False

    # ── Simple ─────────────────────────────────────────────

    def _evaluate_simple(self, condition: dict, data: dict, trace: list) -> bool:
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")

        if not field or not operator:
            raise RuleEngineError(f"Invalid condition: missing field or operator: {condition}")

        field_value = self._get_field_value(data, field)
        result = self._compare(field_value, operator, value)
        trace.append(f"{field} ({field_value!r}) {operator} {value!r} → {result}")
        return result

    # ── Field access ───────────────────────────────────────

    def _get_field_value(self, data: dict, field_path: str) -> Any:
        """
        Resolve dot-notation and bracket-index paths.
        Examples: "customer.address.city", "items[0].price"
        Returns None if any segment is missing.
        """
        # Split on dots and brackets
        parts = re.split(r"\.|\[|\]", field_path)
        parts = [p for p in parts if p]  # remove blanks

        current: Any = data
        for part in parts:
            if current is None:
                return None
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, (list, tuple)):
                try:
                    current = current[int(part)]
                except (IndexError, ValueError):
                    return None
            else:
                return None
        return current

    # ── Comparison ─────────────────────────────────────────

    def _compare(self, field_value: Any, operator: str, target: Any) -> bool:
        op = operator.lower()

        # Unary operators (no target value needed)
        if op == "is_empty":
            return field_value is None or field_value == "" or field_value == []
        if op == "is_not_empty":
            return field_value is not None and field_value != "" and field_value != []

        # Coerce for numeric comparison
        if op in ("gt", "gte", "lt", "lte", "between"):
            field_value = self._to_number_or_date(field_value)
            if op == "between":
                if not isinstance(target, (list, tuple)) or len(target) != 2:
                    raise RuleEngineError(f"'between' requires [min, max], got {target!r}")
                low = self._to_number_or_date(target[0])
                high = self._to_number_or_date(target[1])
                return low is not None and high is not None and field_value is not None and low <= field_value <= high
            target = self._to_number_or_date(target)

        # Equality / inequality
        if op == "eq":
            return self._eq(field_value, target)
        if op == "neq":
            return not self._eq(field_value, target)

        # Numeric
        if op == "gt":
            return field_value is not None and target is not None and field_value > target
        if op == "gte":
            return field_value is not None and target is not None and field_value >= target
        if op == "lt":
            return field_value is not None and target is not None and field_value < target
        if op == "lte":
            return field_value is not None and target is not None and field_value <= target

        # String operations
        if op == "contains":
            return self._str_contains(field_value, target)
        if op == "not_contains":
            return not self._str_contains(field_value, target)
        if op == "starts_with":
            return isinstance(field_value, str) and field_value.lower().startswith(str(target).lower())
        if op == "ends_with":
            return isinstance(field_value, str) and field_value.lower().endswith(str(target).lower())

        # List membership
        if op == "in":
            if not isinstance(target, list):
                raise RuleEngineError(f"'in' requires a list target, got {type(target).__name__}")
            return field_value in target
        if op == "not_in":
            if not isinstance(target, list):
                raise RuleEngineError(f"'not_in' requires a list target, got {type(target).__name__}")
            return field_value not in target

        # Regex
        if op == "matches":
            if not isinstance(target, str):
                raise RuleEngineError(f"'matches' requires a string pattern, got {type(target).__name__}")
            if field_value is None:
                return False
            return bool(re.search(target, str(field_value)))

        raise RuleEngineError(f"Unknown operator: {operator}")

    # ── Helpers ────────────────────────────────────────────

    @staticmethod
    def _eq(a: Any, b: Any) -> bool:
        """Case-insensitive string comparison, exact otherwise."""
        if isinstance(a, str) and isinstance(b, str):
            return a.lower() == b.lower()
        return a == b

    @staticmethod
    def _str_contains(field_value: Any, target: Any) -> bool:
        if field_value is None:
            return False
        if isinstance(field_value, str):
            return str(target).lower() in field_value.lower()
        if isinstance(field_value, (list, tuple)):
            return target in field_value
        return False

    @staticmethod
    def _to_number_or_date(value: Any) -> Any:
        """Try numeric conversion, then ISO date, else return as-is."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, str):
            # Try number
            try:
                if "." in value:
                    return float(value)
                return int(value)
            except ValueError:
                pass
            # Try ISO date
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
                try:
                    return datetime.strptime(value.replace("Z", ""), fmt)
                except ValueError:
                    continue
        return value


# Module-level singleton
rule_engine = RuleEngine()
