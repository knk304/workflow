"""
Pega-Lite Case routes — hierarchical lifecycle engine.

Endpoints per §8.2:
  POST   /api/cases                          Create case from case type
  GET    /api/cases                          List cases (filters)
  GET    /api/cases/{id}                     Get case with full state
  PATCH  /api/cases/{id}                     Update case fields
  POST   /api/cases/{id}/steps/{step_id}/complete   Complete a step
  POST   /api/cases/{id}/advance             Manually advance stage
  POST   /api/cases/{id}/change-stage        Jump to alternate stage
  POST   /api/cases/{id}/resolve             Resolve case
  POST   /api/cases/{id}/withdraw            Withdraw case
  GET    /api/cases/{id}/history             Audit trail
  GET    /api/cases/{id}/assignments         Case assignments
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone

from auth_deps import get_current_user
from database import get_db
from models.cases import (
    CaseCreateRequest, CaseUpdateRequest, CaseResponse,
    StepCompleteRequest, AdvanceStageRequest, ChangeStageRequest,
    AuditLogResponse,
)
from models.assignments import AssignmentResponse
from engine.lifecycle import (
    instantiate_case, manual_advance_stage, change_stage,
    resolve_case, TransitionDeniedError,
)
from engine.step_engine import complete_step

router = APIRouter(prefix="/api/cases", tags=["cases"])


# ── Helpers ─────────────────────────────────────────────────

def _case_to_response(doc: dict) -> dict:
    """Convert MongoDB document to CaseResponse-compatible dict."""
    return {
        "id": str(doc["_id"]),
        "case_type_id": doc.get("case_type_id", ""),
        "case_type_name": doc.get("case_type_name", ""),
        "title": doc.get("title", ""),
        "status": doc.get("status", "open"),
        "priority": doc.get("priority", "medium"),
        "owner_id": doc.get("owner_id", ""),
        "team_id": doc.get("team_id"),
        "custom_fields": doc.get("custom_fields", {}),
        "current_stage_id": doc.get("current_stage_id"),
        "current_process_id": doc.get("current_process_id"),
        "current_step_id": doc.get("current_step_id"),
        "stages": doc.get("stages", []),
        "created_by": doc.get("created_by", ""),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "resolved_at": doc.get("resolved_at"),
        "resolution_status": doc.get("resolution_status"),
        "parent_case_id": doc.get("parent_case_id"),
        "sla_target_date": doc.get("sla_target_date"),
        "sla_days_remaining": doc.get("sla_days_remaining"),
        "escalation_level": doc.get("escalation_level", 0),
    }


async def _write_audit(db, entity_id: str, action: str, user: dict, changes: dict | None = None):
    await db.audit_logs.insert_one({
        "entityType": "case",
        "entityId": entity_id,
        "action": action,
        "actorId": str(user["_id"]),
        "actorName": user.get("fullName", user.get("name", user.get("email", ""))),
        "changes": changes or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ── Create ──────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(body: CaseCreateRequest, user: dict = Depends(get_current_user)):
    owner_id = body.owner_id or str(user["_id"])
    team_id = body.team_id or (user.get("team_ids", [""])[0] if user.get("team_ids") else None)

    case = await instantiate_case(
        case_type_id=body.case_type_id,
        title=body.title,
        owner_id=owner_id,
        team_id=team_id,
        priority=body.priority.value if hasattr(body.priority, 'value') else body.priority,
        custom_fields=body.custom_fields,
        created_by=str(user["_id"]),
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case type not found")
    return _case_to_response(case)


# ── List ────────────────────────────────────────────────────

@router.get("")
async def list_cases(
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    owner_id: str | None = None,
    team_id: str | None = None,
    case_type_id: str | None = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if priority:
        query["priority"] = priority
    if owner_id:
        query["owner_id"] = owner_id
    if team_id:
        query["team_id"] = team_id
    if case_type_id:
        query["case_type_id"] = case_type_id

    # Authorization: non-admin/manager see own/team cases
    role = user.get("role", "WORKER")
    if role not in ("ADMIN", "MANAGER"):
        uid = str(user["_id"])
        team_ids = user.get("team_ids", [])
        ownership = [{"owner_id": uid}, {"created_by": uid}]
        if team_ids:
            ownership.append({"team_id": {"$in": team_ids}})
        query["$or"] = ownership

    cursor = db.cases.find(query).sort("updated_at", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        results.append(_case_to_response(doc))
    return results


# ── Get ─────────────────────────────────────────────────────

@router.get("/{case_id}")
async def get_case(case_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return _case_to_response(doc)


# ── Update ──────────────────────────────────────────────────

@router.patch("/{case_id}")
async def update_case(case_id: str, body: CaseUpdateRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    updates: dict = {}
    changes: dict = {}
    for field_name, value in body.model_dump(exclude_none=True).items():
        if field_name == "custom_fields" and value:
            # Merge custom_fields rather than overwrite
            merged = {**doc.get("custom_fields", {}), **value}
            updates["custom_fields"] = merged
            changes["custom_fields"] = value
        elif field_name == "priority" and value:
            updates["priority"] = value
            changes["priority"] = value
        else:
            updates[field_name] = value
            changes[field_name] = value

    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.cases.update_one({"_id": case_id}, {"$set": updates})
    await _write_audit(db, case_id, "updated", user, changes)
    updated = await db.cases.find_one({"_id": case_id})
    return _case_to_response(updated)


# ── Step Complete ───────────────────────────────────────────

@router.post("/{case_id}/steps/{step_id}/complete")
async def complete_case_step(
    case_id: str,
    step_id: str,
    body: StepCompleteRequest,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    data = body.model_dump(exclude_none=True)
    try:
        result = await complete_step(case_id, step_id, data, user, db)
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    updated = await db.cases.find_one({"_id": case_id})
    return _case_to_response(updated)


# ── Manual Advance Stage ───────────────────────────────────

@router.post("/{case_id}/advance")
async def advance_stage(
    case_id: str,
    body: AdvanceStageRequest | None = None,
    user: dict = Depends(get_current_user),
):
    try:
        case = await manual_advance_stage(case_id, user)
    except TransitionDeniedError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    return _case_to_response(case)


# ── Change Stage ────────────────────────────────────────────

@router.post("/{case_id}/change-stage")
async def change_case_stage(
    case_id: str,
    body: ChangeStageRequest,
    user: dict = Depends(get_current_user),
):
    try:
        case = await change_stage(case_id, body.target_stage_id, body.reason, user)
    except TransitionDeniedError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    return _case_to_response(case)


# ── Resolve ─────────────────────────────────────────────────

@router.post("/{case_id}/resolve")
async def resolve_case_endpoint(
    case_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    case = await resolve_case(case_id, "resolved_completed", user)
    return _case_to_response(case)


# ── Withdraw ────────────────────────────────────────────────

@router.post("/{case_id}/withdraw")
async def withdraw_case(
    case_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    case = await resolve_case(case_id, "withdrawn", user)
    return _case_to_response(case)


# ── Audit History ───────────────────────────────────────────

@router.get("/{case_id}/history")
async def case_history(case_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    cursor = db.audit_logs.find({"entityType": "case", "entityId": case_id}).sort("timestamp", -1)
    results = []
    async for log in cursor:
        results.append({
            "id": str(log["_id"]),
            "entityType": log["entityType"],
            "entityId": log["entityId"],
            "action": log["action"],
            "actorId": log.get("actorId", ""),
            "actorName": log.get("actorName", ""),
            "changes": log.get("changes", {}),
            "timestamp": log.get("timestamp", ""),
        })
    return results


# ── Case Assignments ────────────────────────────────────────

@router.get("/{case_id}/assignments")
async def case_assignments(case_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    cursor = db.assignments.find({"case_id": case_id}).sort("created_at", -1)
    results = []
    async for a in cursor:
        results.append({
            "id": str(a["_id"]),
            "case_id": a.get("case_id", ""),
            "case_title": a.get("case_title", ""),
            "case_type_id": a.get("case_type_id", ""),
            "stage_name": a.get("stage_name", ""),
            "process_name": a.get("process_name", ""),
            "step_name": a.get("step_name", ""),
            "type": a.get("type", "form"),
            "status": a.get("status", "open"),
            "priority": a.get("priority", "medium"),
            "assigned_to": a.get("assigned_to"),
            "assigned_to_name": a.get("assigned_to_name"),
            "assigned_role": a.get("assigned_role"),
            "form_id": a.get("form_id"),
            "instructions": a.get("instructions"),
            "due_at": a.get("due_at"),
            "is_overdue": False,
            "sla_hours": a.get("sla_hours"),
            "created_at": a.get("created_at", ""),
        })
    return results
