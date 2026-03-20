"""Tests for engine/decision_tables.py — evaluation, priority, defaults."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.decision_tables import DecisionTableEngine


@pytest.fixture
def engine():
    return DecisionTableEngine()


# ── Sample Tables ────────────────────────────────────────

LOAN_ROUTING_TABLE = {
    "name": "Loan Approval Routing",
    "inputs": ["loan_amount", "loan_type", "applicant_income"],
    "output_field": "approval_tier",
    "rows": [
        {
            "conditions": {"all": [
                {"field": "loan_amount", "operator": "lte", "value": 10000},
                {"field": "loan_type", "operator": "eq", "value": "personal"},
            ]},
            "output": "auto_approve",
            "priority": 0,
        },
        {
            "conditions": {"all": [
                {"field": "loan_amount", "operator": "between", "value": [10001, 100000]},
                {"field": "applicant_income", "operator": "gte", "value": 50000},
            ]},
            "output": "manager_approval",
            "priority": 0,
        },
        {
            "conditions": {"all": [
                {"field": "loan_amount", "operator": "between", "value": [10001, 100000]},
                {"field": "applicant_income", "operator": "lt", "value": 50000},
            ]},
            "output": "senior_manager_approval",
            "priority": 0,
        },
        {
            "conditions": {"field": "loan_amount", "operator": "gt", "value": 100000},
            "output": "vp_approval",
            "priority": 0,
        },
        {
            "conditions": {"field": "loan_type", "operator": "eq", "value": "commercial"},
            "output": "commercial_review",
            "priority": 10,  # higher priority — evaluated first
        },
    ],
    "default_output": "manager_approval",
}


# ── First-Match Evaluation ───────────────────────────────

class TestFirstMatch:
    def test_auto_approve_small_personal(self, engine):
        data = {"loan_amount": 5000, "loan_type": "personal", "applicant_income": 30000}
        output, row_idx = engine.evaluate(LOAN_ROUTING_TABLE, data)
        assert output == "auto_approve"
        assert row_idx is not None

    def test_manager_approval_mid_high_income(self, engine):
        data = {"loan_amount": 50000, "loan_type": "personal", "applicant_income": 75000}
        output, _ = engine.evaluate(LOAN_ROUTING_TABLE, data)
        assert output == "manager_approval"

    def test_senior_manager_mid_low_income(self, engine):
        data = {"loan_amount": 50000, "loan_type": "personal", "applicant_income": 40000}
        output, _ = engine.evaluate(LOAN_ROUTING_TABLE, data)
        assert output == "senior_manager_approval"

    def test_vp_approval_large_amount(self, engine):
        data = {"loan_amount": 500000, "loan_type": "personal", "applicant_income": 100000}
        output, _ = engine.evaluate(LOAN_ROUTING_TABLE, data)
        assert output == "vp_approval"

    def test_commercial_takes_priority(self, engine):
        """Commercial review row has priority 10, so it's evaluated first."""
        data = {"loan_amount": 5000, "loan_type": "commercial", "applicant_income": 30000}
        output, _ = engine.evaluate(LOAN_ROUTING_TABLE, data)
        assert output == "commercial_review"

    def test_default_output_no_match(self, engine):
        """No rows match, should return default."""
        table = {
            "rows": [
                {"conditions": {"field": "x", "operator": "eq", "value": 999}, "output": "found"},
            ],
            "default_output": "not_found",
        }
        output, row_idx = engine.evaluate(table, {"x": 1})
        assert output == "not_found"
        assert row_idx is None


# ── Evaluate All ─────────────────────────────────────────

class TestEvaluateAll:
    def test_multiple_matches(self, engine):
        """Commercial loan that's also small → both 'commercial_review' and 'auto_approve' match."""
        data = {"loan_amount": 5000, "loan_type": "commercial", "applicant_income": 30000}
        results = engine.evaluate_all(LOAN_ROUTING_TABLE, data)
        outputs = [r["output"] for r in results]
        # commercial_review has higher priority, so it appears first
        assert "commercial_review" in outputs

    def test_no_matches_returns_empty(self, engine):
        table = {
            "rows": [
                {"conditions": {"field": "x", "operator": "eq", "value": 999}, "output": "found"},
            ],
            "default_output": "fallback",
        }
        results = engine.evaluate_all(table, {"x": 1})
        assert results == []


# ── Empty / Edge Cases ───────────────────────────────────

class TestEdgeCases:
    def test_empty_table(self, engine):
        output, row_idx = engine.evaluate({"rows": [], "default_output": "default"}, {"x": 1})
        assert output == "default"
        assert row_idx is None

    def test_empty_condition_always_matches(self, engine):
        """A row with empty conditions should always match (catch-all)."""
        table = {
            "rows": [{"conditions": {}, "output": "catch_all", "priority": 0}],
            "default_output": "fallback",
        }
        output, row_idx = engine.evaluate(table, {"any": "data"})
        assert output == "catch_all"
        assert row_idx is not None

    def test_priority_ordering(self, engine):
        """Higher priority rows are evaluated first."""
        table = {
            "rows": [
                {"conditions": {"field": "x", "operator": "gt", "value": 0}, "output": "low", "priority": 1},
                {"conditions": {"field": "x", "operator": "gt", "value": 0}, "output": "high", "priority": 100},
            ],
        }
        output, _ = engine.evaluate(table, {"x": 5})
        assert output == "high"

    def test_single_row_table(self, engine):
        table = {
            "rows": [
                {"conditions": {"field": "risk", "operator": "eq", "value": "high"}, "output": "escalate"},
            ],
            "default_output": "proceed",
        }
        out1, _ = engine.evaluate(table, {"risk": "high"})
        assert out1 == "escalate"

        out2, _ = engine.evaluate(table, {"risk": "low"})
        assert out2 == "proceed"
