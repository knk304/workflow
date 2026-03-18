"""Integration tests for case endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import (
    seed_test_user, seed_case_type, seed_case,
    auth_header, make_token,
)


class TestCreateCase:
    @pytest.mark.asyncio
    async def test_create_case_success(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        resp = await client.post("/api/cases", json={
            "type": "loan_origination",
            "priority": "high",
            "fields": {"applicantName": "Jane Doe"},
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "loan_origination"
        assert data["stage"] == "intake"
        assert data["status"] == "open"
        assert data["priority"] == "high"

    @pytest.mark.asyncio
    async def test_create_case_default_priority(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        resp = await client.post("/api/cases", json={
            "type": "loan_origination",
        }, headers=auth_header())
        assert resp.status_code == 201
        assert resp.json()["priority"] == "medium"

    @pytest.mark.asyncio
    async def test_create_case_writes_audit(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        resp = await client.post("/api/cases", json={
            "type": "loan_origination",
        }, headers=auth_header())
        assert resp.status_code == 201
        audit = await patched_db.audit_logs.find_one({"action": "created"})
        assert audit is not None
        assert audit["entityType"] == "case"


class TestListCases:
    @pytest.mark.asyncio
    async def test_list_cases(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case(patched_db, case_id="c1")
        await seed_case(patched_db, case_id="c2")
        resp = await client.get("/api/cases", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @pytest.mark.asyncio
    async def test_list_cases_with_status_filter(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case(patched_db, case_id="c1")
        resp = await client.get("/api/cases?status=open", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    @pytest.mark.asyncio
    async def test_list_cases_empty(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/cases", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetCase:
    @pytest.mark.asyncio
    async def test_get_case_success(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case(patched_db)
        resp = await client.get("/api/cases/case-001", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["id"] == "case-001"

    @pytest.mark.asyncio
    async def test_get_case_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/cases/nonexistent", headers=auth_header())
        assert resp.status_code == 404


class TestUpdateCase:
    @pytest.mark.asyncio
    async def test_update_case_fields(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case(patched_db)
        resp = await client.patch("/api/cases/case-001", json={
            "priority": "critical",
            "notes": "Urgent case",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["priority"] == "critical"

    @pytest.mark.asyncio
    async def test_update_case_empty_body(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case(patched_db)
        resp = await client.patch("/api/cases/case-001", json={},
                                   headers=auth_header())
        assert resp.status_code == 400


class TestStageTransition:
    @pytest.mark.asyncio
    async def test_transition_success(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        await seed_case(patched_db, stage="intake")
        resp = await client.patch("/api/cases/case-001/stage", json={
            "action": "submit",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["stage"] == "documents"

    @pytest.mark.asyncio
    async def test_transition_invalid_action(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        await seed_case(patched_db, stage="intake")
        resp = await client.patch("/api/cases/case-001/stage", json={
            "action": "approve",
        }, headers=auth_header())
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_transition_writes_audit(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        await seed_case(patched_db, stage="intake")
        await client.patch("/api/cases/case-001/stage", json={
            "action": "submit",
        }, headers=auth_header())
        audit = await patched_db.audit_logs.find_one({"action": "stage_transition"})
        assert audit is not None
        assert audit["changes"]["from"] == "intake"
        assert audit["changes"]["to"] == "documents"

    @pytest.mark.asyncio
    async def test_transition_role_denied(self, client, patched_db):
        # VIEWER user can't transition underwriting→approval
        await seed_test_user(patched_db, user_id="user-viewer", role="VIEWER")
        await seed_case_type(patched_db)
        await seed_case(patched_db, stage="underwriting", owner_id="user-viewer")
        resp = await client.patch("/api/cases/case-001/stage", json={
            "action": "approve",
        }, headers=auth_header(user_id="user-viewer", role="VIEWER"))
        assert resp.status_code == 422
