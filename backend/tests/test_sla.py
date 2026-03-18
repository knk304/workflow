"""Integration tests for SLA definitions and dashboard."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from datetime import datetime, timezone, timedelta
from tests.conftest import seed_test_user, seed_case, auth_header


class TestSLADefinitions:
    @pytest.mark.asyncio
    async def test_create_sla_definition(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/sla/definitions", json={
            "case_type_id": "loan_origination",
            "stage": "underwriting",
            "hours_target": 48,
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert data["hours_target"] == 48
        assert data["stage"] == "underwriting"

    @pytest.mark.asyncio
    async def test_list_sla_definitions(self, client, patched_db):
        await seed_test_user(patched_db)
        await patched_db.sla_definitions.insert_one({
            "_id": "sla-1",
            "case_type_id": "loan_origination",
            "stage": "intake",
            "hours_target": 24,
            "escalation_enabled": True,
            "escalate_to_role": "MANAGER",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.get("/api/sla/definitions", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestSLADashboard:
    @pytest.mark.asyncio
    async def test_sla_dashboard_returns_data(self, client, patched_db):
        await seed_test_user(patched_db)
        # Create a case with SLA
        now = datetime.now(timezone.utc)
        await patched_db.cases.insert_one({
            "_id": "case-sla",
            "type": "loan_origination",
            "status": "open",
            "stage": "underwriting",
            "priority": "high",
            "ownerId": "user-test1",
            "teamId": "team-1",
            "fields": {},
            "stages": [{
                "name": "underwriting",
                "status": "in_progress",
                "enteredAt": (now - timedelta(hours=40)).isoformat(),
                "completedAt": None,
                "completedBy": None,
            }],
            "sla": {
                "targetDate": (now + timedelta(hours=8)).isoformat(),
                "targetResolutionDate": None,
                "daysRemaining": 1,
                "escalated": False,
                "escalationLevel": 0,
            },
            "createdAt": (now - timedelta(hours=40)).isoformat(),
            "updatedAt": now.isoformat(),
            "createdBy": "user-test1",
        })
        # Create SLA definition
        await patched_db.sla_definitions.insert_one({
            "_id": "sla-uw",
            "caseType": "loan_origination",
            "stage": "underwriting",
            "slaHours": 48,
            "description": "UW SLA",
            "createdAt": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.get("/api/sla/dashboard", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data
        assert "cases" in data
        assert data["summary"]["total"] >= 1
