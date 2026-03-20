"""Shared test fixtures for backend tests.

Uses mongomock-motor to provide an in-memory MongoDB for async tests,
and httpx.AsyncClient on an isolated FastAPI TestClient.
"""

import os
import sys
import asyncio
import pytest
import pytest_asyncio
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport

# Ensure backend/ is on sys.path so imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mongomock_motor import AsyncMongoMockClient


# ─── in-memory MongoDB ───────────────────────────────────────────

@pytest_asyncio.fixture()
async def mock_db():
    """Provide a clean in-memory MongoDB database for each test."""
    client = AsyncMongoMockClient()
    db = client["test_workflow"]
    yield db
    client.close()


# ─── Patch database.get_db to use mock ───────────────────────────

@pytest_asyncio.fixture()
async def patched_db(mock_db):
    """Patch database module globals so all routes use the mock db."""
    import database
    original_db = database._db
    database._db = mock_db
    yield mock_db
    database._db = original_db


# ─── Seed helpers ────────────────────────────────────────────────

async def seed_test_user(db, user_id="user-test1", email="alice@test.com",
                          name="Alice Test", role="MANAGER", password="demo123"):
    from security import hash_password
    user_doc = {
        "_id": user_id,
        "email": email,
        "name": name,
        "role": role,
        "team_ids": ["team-1"],
        "hashed_password": hash_password(password),
        "avatar": None,
        "is_active": True,
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    await db.users.insert_one(user_doc)
    return user_doc


async def seed_case_type(db, slug="loan_origination"):
    ct = {
        "_id": f"ct-{slug}",
        "name": "Loan Origination",
        "slug": slug,
        "description": "Standard loan processing",
        "stages": ["intake", "documents", "underwriting", "approval", "disbursement"],
        "transitions": [
            {"from": "intake", "action": "submit", "to": "documents", "roles": ["WORKER", "MANAGER"]},
            {"from": "documents", "action": "review", "to": "underwriting", "roles": ["WORKER", "MANAGER"]},
            {"from": "underwriting", "action": "approve", "to": "approval", "roles": ["MANAGER"]},
            {"from": "underwriting", "action": "reject", "to": "intake", "roles": ["MANAGER"]},
            {"from": "approval", "action": "disburse", "to": "disbursement", "roles": ["MANAGER"]},
        ],
        "fieldsSchema": {"applicantName": {"type": "text", "required": True}},
        "workflowId": None,
        "stageFormMap": {},
    }
    await db.case_types.insert_one(ct)
    return ct


async def seed_case(db, case_id="case-001", case_type="loan_origination",
                     stage="intake", owner_id="user-test1"):
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc).isoformat()
    sla_target = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    doc = {
        "_id": case_id,
        "type": case_type,
        "status": "open",
        "stage": stage,
        "priority": "medium",
        "ownerId": owner_id,
        "teamId": "team-1",
        "fields": {"applicantName": "John Doe"},
        "stages": [{
            "name": stage,
            "status": "in_progress",
            "enteredAt": now,
            "completedAt": None,
            "completedBy": None,
        }],
        "sla": {
            "targetDate": sla_target,
            "targetResolutionDate": None,
            "daysRemaining": 30,
            "escalated": False,
            "escalationLevel": 0,
        },
        "notes": None,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": owner_id,
    }
    await db.cases.insert_one(doc)
    return doc


async def seed_task(db, task_id="task-001", case_id="case-001",
                     assignee_id="user-test1", task_status="pending"):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": task_id,
        "caseId": case_id,
        "title": "Review documents",
        "description": "Review all submitted documents",
        "assigneeId": assignee_id,
        "teamId": "team-1",
        "status": task_status,
        "priority": "medium",
        "dueDate": None,
        "dependsOn": [],
        "tags": ["review"],
        "checklist": [{"id": "cl-1", "item": "Check ID", "checked": False, "completedAt": None}],
        "createdAt": now,
        "updatedAt": now,
        "completedAt": None,
    }
    await db.tasks.insert_one(doc)
    return doc


# ─── Hierarchical helpers (Sprint B) ─────────────────────────────

def _make_step(step_id, name, step_type, order, config=None, skip_when=None, sla_hours=None):
    return {
        "id": step_id, "name": name, "type": step_type, "order": order,
        "required": True, "skip_when": skip_when, "visible_when": None,
        "sla_hours": sla_hours, "config": config or {},
    }


def _make_process(proc_id, name, order, steps, is_parallel=False, start_when=None):
    return {
        "id": proc_id, "name": name, "type": "sequential", "order": order,
        "is_parallel": is_parallel, "start_when": start_when,
        "sla_hours": None, "steps": steps,
    }


