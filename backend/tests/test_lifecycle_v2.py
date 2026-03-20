"""Tests for the rewritten hierarchical lifecycle engine (Sprint B)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import (
    seed_test_user, seed_case_type_definition, seed_case_type_wait_for_user,
    auth_header,
)
from engine.lifecycle import (
    instantiate_case, advance_to_next_stage, change_stage,
    resolve_case, manual_advance_stage, TransitionDeniedError,
    _get_first_primary_stage,
)


class TestGetFirstPrimaryStage:
    def test_returns_first_by_order(self):
        stages = [
            {"definition_id": "b", "stage_type": "primary", "order": 2},
            {"definition_id": "a", "stage_type": "primary", "order": 1},
            {"definition_id": "alt", "stage_type": "alternate", "order": 0},
        ]
        result = _get_first_primary_stage(stages)
        assert result["definition_id"] == "a"

    def test_returns_none_for_empty(self):
        assert _get_first_primary_stage([]) is None

    def test_skips_alternate_stages(self):
        stages = [{"definition_id": "x", "stage_type": "alternate", "order": 1}]
        assert _get_first_primary_stage(stages) is None


class TestInstantiateCase:
    @pytest.mark.asyncio
    async def test_creates_case_with_hierarchy(self, patched_db):
        ct = await seed_case_type_definition(patched_db)
        case = await instantiate_case(
            case_type_id="test-loan",
            title="Loan #1",
            owner_id="user-1",
            team_id="team-1",
        )
        assert case is not None
        assert case["_id"].startswith("TL-")
        assert case["case_type_id"] == "test-loan"
        assert case["title"] == "Loan #1"
        assert case["status"] == "in_progress"

        # 3 stages created
        assert len(case["stages"]) == 3
        # First stage is in_progress
        assert case["stages"][0]["status"] == "in_progress"
        assert case["stages"][0]["entered_at"] is not None
        # Other stages still pending
        assert case["stages"][1]["status"] == "pending"

    @pytest.mark.asyncio
    async def test_first_step_activated(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        # First process should be in_progress
        stage1 = case["stages"][0]
        proc1 = stage1["processes"][0]
        assert proc1["status"] == "in_progress"
        # First step should be in_progress (assignment step)
        step1 = proc1["steps"][0]
        assert step1["status"] == "in_progress"
        assert step1["started_at"] is not None

    @pytest.mark.asyncio
    async def test_assignment_created_on_instantiation(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test Case", "user-1")
        # Assignment should be created for the first assignment step
        assignment = await patched_db.assignments.find_one({"case_id": case["_id"]})
        assert assignment is not None
        assert assignment["step_id"] == "step-fill-form"
        assert assignment["status"] == "open"

    @pytest.mark.asyncio
    async def test_returns_none_for_missing_case_type(self, patched_db):
        result = await instantiate_case("nonexistent", "Test", "u1")
        assert result is None

    @pytest.mark.asyncio
    async def test_case_id_sequence_increments(self, patched_db):
        await seed_case_type_definition(patched_db)
        c1 = await instantiate_case("test-loan", "Case 1", "user-1")
        c2 = await instantiate_case("test-loan", "Case 2", "user-1")
        assert c1["_id"] == "TL-001"
        assert c2["_id"] == "TL-002"

    @pytest.mark.asyncio
    async def test_audit_log_written(self, patched_db):
        await seed_case_type_definition(patched_db)
        await instantiate_case("test-loan", "Audit Test", "user-1")
        log = await patched_db.audit_logs.find_one({"action": "created"})
        assert log is not None
        assert log["entityType"] == "case"

    @pytest.mark.asyncio
    async def test_custom_fields_stored(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Custom", "user-1",
                                       custom_fields={"amount": 50000})
        assert case["custom_fields"]["amount"] == 50000


class TestResolveCase:
    @pytest.mark.asyncio
    async def test_resolves_case(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Resolve Test", "user-1")
        resolved = await resolve_case(case["_id"], "resolved_completed")
        assert resolved["status"] == "resolved_completed"
        assert resolved["resolved_at"] is not None

    @pytest.mark.asyncio
    async def test_cancels_open_assignments(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Resolve Test", "user-1")
        resolved = await resolve_case(case["_id"], "resolved_completed")
        # All assignments should be cancelled
        open_count = await patched_db.assignments.count_documents(
            {"case_id": case["_id"], "status": {"$in": ["open", "in_progress"]}}
        )
        assert open_count == 0


class TestChangeStage:
    @pytest.mark.asyncio
    async def test_changes_to_target_stage(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Change Test", "user-1")
        updated = await change_stage(case["_id"], "stage-review", "testing",
                                      {"_id": "user-1", "name": "Test"})
        assert updated["current_stage_id"] == "stage-review"

    @pytest.mark.asyncio
    async def test_cancels_old_stage_assignments(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Change Test", "user-1")
        # Should have an assignment for stage-create
        a = await patched_db.assignments.find_one({"case_id": case["_id"], "stage_id": "stage-create"})
        assert a is not None
        assert a["status"] == "open"

        await change_stage(case["_id"], "stage-review", "testing",
                            {"_id": "user-1", "name": "Test"})
        a = await patched_db.assignments.find_one({"_id": a["_id"]})
        assert a["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_raises_for_missing_case(self, patched_db):
        with pytest.raises(TransitionDeniedError):
            await change_stage("nonexistent", "stage-x", "test", {"_id": "u1"})

    @pytest.mark.asyncio
    async def test_raises_for_missing_target_stage(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        with pytest.raises(TransitionDeniedError):
            await change_stage(case["_id"], "nonexistent-stage", "test", {"_id": "u1"})


class TestManualAdvanceStage:
    @pytest.mark.asyncio
    async def test_raises_when_not_wait_for_user(self, patched_db):
        await seed_case_type_definition(patched_db)
        case = await instantiate_case("test-loan", "Test", "user-1")
        with pytest.raises(TransitionDeniedError, match="manual advance"):
            await manual_advance_stage(case["_id"], {"_id": "user-1", "name": "Test"})

    @pytest.mark.asyncio
    async def test_raises_for_missing_case(self, patched_db):
        with pytest.raises(TransitionDeniedError):
            await manual_advance_stage("nonexistent", {"_id": "u1"})
