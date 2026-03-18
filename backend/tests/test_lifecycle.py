"""Tests for engine/lifecycle.py — case stage transitions."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from engine.lifecycle import (
    get_next_stage, get_first_stage, get_available_transitions,
    build_stage_entry, complete_current_stage, TransitionDeniedError,
)


class TestBuildStageEntry:
    def test_creates_valid_entry(self):
        entry = build_stage_entry("underwriting")
        assert entry["name"] == "underwriting"
        assert entry["status"] == "in_progress"
        assert entry["enteredAt"] is not None
        assert entry["completedAt"] is None
        assert entry["completedBy"] is None


class TestCompleteCurrentStage:
    def test_marks_last_stage_completed(self):
        stages = [
            {"name": "intake", "status": "in_progress", "enteredAt": "t1",
             "completedAt": None, "completedBy": None}
        ]
        result = complete_current_stage(stages, "actor-1")
        assert result[0]["status"] == "completed"
        assert result[0]["completedBy"] == "actor-1"
        assert result[0]["completedAt"] is not None

    def test_empty_stages_returns_empty(self):
        result = complete_current_stage([], "actor-1")
        assert result == []


class TestGetFirstStage:
    @pytest.mark.asyncio
    async def test_returns_first_stage_from_definition(self, patched_db):
        await patched_db.case_types.insert_one({
            "_id": "ct-loan",
            "slug": "loan",
            "stages": ["intake", "review", "done"],
            "transitions": [],
        })
        stage = await get_first_stage("loan")
        assert stage == "intake"

    @pytest.mark.asyncio
    async def test_returns_intake_when_no_definition(self, patched_db):
        stage = await get_first_stage("nonexistent")
        assert stage == "intake"


class TestGetNextStage:
    @pytest.mark.asyncio
    async def test_valid_transition(self, patched_db):
        from tests.conftest import seed_case_type
        await seed_case_type(patched_db)
        result = await get_next_stage("loan_origination", "intake", "submit", "WORKER")
        assert result == "documents"

    @pytest.mark.asyncio
    async def test_role_not_allowed(self, patched_db):
        from tests.conftest import seed_case_type
        await seed_case_type(patched_db)
        with pytest.raises(TransitionDeniedError, match="Role 'VIEWER'"):
            await get_next_stage("loan_origination", "intake", "submit", "VIEWER")

    @pytest.mark.asyncio
    async def test_invalid_action(self, patched_db):
        from tests.conftest import seed_case_type
        await seed_case_type(patched_db)
        with pytest.raises(TransitionDeniedError, match="No transition found"):
            await get_next_stage("loan_origination", "intake", "nonexistent_action", "MANAGER")

    @pytest.mark.asyncio
    async def test_unknown_case_type(self, patched_db):
        with pytest.raises(TransitionDeniedError, match="Unknown case type"):
            await get_next_stage("unknown_type", "intake", "submit", "WORKER")


class TestGetAvailableTransitions:
    @pytest.mark.asyncio
    async def test_returns_transitions_for_role(self, patched_db):
        from tests.conftest import seed_case_type
        await seed_case_type(patched_db)
        transitions = await get_available_transitions("loan_origination", "underwriting", "MANAGER")
        actions = [t["action"] for t in transitions]
        assert "approve" in actions
        assert "reject" in actions

    @pytest.mark.asyncio
    async def test_worker_limited_transitions(self, patched_db):
        from tests.conftest import seed_case_type
        await seed_case_type(patched_db)
        transitions = await get_available_transitions("loan_origination", "underwriting", "WORKER")
        assert transitions == []

    @pytest.mark.asyncio
    async def test_no_transitions_for_unknown_type(self, patched_db):
        transitions = await get_available_transitions("unknown", "intake", "MANAGER")
        assert transitions == []