def _make_stage(stage_id, name, order, processes, stage_type="primary",
                on_complete="auto_advance", resolution_status=None, skip_when=None):
    return {
        "id": stage_id, "name": name, "stage_type": stage_type,
        "order": order, "on_complete": on_complete,
        "resolution_status": resolution_status, "skip_when": skip_when,
        "entry_criteria": None, "required_attachments": [],
        "delete_open_assignments": True, "resolve_child_cases": True,
        "sla_hours": None, "processes": processes,
    }


async def seed_case_type_definition(db, ct_id="test-loan"):
    """Seed a minimal hierarchical case type with 3 primary stages."""
    ct = {
        "_id": ct_id,
        "name": "Test Loan",
        "slug": ct_id,
        "description": "Test case type",
        "icon": "folder",
        "prefix": "TL",
        "field_schema": {},
        "stages": [
            _make_stage("stage-create", "Create", 1, [
                _make_process("proc-intake", "Intake", 1, [
                    _make_step("step-fill-form", "Fill Form", "assignment", 1,
                               config={"assignee_role": "WORKER", "form_id": "form-loan"}),
                ]),
            ]),
            _make_stage("stage-review", "Review", 2, [
                _make_process("proc-review", "Review Process", 1, [
                    _make_step("step-review", "Review Application", "assignment", 1,
                               config={"assignee_role": "MANAGER"}),
                ]),
            ]),
            _make_stage("stage-complete", "Complete", 3, [
                _make_process("proc-complete", "Complete Process", 1, [
                    _make_step("step-notify", "Send Notification", "automation", 1,
                               config={"actions": [{"type": "send_notification",
                                                     "config": {"template": "approved"}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
        ],
        "attachment_categories": [],
        "case_wide_actions": [],
        "created_by": "user-admin",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "version": 1,
        "is_active": True,
    }
    await db.case_type_definitions.insert_one(ct)
    return ct


async def seed_case_type_decision(db, ct_id="test-decision"):
    """Seed a case type with a decision step that branches."""
    ct = {
        "_id": ct_id,
        "name": "Decision Test",
        "slug": ct_id,
        "description": "Case type with decision branching",
        "icon": "folder",
        "prefix": "DT",
        "field_schema": {},
        "stages": [
            _make_stage("stage-main", "Main", 1, [
                _make_process("proc-main", "Main Process", 1, [
                    _make_step("step-decide", "Route by Amount", "decision", 1, config={
                        "mode": "first_match",
                        "branches": [
                            {"id": "branch-low", "label": "Low", "condition": {"field": "amount", "operator": "lte", "value": 1000}, "next_step_id": "step-auto-approve"},
                            {"id": "branch-high", "label": "High", "condition": {"field": "amount", "operator": "gt", "value": 1000}, "next_step_id": "step-manual"},
                        ],
                        "default_step_id": "step-manual",
                    }),
                    _make_step("step-auto-approve", "Auto Approve", "automation", 2, config={
                        "actions": [{"type": "set_field", "config": {"field": "auto_approved", "value": True}}],
                    }),
                    _make_step("step-manual", "Manual Review", "assignment", 3, config={
                        "assignee_role": "MANAGER",
                    }),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
        ],
        "attachment_categories": [],
        "case_wide_actions": [],
        "created_by": "user-admin",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "version": 1,
        "is_active": True,
    }
    await db.case_type_definitions.insert_one(ct)
    return ct


async def seed_case_type_wait_for_user(db, ct_id="test-wait"):
    """Case type where stage 1 uses wait_for_user."""
    ct = {
        "_id": ct_id,
        "name": "Wait Test",
        "slug": ct_id,
        "description": "Case type with wait_for_user stage",
        "icon": "folder",
        "prefix": "WT",
        "field_schema": {},
        "stages": [
            _make_stage("stage-1", "Stage 1", 1, [
                _make_process("proc-1", "Process 1", 1, [
                    _make_step("step-1", "Do Work", "assignment", 1,
                               config={"assignee_role": "WORKER"}),
                ]),
            ], on_complete="wait_for_user"),
            _make_stage("stage-2", "Stage 2", 2, [
                _make_process("proc-2", "Process 2", 1, [
                    _make_step("step-2", "Final Work", "assignment", 1,
                               config={"assignee_role": "WORKER"}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
        ],
        "attachment_categories": [],
        "case_wide_actions": [],
        "created_by": "user-admin",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "version": 1,
        "is_active": True,
    }
    await db.case_type_definitions.insert_one(ct)
    return ct


# ─── Auth token helper ───────────────────────────────────────────

def make_token(user_id="user-test1", role="MANAGER"):
    from security import create_access_token
    return create_access_token({"sub": user_id, "role": role})


def auth_header(user_id="user-test1", role="MANAGER") -> dict:
    return {"Authorization": f"Bearer {make_token(user_id, role)}"}


# ─── App client fixture ─────────────────────────────────────────

@pytest_asyncio.fixture()
async def client(patched_db):
    """Provide an httpx AsyncClient bound to the FastAPI app with mocked DB."""
    from main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
