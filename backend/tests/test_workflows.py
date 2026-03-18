"""Integration tests for workflow CRUD and validation endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import seed_test_user, auth_header


VALID_WORKFLOW_DEFINITION = {
    "nodes": [
        {"id": "n1", "type": "start", "label": "Start", "position": {"x": 0, "y": 0}},
        {"id": "n2", "type": "task", "label": "Review", "position": {"x": 100, "y": 0}},
        {"id": "n3", "type": "end", "label": "End", "position": {"x": 200, "y": 0}},
    ],
    "edges": [
        {"id": "e1", "source": "n1", "target": "n2"},
        {"id": "e2", "source": "n2", "target": "n3"},
    ],
}


class TestCreateWorkflow:
    @pytest.mark.asyncio
    async def test_create_workflow_success(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/workflows", json={
            "name": "Test Workflow",
            "description": "A test",
            "definition": VALID_WORKFLOW_DEFINITION,
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Workflow"
        assert data["version"] == 1
        assert data["isActive"] is True

    @pytest.mark.asyncio
    async def test_create_workflow_empty_name(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/workflows", json={
            "name": "",
            "definition": VALID_WORKFLOW_DEFINITION,
        }, headers=auth_header())
        assert resp.status_code == 422


class TestListWorkflows:
    @pytest.mark.asyncio
    async def test_list_workflows(self, client, patched_db):
        await seed_test_user(patched_db)
        await patched_db.workflows.insert_one({
            "_id": "wf-1", "name": "W1", "definition": {"nodes": [], "edges": []},
            "version": 1, "is_active": True, "created_by": "user-test1",
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.get("/api/workflows", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestDeleteWorkflow:
    @pytest.mark.asyncio
    async def test_delete_as_manager(self, client, patched_db):
        await seed_test_user(patched_db, role="MANAGER")
        await patched_db.workflows.insert_one({
            "_id": "wf-del", "name": "Del", "definition": {"nodes": [], "edges": []},
            "version": 1, "is_active": True, "created_by": "user-test1",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.delete("/api/workflows/wf-del",
                                    headers=auth_header(role="MANAGER"))
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_as_worker_forbidden(self, client, patched_db):
        await seed_test_user(patched_db, user_id="user-w", role="WORKER")
        await patched_db.workflows.insert_one({
            "_id": "wf-del", "name": "Del", "definition": {"nodes": [], "edges": []},
            "version": 1, "is_active": True, "created_by": "user-w",
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.delete("/api/workflows/wf-del",
                                    headers=auth_header(user_id="user-w", role="WORKER"))
        assert resp.status_code == 403


class TestValidateWorkflow:
    @pytest.mark.asyncio
    async def test_validate_valid_workflow(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/workflows/validate",
                                  json=VALID_WORKFLOW_DEFINITION,
                                  headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True
        assert data["errors"] == []

    @pytest.mark.asyncio
    async def test_validate_missing_start(self, client, patched_db):
        await seed_test_user(patched_db)
        defn = {
            "nodes": [
                {"id": "n1", "type": "task", "label": "Task", "position": {"x": 0, "y": 0}},
                {"id": "n2", "type": "end", "label": "End", "position": {"x": 100, "y": 0}},
            ],
            "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
        }
        resp = await client.post("/api/workflows/validate", json=defn,
                                  headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is False
        error_types = [e["type"] for e in data["errors"]]
        assert "missing_start" in error_types

    @pytest.mark.asyncio
    async def test_validate_missing_end(self, client, patched_db):
        await seed_test_user(patched_db)
        defn = {
            "nodes": [
                {"id": "n1", "type": "start", "label": "Start", "position": {"x": 0, "y": 0}},
                {"id": "n2", "type": "task", "label": "Task", "position": {"x": 100, "y": 0}},
            ],
            "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
        }
        resp = await client.post("/api/workflows/validate", json=defn,
                                  headers=auth_header())
        data = resp.json()
        assert data["valid"] is False
        error_types = [e["type"] for e in data["errors"]]
        assert "missing_end" in error_types

    @pytest.mark.asyncio
    async def test_validate_decision_needs_branches(self, client, patched_db):
        await seed_test_user(patched_db)
        defn = {
            "nodes": [
                {"id": "n1", "type": "start", "label": "Start", "position": {"x": 0, "y": 0}},
                {"id": "n2", "type": "decision", "label": "Check", "position": {"x": 100, "y": 0}},
                {"id": "n3", "type": "end", "label": "End", "position": {"x": 200, "y": 0}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "target": "n2"},
                {"id": "e2", "source": "n2", "target": "n3"},
            ],
        }
        resp = await client.post("/api/workflows/validate", json=defn,
                                  headers=auth_header())
        data = resp.json()
        assert data["valid"] is False
        error_types = [e["type"] for e in data["errors"]]
        assert "decision_needs_branches" in error_types
