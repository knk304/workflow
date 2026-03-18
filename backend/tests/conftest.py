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
