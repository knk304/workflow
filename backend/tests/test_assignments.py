"""Tests for routes/assignments.py — worker worklist (Sprint B)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import (
    seed_test_user, seed_case_type_definition, auth_header,
)


async def _create_case_with_assignment(client, patched_db):
    """Helper: create a case and return (case_id, assignment_id)."""
    await seed_test_user(patched_db)
    await seed_case_type_definition(patched_db)
    resp = await client.post("/api/cases", json={
        "case_type_id": "test-loan", "title": "Assignment Test",
    }, headers=auth_header())
    case_id = resp.json()["id"]
    asgn = await patched_db.assignments.find_one({"case_id": case_id})
    return case_id, str(asgn["_id"])


class TestListAssignments:
    @pytest.mark.asyncio
    async def test_list_all(self, client, patched_db):
        await _create_case_with_assignment(client, patched_db)
        resp = await client.get("/api/assignments", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    @pytest.mark.asyncio
    async def test_filter_by_status(self, client, patched_db):
        await _create_case_with_assignment(client, patched_db)
        resp = await client.get("/api/assignments?status=open", headers=auth_header())
        assert resp.status_code == 200
        assert all(a["status"] == "open" for a in resp.json())

    @pytest.mark.asyncio
    async def test_filter_by_case_type(self, client, patched_db):
        await _create_case_with_assignment(client, patched_db)
        resp = await client.get("/api/assignments?case_type_id=test-loan", headers=auth_header())
        assert resp.status_code == 200
        assert all(a["case_type_id"] == "test-loan" for a in resp.json())


class TestMyAssignments:
    @pytest.mark.asyncio
    async def test_my_assignments_by_role(self, client, patched_db):
        await _create_case_with_assignment(client, patched_db)
        # The assignment has assigned_role="WORKER", user has role=MANAGER
        resp = await client.get("/api/assignments/my", headers=auth_header())
        assert resp.status_code == 200
        # Should match since seed user is MANAGER and assignment uses WORKER role
        # The query uses $or with assigned_to and assigned_role


class TestGetAssignment:
    @pytest.mark.asyncio
    async def test_get_assignment(self, client, patched_db):
        case_id, asgn_id = await _create_case_with_assignment(client, patched_db)
        resp = await client.get(f"/api/assignments/{asgn_id}", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["id"] == asgn_id
        assert resp.json()["case_id"] == case_id

    @pytest.mark.asyncio
    async def test_get_assignment_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/assignments/nonexistent", headers=auth_header())
        assert resp.status_code == 404


class TestCompleteAssignment:
    @pytest.mark.asyncio
    async def test_complete_assignment(self, client, patched_db):
        case_id, asgn_id = await _create_case_with_assignment(client, patched_db)
        resp = await client.post(f"/api/assignments/{asgn_id}/complete", json={
            "form_data": {"applicant": "Jane"},
            "notes": "completed via assignment route",
        }, headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"

    @pytest.mark.asyncio
    async def test_complete_already_completed(self, client, patched_db):
        case_id, asgn_id = await _create_case_with_assignment(client, patched_db)
        await client.post(f"/api/assignments/{asgn_id}/complete", json={}, headers=auth_header())
        resp = await client.post(f"/api/assignments/{asgn_id}/complete", json={}, headers=auth_header())
        assert resp.status_code == 422


class TestReassign:
    @pytest.mark.asyncio
    async def test_reassign(self, client, patched_db):
        case_id, asgn_id = await _create_case_with_assignment(client, patched_db)
        resp = await client.post(f"/api/assignments/{asgn_id}/reassign", json={
            "assigned_to": "user-2",
            "reason": "workload balance",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["assigned_to"] == "user-2"

    @pytest.mark.asyncio
    async def test_reassign_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/assignments/nonexistent/reassign", json={
            "assigned_to": "user-2",
        }, headers=auth_header())
        assert resp.status_code == 404


class TestHoldResume:
    @pytest.mark.asyncio
    async def test_hold_and_resume(self, client, patched_db):
        case_id, asgn_id = await _create_case_with_assignment(client, patched_db)
        # Hold
        resp = await client.post(f"/api/assignments/{asgn_id}/hold", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["status"] == "on_hold"
        # Resume
        resp = await client.post(f"/api/assignments/{asgn_id}/resume", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_resume_not_on_hold(self, client, patched_db):
        case_id, asgn_id = await _create_case_with_assignment(client, patched_db)
        resp = await client.post(f"/api/assignments/{asgn_id}/resume", headers=auth_header())
        assert resp.status_code == 422
