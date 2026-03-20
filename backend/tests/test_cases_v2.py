"""Tests for rewritten routes/cases.py (Sprint B hierarchical endpoints)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import (
    seed_test_user, seed_case_type_definition, seed_case_type_wait_for_user,
    auth_header,
)


class TestCreateCaseV2:
    @pytest.mark.asyncio
    async def test_create_case_from_case_type(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post("/api/cases", json={
            "case_type_id": "test-loan",
            "title": "New Loan Application",
            "priority": "high",
            "custom_fields": {"amount": 25000},
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert data["case_type_id"] == "test-loan"
        assert data["title"] == "New Loan Application"
        assert data["priority"] == "high"
        assert data["status"] == "in_progress"
        assert data["current_stage_id"] == "stage-create"
        assert len(data["stages"]) == 3

    @pytest.mark.asyncio
    async def test_create_case_not_found_type(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/cases", json={
            "case_type_id": "nonexistent",
            "title": "Fail",
        }, headers=auth_header())
        assert resp.status_code == 404


class TestListCasesV2:
    @pytest.mark.asyncio
    async def test_list_cases(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        # Create 2 cases
        await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "A"}, headers=auth_header())
        await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "B"}, headers=auth_header())
        resp = await client.get("/api/cases", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @pytest.mark.asyncio
    async def test_filter_by_case_type(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "A"}, headers=auth_header())
        resp = await client.get("/api/cases?case_type_id=test-loan", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
        resp2 = await client.get("/api/cases?case_type_id=other", headers=auth_header())
        assert len(resp2.json()) == 0


class TestGetCaseV2:
    @pytest.mark.asyncio
    async def test_get_case(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "Get Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.get(f"/api/cases/{case_id}", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["id"] == case_id

    @pytest.mark.asyncio
    async def test_get_case_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/cases/nonexistent", headers=auth_header())
        assert resp.status_code == 404


class TestUpdateCaseV2:
    @pytest.mark.asyncio
    async def test_update_case_fields(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "Update Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.patch(f"/api/cases/{case_id}", json={
            "priority": "critical",
            "custom_fields": {"notes": "urgent"},
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["priority"] == "critical"
        assert resp.json()["custom_fields"]["notes"] == "urgent"


class TestStepComplete:
    @pytest.mark.asyncio
    async def test_complete_step_via_route(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "Step Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.post(
            f"/api/cases/{case_id}/steps/step-fill-form/complete",
            json={"form_data": {"applicant": "John"}, "notes": "done"},
            headers=auth_header(),
        )
        assert resp.status_code == 200
        data = resp.json()
        # Should advance to stage-review
        assert data["current_stage_id"] == "stage-review"


class TestResolveCase:
    @pytest.mark.asyncio
    async def test_resolve_case_via_route(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "Resolve Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.post(f"/api/cases/{case_id}/resolve", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["status"] == "resolved_completed"


class TestWithdrawCase:
    @pytest.mark.asyncio
    async def test_withdraw_case(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "Withdraw Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.post(f"/api/cases/{case_id}/withdraw", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["status"] == "withdrawn"


class TestChangeStageRoute:
    @pytest.mark.asyncio
    async def test_change_stage(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "Change Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.post(f"/api/cases/{case_id}/change-stage", json={
            "target_stage_id": "stage-review",
            "reason": "skipping create",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["current_stage_id"] == "stage-review"


class TestCaseHistory:
    @pytest.mark.asyncio
    async def test_case_history(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "History Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.get(f"/api/cases/{case_id}/history", headers=auth_header())
        assert resp.status_code == 200
        logs = resp.json()
        assert len(logs) >= 1
        assert logs[0]["entityType"] == "case"


class TestCaseAssignments:
    @pytest.mark.asyncio
    async def test_case_assignments(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        create = await client.post("/api/cases", json={"case_type_id": "test-loan", "title": "Assign Test"}, headers=auth_header())
        case_id = create.json()["id"]
        resp = await client.get(f"/api/cases/{case_id}/assignments", headers=auth_header())
        assert resp.status_code == 200
        assignments = resp.json()
        assert len(assignments) >= 1
        assert assignments[0]["case_id"] == case_id
