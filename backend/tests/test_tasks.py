"""Integration tests for task endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import seed_test_user, seed_task, auth_header


class TestCreateTask:
    @pytest.mark.asyncio
    async def test_create_task_success(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/tasks", json={
            "caseId": "case-001",
            "title": "Do something",
            "description": "Details here",
            "priority": "high",
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Do something"
        assert data["status"] == "pending"
        assert data["priority"] == "high"

    @pytest.mark.asyncio
    async def test_create_task_with_checklist(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/tasks", json={
            "caseId": "case-001",
            "title": "With checklist",
            "checklist": [
                {"id": "cl-1", "item": "Step 1", "checked": False},
                {"id": "cl-2", "item": "Step 2", "checked": True},
            ],
        }, headers=auth_header())
        assert resp.status_code == 201
        assert len(resp.json()["checklist"]) == 2


class TestListTasks:
    @pytest.mark.asyncio
    async def test_list_all_tasks(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db, task_id="t1")
        await seed_task(patched_db, task_id="t2")
        resp = await client.get("/api/tasks", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @pytest.mark.asyncio
    async def test_list_tasks_by_case(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db, task_id="t1", case_id="case-A")
        await seed_task(patched_db, task_id="t2", case_id="case-B")
        resp = await client.get("/api/tasks?caseId=case-A", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_list_tasks_by_status(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db, task_id="t1", task_status="pending")
        await seed_task(patched_db, task_id="t2", task_status="completed")
        resp = await client.get("/api/tasks?status=pending", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestKanbanBoard:
    @pytest.mark.asyncio
    async def test_kanban_groups_by_status(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db, task_id="t1", task_status="pending")
        await seed_task(patched_db, task_id="t2", task_status="in_progress")
        await seed_task(patched_db, task_id="t3", task_status="completed")
        await seed_task(patched_db, task_id="t4", task_status="blocked")
        resp = await client.get("/api/tasks/kanban", headers=auth_header())
        assert resp.status_code == 200
        board = resp.json()
        assert len(board["pending"]) == 1
        assert len(board["inProgress"]) == 1
        assert len(board["done"]) == 1
        assert len(board["blocked"]) == 1


class TestGetTask:
    @pytest.mark.asyncio
    async def test_get_task_success(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db)
        resp = await client.get("/api/tasks/task-001", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["id"] == "task-001"

    @pytest.mark.asyncio
    async def test_get_task_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/tasks/nonexistent", headers=auth_header())
        assert resp.status_code == 404


class TestUpdateTask:
    @pytest.mark.asyncio
    async def test_update_task_status(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db)
        resp = await client.patch("/api/tasks/task-001", json={
            "status": "in_progress",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_complete_task_sets_completed_at(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db)
        resp = await client.patch("/api/tasks/task-001", json={
            "status": "completed",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["completedAt"] is not None

    @pytest.mark.asyncio
    async def test_reopen_task_clears_completed_at(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db, task_status="completed")
        resp = await client.patch("/api/tasks/task-001", json={
            "status": "in_progress",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["completedAt"] is None

    @pytest.mark.asyncio
    async def test_update_task_empty_body(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_task(patched_db)
        resp = await client.patch("/api/tasks/task-001", json={},
                                   headers=auth_header())
        assert resp.status_code == 400
