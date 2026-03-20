"""Tests for engine/step_engine.py — step activation, completion, and helpers."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import (
    seed_test_user, seed_case_type_definition, seed_case_type_decision,
    auth_header,
)
from engine.lifecycle import instantiate_case
from engine.step_engine import (
    activate_step, complete_step,
    _find_step, _find_step_global, _get_step_config,
)


class TestFindStep:
    def test_finds_step_in_hierarchy(self):
        case = {
            "stages": [{
                "definition_id": "s1",
                "processes": [{
                    "definition_id": "p1",
                    "steps": [
                        {"definition_id": "st1", "name": "Step 1"},
                        {"definition_id": "st2", "name": "Step 2"},
                    ],
                }],
            }],
        }
        step = _find_step(case, "s1", "p1", "st2")
        assert step is not None
        assert step["name"] == "Step 2"

    def test_returns_none_for_missing(self):
        case = {"stages": []}
        assert _find_step(case, "s1", "p1", "st1") is None


class TestFindStepGlobal:
    def test_finds_step_globally(self):
        case = {
            "stages": [
                {"definition_id": "s1", "processes": [
                    {"definition_id": "p1", "steps": [
                        {"definition_id": "step-x", "name": "X"},
                    ]},
                ]},
                {"definition_id": "s2", "processes": [
                    {"definition_id": "p2", "steps": [
                        {"definition_id": "step-y", "name": "Y"},
                    ]},
                ]},
            ],
        }
        stage_id, proc_id, step = _find_step_global(case, "step-y")
        assert stage_id == "s2"
        assert proc_id == "p2"
        assert step["name"] == "Y"

    def test_returns_nones_for_missing(self):
        case = {"stages": []}
        s, p, step = _find_step_global(case, "nope")
        assert s is None and p is None and step is None


class TestGetStepConfig:
    def test_returns_step_from_blueprint(self):
        ct = {
            "stages": [{
                "id": "s1",
                "processes": [{
                    "id": "p1",
                    "steps": [{"id": "st1", "name": "My Step", "config": {"form_id": "f1"}}],
                }],
            }],
        }
        result = _get_step_config(ct, "s1", "p1", "st1")
        assert result["name"] == "My Step"
        assert result["config"]["form_id"] == "f1"

    def test_returns_empty_for_missing(self):
        assert _get_step_config({}, "s", "p", "st") == {}
        assert _get_step_config(None, "s", "p", "st") == {}


class TestActivateStep:
    @pytest.mark.asyncio
    async def test_activate_assignment_step(self, patched_db):
        """Instantiating a case activates the first step. We verify via complete_step."""
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        # First step should already be activated during instantiation
        step = case["stages"][0]["processes"][0]["steps"][0]
        assert step["status"] == "in_progress"
        assert step["started_at"] is not None

    @pytest.mark.asyncio
    async def test_activate_creates_assignment(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        asgn = await patched_db.assignments.find_one({"step_id": "step-fill-form"})
        assert asgn is not None
        assert asgn["status"] == "open"
        assert asgn["type"] == "form"


class TestCompleteStep:
    @pytest.mark.asyncio
    async def test_complete_assignment_step(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        user = {"_id": "user-1", "name": "Alice", "role": "WORKER"}
        result = await complete_step(
            case["_id"], "step-fill-form",
            {"form_data": {"applicant": "John"}, "notes": "done"},
            user, patched_db,
        )
        # Step should now be completed
        step = result["stages"][0]["processes"][0]["steps"][0]
        assert step["status"] == "completed"
        assert step["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_complete_advances_to_next_stage(self, patched_db):
        """After completing all steps in stage 1, stage 2 should activate."""
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Complete Advance", "user-1")
        user = {"_id": "user-1", "name": "Alice", "role": "WORKER"}

        # Complete the only step in stage-create
        result = await complete_step(case["_id"], "step-fill-form", {}, user, patched_db)

        # Stage-review should now be active
        assert result["current_stage_id"] == "stage-review"
        review_stage = result["stages"][1]
        assert review_stage["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_complete_raises_for_already_completed(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        user = {"_id": "user-1", "name": "Alice"}
        await complete_step(case["_id"], "step-fill-form", {}, user, patched_db)
        with pytest.raises(ValueError, match="not active"):
            await complete_step(case["_id"], "step-fill-form", {}, user, patched_db)

    @pytest.mark.asyncio
    async def test_complete_raises_for_missing_step(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        user = {"_id": "user-1", "name": "Alice"}
        with pytest.raises(ValueError, match="not found"):
            await complete_step(case["_id"], "nonexistent-step", {}, user, patched_db)

    @pytest.mark.asyncio
    async def test_audit_log_on_complete(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Audit", "user-1")
        user = {"_id": "user-1", "name": "Alice"}
        await complete_step(case["_id"], "step-fill-form", {}, user, patched_db)
        log = await patched_db.audit_logs.find_one({"action": {"$regex": "step_completed"}})
        assert log is not None
        assert log["entityId"] == case["_id"]

    @pytest.mark.asyncio
    async def test_full_lifecycle_3_stages(self, patched_db):
        """Complete all steps across 3 stages → case should resolve."""
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Full Lifecycle", "user-1")
        user = {"_id": "user-1", "name": "Alice"}

        # Stage 1: complete step-fill-form
        result = await complete_step(case["_id"], "step-fill-form", {}, user, patched_db)
        assert result["current_stage_id"] == "stage-review"

        # Stage 2: complete step-review
        result = await complete_step(case["_id"], "step-review", {}, user, patched_db)

        # Stage 3 has automation step (auto-completes) → should resolve
        # Refresh from DB to get final state
        final = await patched_db.cases.find_one({"_id": case["_id"]})
        assert final["status"] == "resolved_completed"
        assert final["resolved_at"] is not None


class TestDecisionBranching:
    @pytest.mark.asyncio
    async def test_decision_routes_to_low_branch(self, patched_db):
        """Decision step should evaluate branches and route to correct step."""
        await seed_case_type_decision(patched_db)
        case = await instantiate_case("test-decision", "Decision Low", "user-1",
                                       custom_fields={"amount": 500})
        # Decision step auto-completes → routes to step-auto-approve (automation, also auto-completes)
        # → should resolve the case
        final = await patched_db.cases.find_one({"_id": case["_id"]})
        assert final["status"] == "resolved_completed"

    @pytest.mark.asyncio
    async def test_decision_routes_to_high_branch(self, patched_db):
        """High amount → routes to manual review assignment step."""
        await seed_case_type_decision(patched_db)
        case = await instantiate_case("test-decision", "Decision High", "user-1",
                                       custom_fields={"amount": 5000})
        final = await patched_db.cases.find_one({"_id": case["_id"]})
        # Should be waiting at manual review step
        assert final["status"] == "in_progress"
        assert final["current_step_id"] == "step-manual"
        # step-auto-approve should be skipped
        stage = final["stages"][0]
        proc = stage["processes"][0]
        auto_step = [s for s in proc["steps"] if s["definition_id"] == "step-auto-approve"][0]
        assert auto_step["status"] == "skipped"
