"""
Pega-Lite Assignment routes — worker worklist per §8.3.

Endpoints:
  GET    /api/assignments          List assignments (filters)
  GET    /api/assignments/my       My open assignments
  GET    /api/assignments/{id}     Get assignment detail
  POST   /api/assignments/{id}/complete   Complete assignment (delegates to step engine)
  POST   /api/assignments/{id}/reassign   Reassign to another user
  POST   /api/assignments/{id}/hold       Put on hold
  POST   /api/assignments/{id}/resume     Resume from hold
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from auth_deps import get_current_user
from database import get_db
from engine.step_engine import complete_step

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


# ── Request Models ─────────────────────────────────────────

class AssignmentCompleteBody(BaseModel):
    form_data: Optional[dict] = None
    notes: Optional[str] = None
    decision: Optional[str] = None
    delegate_to: Optional[str] = None


class ReassignBody(BaseModel):
    assigned_to: str
    reason: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────

def _to_response(doc: dict) -> dict:
    now = datetime.now(timezone.utc)
    due_at = doc.get("due_at")
    is_overdue = False
    if due_at and doc.get("status") in ("open", "in_progress"):
        try:
            due = datetime.fromisoformat(due_at)
            is_overdue = now > due
        except (ValueError, TypeError):
            pass

    return {
        "id": str(doc["_id"]),
        "case_id": doc.get("case_id", ""),
        "case_title": doc.get("case_title", ""),
        "case_type_id": doc.get("case_type_id", ""),
        "stage_name": doc.get("stage_name", ""),
        "process_name": doc.get("process_name", ""),
        "step_name": doc.get("step_name", ""),
        "type": doc.get("type", "form"),
        "status": doc.get("status", "open"),
        "priority": doc.get("priority", "medium"),
        "assigned_to": doc.get("assigned_to"),
        "assigned_to_name": doc.get("assigned_to_name"),
        "assigned_role": doc.get("assigned_role"),
        "form_id": doc.get("form_id"),
        "instructions": doc.get("instructions"),
        "due_at": due_at,
        "is_overdue": is_overdue,
        "sla_hours": doc.get("sla_hours"),
        "created_at": doc.get("created_at", ""),
    }


# ── List Assignments ───────────────────────────────────────

@router.get("")
async def list_assignments(
    assigned_to: str | None = None,
    assigned_role: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    case_type_id: str | None = None,
    priority: str | None = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if assigned_to:
        query["assigned_to"] = assigned_to
    if assigned_role:
        query["assigned_role"] = assigned_role
    if status_filter:
        query["status"] = status_filter
    if case_type_id:
        query["case_type_id"] = case_type_id
    if priority:
        query["priority"] = priority

    cursor = db.assignments.find(query).sort("created_at", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


# ── My Assignments ─────────────────────────────────────────

@router.get("/my")
async def my_assignments(user: dict = Depends(get_current_user)):
    db = get_db()
    uid = str(user["_id"])
    user_role = user.get("role", "")

    query = {
        "status": {"$in": ["open", "in_progress"]},
        "$or": [
            {"assigned_to": uid},
            {"assigned_role": user_role},
        ],
    }
    cursor = db.assignments.find(query).sort("created_at", -1)
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


# ── Get Assignment ─────────────────────────────────────────

@router.get("/{assignment_id}")
async def get_assignment(assignment_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.assignments.find_one({"_id": assignment_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return _to_response(doc)


# ── Complete Assignment ────────────────────────────────────

@router.post("/{assignment_id}/complete")
async def complete_assignment(
    assignment_id: str,
    body: AssignmentCompleteBody,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    asgn = await db.assignments.find_one({"_id": assignment_id})
    if not asgn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    if asgn.get("status") not in ("open", "in_progress"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assignment is not active")

    # Delegate to the step engine
    data = body.model_dump(exclude_none=True)
    try:
        await complete_step(
            asgn["case_id"], asgn["step_id"], data, user, db,
        )
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    updated = await db.assignments.find_one({"_id": assignment_id})
    return _to_response(updated)


# ── Reassign ───────────────────────────────────────────────

@router.post("/{assignment_id}/reassign")
async def reassign(
    assignment_id: str,
    body: ReassignBody,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    asgn = await db.assignments.find_one({"_id": assignment_id})
    if not asgn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    if asgn.get("status") not in ("open", "in_progress"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assignment is not active")

    now = datetime.now(timezone.utc).isoformat()
    old_assignee = asgn.get("assigned_to")
    await db.assignments.update_one(
        {"_id": assignment_id},
        {"$set": {"assigned_to": body.assigned_to, "updated_at": now}},
    )
    await db.audit_logs.insert_one({
        "entityType": "assignment",
        "entityId": assignment_id,
        "action": "reassigned",
        "actorId": str(user["_id"]),
        "actorName": user.get("name", user.get("email", "")),
        "changes": {"from": old_assignee, "to": body.assigned_to, "reason": body.reason},
        "timestamp": now,
    })
    updated = await db.assignments.find_one({"_id": assignment_id})
    return _to_response(updated)


# ── Hold / Resume ──────────────────────────────────────────

@router.post("/{assignment_id}/hold")
async def hold_assignment(assignment_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    asgn = await db.assignments.find_one({"_id": assignment_id})
    if not asgn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    if asgn.get("status") not in ("open", "in_progress"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assignment is not active")

    now = datetime.now(timezone.utc).isoformat()
    await db.assignments.update_one(
        {"_id": assignment_id},
        {"$set": {"status": "on_hold", "updated_at": now}},
    )
    updated = await db.assignments.find_one({"_id": assignment_id})
    return _to_response(updated)


@router.post("/{assignment_id}/resume")
async def resume_assignment(assignment_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    asgn = await db.assignments.find_one({"_id": assignment_id})
    if not asgn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    if asgn.get("status") != "on_hold":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assignment is not on hold")

    now = datetime.now(timezone.utc).isoformat()
    await db.assignments.update_one(
        {"_id": assignment_id},
        {"$set": {"status": "in_progress", "updated_at": now}},
    )
    updated = await db.assignments.find_one({"_id": assignment_id})
    return _to_response(updated)
