"""Tests for engine/rule_engine.py — all operators, compounds, edge cases."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.rule_engine import RuleEngine, RuleEngineError


@pytest.fixture
def engine():
    return RuleEngine()


# ── Equality ──────────────────────────────────────────────

class TestEquality:
    def test_eq_string(self, engine):
        assert engine.evaluate({"field": "name", "operator": "eq", "value": "Alice"}, {"name": "Alice"})

    def test_eq_case_insensitive(self, engine):
        assert engine.evaluate({"field": "name", "operator": "eq", "value": "alice"}, {"name": "ALICE"})

    def test_eq_number(self, engine):
        assert engine.evaluate({"field": "amount", "operator": "eq", "value": 100}, {"amount": 100})

    def test_neq(self, engine):
        assert engine.evaluate({"field": "status", "operator": "neq", "value": "closed"}, {"status": "open"})

    def test_neq_false(self, engine):
        assert not engine.evaluate({"field": "status", "operator": "neq", "value": "open"}, {"status": "open"})


# ── Numeric Comparisons ──────────────────────────────────

class TestNumeric:
    def test_gt(self, engine):
        assert engine.evaluate({"field": "amount", "operator": "gt", "value": 100}, {"amount": 150})

    def test_gt_false(self, engine):
        assert not engine.evaluate({"field": "amount", "operator": "gt", "value": 100}, {"amount": 50})

    def test_gte_equal(self, engine):
        assert engine.evaluate({"field": "amount", "operator": "gte", "value": 100}, {"amount": 100})

    def test_lt(self, engine):
        assert engine.evaluate({"field": "amount", "operator": "lt", "value": 100}, {"amount": 50})

    def test_lte(self, engine):
        assert engine.evaluate({"field": "amount", "operator": "lte", "value": 100}, {"amount": 100})

    def test_between(self, engine):
        assert engine.evaluate({"field": "score", "operator": "between", "value": [60, 90]}, {"score": 75})

    def test_between_lower_edge(self, engine):
        assert engine.evaluate({"field": "score", "operator": "between", "value": [60, 90]}, {"score": 60})

    def test_between_outside(self, engine):
        assert not engine.evaluate({"field": "score", "operator": "between", "value": [60, 90]}, {"score": 95})

    def test_string_to_number_coercion(self, engine):
        assert engine.evaluate({"field": "amount", "operator": "gt", "value": 100}, {"amount": "150"})


# ── String Operations ────────────────────────────────────

class TestStringOps:
    def test_contains(self, engine):
        assert engine.evaluate({"field": "desc", "operator": "contains", "value": "loan"}, {"desc": "Personal Loan Application"})

    def test_contains_case_insensitive(self, engine):
        assert engine.evaluate({"field": "desc", "operator": "contains", "value": "LOAN"}, {"desc": "personal loan"})

    def test_not_contains(self, engine):
        assert engine.evaluate({"field": "desc", "operator": "not_contains", "value": "xyz"}, {"desc": "hello world"})

    def test_starts_with(self, engine):
        assert engine.evaluate({"field": "code", "operator": "starts_with", "value": "LN"}, {"code": "LN-001"})

    def test_ends_with(self, engine):
        assert engine.evaluate({"field": "file", "operator": "ends_with", "value": ".pdf"}, {"file": "report.pdf"})

    def test_matches_regex(self, engine):
        assert engine.evaluate({"field": "email", "operator": "matches", "value": r"^[\w.]+@\w+\.\w+$"}, {"email": "test@example.com"})

    def test_matches_no_match(self, engine):
        assert not engine.evaluate({"field": "code", "operator": "matches", "value": r"^\d+$"}, {"code": "abc"})


# ── List Membership ──────────────────────────────────────

class TestListOps:
    def test_in(self, engine):
        assert engine.evaluate({"field": "status", "operator": "in", "value": ["open", "pending"]}, {"status": "open"})

    def test_in_not_found(self, engine):
        assert not engine.evaluate({"field": "status", "operator": "in", "value": ["open", "pending"]}, {"status": "closed"})

    def test_not_in(self, engine):
        assert engine.evaluate({"field": "status", "operator": "not_in", "value": ["closed", "withdrawn"]}, {"status": "open"})

    def test_contains_in_list(self, engine):
        assert engine.evaluate({"field": "tags", "operator": "contains", "value": "urgent"}, {"tags": ["urgent", "review"]})


# ── Empty Checks ─────────────────────────────────────────

class TestEmptyChecks:
    def test_is_empty_none(self, engine):
        assert engine.evaluate({"field": "notes", "operator": "is_empty"}, {"notes": None})

    def test_is_empty_string(self, engine):
        assert engine.evaluate({"field": "notes", "operator": "is_empty"}, {"notes": ""})

    def test_is_empty_list(self, engine):
        assert engine.evaluate({"field": "items", "operator": "is_empty"}, {"items": []})

    def test_is_empty_false(self, engine):
        assert not engine.evaluate({"field": "notes", "operator": "is_empty"}, {"notes": "hello"})

    def test_is_not_empty(self, engine):
        assert engine.evaluate({"field": "notes", "operator": "is_not_empty"}, {"notes": "hello"})

    def test_is_empty_missing_field(self, engine):
        assert engine.evaluate({"field": "nonexistent", "operator": "is_empty"}, {"other": "value"})


# ── Compound Conditions ──────────────────────────────────

class TestCompound:
    def test_all_true(self, engine):
        cond = {"all": [
            {"field": "amount", "operator": "gt", "value": 100},
            {"field": "type", "operator": "eq", "value": "commercial"},
        ]}
        assert engine.evaluate(cond, {"amount": 200, "type": "commercial"})

    def test_all_partial_false(self, engine):
        cond = {"all": [
            {"field": "amount", "operator": "gt", "value": 100},
            {"field": "type", "operator": "eq", "value": "commercial"},
        ]}
        assert not engine.evaluate(cond, {"amount": 200, "type": "personal"})

    def test_any_one_true(self, engine):
        cond = {"any": [
            {"field": "amount", "operator": "gt", "value": 1000000},
            {"field": "priority", "operator": "eq", "value": "critical"},
        ]}
        assert engine.evaluate(cond, {"amount": 100, "priority": "critical"})

    def test_any_none_true(self, engine):
        cond = {"any": [
            {"field": "amount", "operator": "gt", "value": 1000000},
            {"field": "priority", "operator": "eq", "value": "critical"},
        ]}
        assert not engine.evaluate(cond, {"amount": 100, "priority": "low"})

    def test_nested_all_any(self, engine):
        cond = {"all": [
            {"field": "status", "operator": "eq", "value": "verified"},
            {"any": [
                {"field": "amount", "operator": "gt", "value": 50000},
                {"field": "priority", "operator": "eq", "value": "critical"},
            ]},
        ]}
        data = {"status": "verified", "amount": 30000, "priority": "critical"}
        assert engine.evaluate(cond, data)

    def test_deeply_nested(self, engine):
        cond = {"all": [
            {"any": [
                {"all": [
                    {"field": "a", "operator": "eq", "value": 1},
                    {"field": "b", "operator": "eq", "value": 2},
                ]},
                {"field": "c", "operator": "eq", "value": 3},
            ]},
            {"field": "d", "operator": "eq", "value": 4},
        ]}
        assert engine.evaluate(cond, {"a": 1, "b": 2, "c": 0, "d": 4})
        assert engine.evaluate(cond, {"a": 0, "b": 0, "c": 3, "d": 4})
        assert not engine.evaluate(cond, {"a": 0, "b": 0, "c": 0, "d": 4})


# ── Dot Notation / Nested Field Access ───────────────────

class TestFieldAccess:
    def test_dot_notation(self, engine):
        data = {"customer": {"address": {"city": "Seattle"}}}
        assert engine.evaluate({"field": "customer.address.city", "operator": "eq", "value": "Seattle"}, data)

    def test_array_index(self, engine):
        data = {"items": [{"price": 10}, {"price": 20}]}
        assert engine.evaluate({"field": "items[1].price", "operator": "eq", "value": 20}, data)

    def test_missing_nested_field(self, engine):
        data = {"customer": {"name": "Alice"}}
        assert engine.evaluate({"field": "customer.address.city", "operator": "is_empty"}, data)


# ── Edge Cases ───────────────────────────────────────────

class TestEdgeCases:
    def test_empty_condition(self, engine):
        assert engine.evaluate({}, {"anything": True})

    def test_missing_field_returns_none(self, engine):
        assert not engine.evaluate({"field": "x", "operator": "eq", "value": 5}, {"y": 10})

    def test_invalid_condition_raises(self, engine):
        with pytest.raises(RuleEngineError):
            engine.evaluate({"field": "x"}, {"x": 1})  # no operator

    def test_unknown_operator_raises(self, engine):
        with pytest.raises(RuleEngineError):
            engine.evaluate({"field": "x", "operator": "weird", "value": 1}, {"x": 1})

    def test_between_bad_value_raises(self, engine):
        with pytest.raises(RuleEngineError):
            engine.evaluate({"field": "x", "operator": "between", "value": "not_a_list"}, {"x": 5})

    def test_trace_populated(self, engine):
        trace = []
        engine.evaluate(
            {"all": [{"field": "a", "operator": "eq", "value": 1}]},
            {"a": 1},
            trace=trace,
        )
        assert len(trace) > 0
        assert any("AND" in t for t in trace)
