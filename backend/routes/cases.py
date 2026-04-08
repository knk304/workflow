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
from engine.audit_logger import log_case_updated

router = APIRouter(prefix="/api/cases", tags=["cases"])


# ── Helpers ─────────────────────────────────────────────────

async def _case_to_response(doc: dict) -> dict:
    """Convert MongoDB document to CaseResponse-compatible dict."""
    db = get_db()

    # Compute current_stage_index from current_stage_id
    stages = doc.get("stages", [])
    current_stage_id = doc.get("current_stage_id")
    current_stage_index = 0
    if current_stage_id and stages:
        for i, s in enumerate(stages):
            if s.get("definition_id") == current_stage_id:
                current_stage_index = i
                break

    # Hydrate form_fields for steps that have a form_id but empty form_fields.
    # Also tries to recover form_id from blueprint or by case_type+stage match.
    form_cache: dict = {}
    case_type_id = doc.get("case_type_id")

    for stage in stages:
        for proc in stage.get("processes", []):
            for step in proc.get("steps", []):
                if step.get("form_fields"):
                    continue  # already has fields

                cfg = step.get("config") or {}
                form_id = cfg.get("form_id")

                # If no form_id in runtime config, try case_type + stage match
                if not form_id and case_type_id and step.get("type") in ("assignment", "approval", "attachment"):
                    stage_name = stage.get("definition_id", "").replace("stage-", "")
                    cache_key = f"_lookup_{case_type_id}_{stage_name}"
                    if cache_key not in form_cache:
                        matched = await db.case_forms.find_one({
                            "case_type_id": case_type_id,
                            "stage": stage_name,
                        })
                        form_cache[cache_key] = matched.get("fields", []) if matched else []
                    if form_cache[cache_key]:
                        step["form_fields"] = form_cache[cache_key]
                        continue

                if form_id:
                    if form_id not in form_cache:
                        form_doc = await db.case_forms.find_one({"_id": form_id})
                        form_cache[form_id] = form_doc.get("fields", []) if form_doc else []
                    if form_cache[form_id]:
                        step["form_fields"] = form_cache[form_id]

    return {
        "id": str(doc["_id"]),
        "case_type_id": doc.get("case_type_id", ""),
        "case_type_name": doc.get("case_type_name", ""),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "status": doc.get("status", "open"),
        "priority": doc.get("priority", "medium"),
        "owner_id": doc.get("owner_id", ""),
        "team_id": doc.get("team_id"),
        "custom_fields": doc.get("custom_fields", {}),
        "current_stage_index": current_stage_index,
        "current_stage_id": doc.get("current_stage_id"),
        "current_process_id": doc.get("current_process_id"),
        "current_step_id": doc.get("current_step_id"),
        "stages": stages,
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
    await log_case_updated(db, entity_id, changes or {}, user)


# ── Create ──────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(body: CaseCreateRequest, user: dict = Depends(get_current_user)):
    owner_id = body.owner_id or str(user["_id"])
    team_id = body.team_id or (user.get("team_ids", [""])[0] if user.get("team_ids") else None)

    # Auto-generate title for intake mode when title is not provided
    title = body.title
    if not title:
        db = get_db()
        ct = await db.case_type_definitions.find_one({"_id": body.case_type_id})
        title = ct["name"] if ct else body.case_type_id

    case = await instantiate_case(
        case_type_id=body.case_type_id,
        title=title,
        owner_id=owner_id,
        team_id=team_id,
        priority=body.priority.value if hasattr(body.priority, 'value') else body.priority,
        custom_fields=body.custom_fields,
        created_by=str(user["_id"]),
        intake_form_data=body.intake_form_data,
    )
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case type not found")
    return await _case_to_response(case)


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

    # Authorization:
    #   ADMIN   → see all
    #   MANAGER → see all (frontend marks non-team cases as read-only)
    #   others  → own cases + team cases + cases with an active assignment to them
    role = user.get("role", "WORKER")
    if role not in ("ADMIN", "MANAGER"):
        uid = str(user["_id"])
        user_role = user.get("role", "")
        team_ids = user.get("team_ids", [])

        # Collect case IDs from active assignments for this user
        asgn_or: list = [{"assigned_to": uid}]
        if user_role:
            asgn_or.append({"assigned_role": user_role})
        if team_ids:
            asgn_or.append({"assigned_team_id": {"$in": team_ids}})
        assigned_case_ids = []
        async for asgn in db.assignments.find(
            {"status": {"$in": ["open", "in_progress"]}, "$or": asgn_or},
            {"case_id": 1}
        ):
            assigned_case_ids.append(asgn["case_id"])

        ownership: list = [{"owner_id": uid}, {"created_by": uid}]
        if team_ids:
            ownership.append({"team_id": {"$in": team_ids}})
        if assigned_case_ids:
            ownership.append({"_id": {"$in": assigned_case_ids}})
        query["$or"] = ownership

    cursor = db.cases.find(query).sort("updated_at", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        results.append(await _case_to_response(doc))
    return results


# ── Get ─────────────────────────────────────────────────────

@router.get("/{case_id}")
async def get_case(case_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.cases.find_one({"_id": case_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return await _case_to_response(doc)


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
    return await _case_to_response(updated)


# ── Step Complete ───────────────────────────────────────────


def _can_user_complete_step(user: dict, step: dict, db_assignment: dict | None) -> bool:
    """Check if user is authorized to complete this step."""
    role = user.get("role", "WORKER")
    if role == "ADMIN":
        return True

    uid = str(user["_id"])
    team_ids = user.get("team_ids", [])
    config = step.get("config") or {}

    # If there's a live assignment record, check against it
    if db_assignment:
        at = db_assignment.get("assigned_to")
        ar = db_assignment.get("assigned_role")
        ati = db_assignment.get("assigned_team_id")
        if at and at == uid:
            return True
        if ati and ati in team_ids:
            return True
        if ar and ar == role:
            return True
        # If assignment has any routing set and none matched, deny
        if at or ar or ati:
            return False

    # Fallback: check step config
    assignee_user = config.get("assignee_user_id")
    assignee_role = config.get("assignee_role")
    assignee_team = config.get("assignee_team_id")

    if assignee_user and assignee_user == uid:
        return True
    if assignee_team and assignee_team in team_ids:
        return True
    if assignee_role and assignee_role == role:
        return True
    # If any routing configured and none matched, deny
    if assignee_user or assignee_role or assignee_team:
        return False

    return True  # no restrictions configured


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

    # Find the step in the case hierarchy
    target_step = None
    for stage in doc.get("stages", []):
        for proc in stage.get("processes", []):
            for s in proc.get("steps", []):
                if s.get("definition_id") == step_id:
                    target_step = s
                    break

    if not target_step:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")

    # Check assignment record if one exists
    asgn = await db.assignments.find_one({
        "case_id": case_id, "step_id": step_id,
        "status": {"$in": ["open", "in_progress"]},
    })

    if not _can_user_complete_step(user, target_step, asgn):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not authorized to complete this step")

    data = body.model_dump(exclude_none=True)
    try:
        result = await complete_step(case_id, step_id, data, user, db)
    except Exception as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    updated = await db.cases.find_one({"_id": case_id})
    return await _case_to_response(updated)


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
    return await _case_to_response(case)


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
    return await _case_to_response(case)


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
    return await _case_to_response(case)


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
    return await _case_to_response(case)


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
            "category": log.get("category", ""),
            "action": log["action"],
            "actorId": log.get("actorId", ""),
            "actorName": log.get("actorName", ""),
            "details": log.get("details", {}),
            "changes": log.get("changes", {}),
            "correlationId": log.get("correlationId", ""),
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
