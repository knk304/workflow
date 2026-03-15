"""Case CRUD + stage transition + case types routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from bson import ObjectId
from datetime import datetime, timezone, timedelta

from auth_deps import get_current_user
from database import get_db
from id_utils import find_by_id, update_by_id
from models.cases import (
    CaseCreate, CaseUpdate, CaseResponse, CaseTypeResponse,
    TransitionRequest, SLAInfo, StageHistory, StageStatus,
)
from engine.lifecycle import (
    get_next_stage, get_first_stage, get_available_transitions,
    get_workflow_definition, build_stage_entry, complete_current_stage,
    TransitionDeniedError,
)

router = APIRouter(prefix="/api/cases", tags=["cases"])


def _to_response(doc: dict) -> CaseResponse:
    return CaseResponse(
        id=str(doc["_id"]),
        type=doc["type"],
        status=doc["status"],
        stage=doc["stage"],
        priority=doc["priority"],
        ownerId=doc["ownerId"],
        teamId=doc["teamId"],
        fields=doc.get("fields", {}),
        stages=[StageHistory(**s) for s in doc.get("stages", [])],
        sla=SLAInfo(**doc["sla"]),
        notes=doc.get("notes"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
        createdBy=doc["createdBy"],
    )


async def _write_audit(db, entity_id: str, action: str, user: dict, changes: dict | None = None):
    await db.audit_logs.insert_one({
        "entityType": "case",
        "entityId": entity_id,
        "action": action,
        "actorId": str(user["_id"]),
        "actorName": user.get("fullName", user.get("email", "")),
        "changes": changes or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ---------- CRUD ----------

@router.post("", status_code=status.HTTP_201_CREATED, response_model=CaseResponse)
async def create_case(body: CaseCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    sla_target = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    first_stage = await get_first_stage(body.type)

    doc = {
        "type": body.type,
        "status": "open",
        "stage": first_stage,
        "priority": body.priority.value,
        "ownerId": body.ownerId,
        "teamId": body.teamId,
        "fields": body.fields,
        "stages": [build_stage_entry(first_stage)],
        "sla": {
            "targetDate": sla_target,
            "targetResolutionDate": None,
            "daysRemaining": 30,
            "escalated": False,
            "escalationLevel": 0,
        },
        "notes": body.notes,
        "createdAt": now,
        "updatedAt": now,
        "createdBy": str(user["_id"]),
    }
    result = await db.cases.insert_one(doc)
    doc["_id"] = result.inserted_id
    await _write_audit(db, str(result.inserted_id), "created", user)
    return _to_response(doc)


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    ownerId: str | None = None,
    teamId: str | None = None,
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
    if ownerId:
        query["ownerId"] = ownerId
    if teamId:
        query["teamId"] = teamId
    cursor = db.cases.find(query).sort("updatedAt", -1).skip(skip).limit(limit)
    return [_to_response(doc) async for doc in cursor]


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(case_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.cases, case_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return _to_response(doc)


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(case_id: str, body: CaseUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates: dict = {}
    changes: dict = {}

    for field_name, value in body.model_dump(exclude_none=True).items():
        if isinstance(value, dict) and field_name == "fields":
            updates["fields"] = value
        else:
            updates[field_name] = value if not hasattr(value, "value") else value.value
        changes[field_name] = updates.get(field_name, value)

    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await update_by_id(db.cases, case_id, {"$set": updates})

    doc = await find_by_id(db.cases, case_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    await _write_audit(db, case_id, "updated", user, changes)
    return _to_response(doc)


# ---------- Stage transition ----------

@router.patch("/{case_id}/stage", response_model=CaseResponse)
async def transition_stage(
    case_id: str,
    body: TransitionRequest,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await find_by_id(db.cases, case_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    try:
        next_stage = await get_next_stage(
            doc["type"], doc["stage"], body.action, user.get("role", "WORKER")
        )
    except TransitionDeniedError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    stages = doc.get("stages", [])
    stages = complete_current_stage(stages, str(user["_id"]))
    stages.append(build_stage_entry(next_stage))

    new_status = doc["status"]
    definition = await get_workflow_definition(doc["type"])
    all_stages = definition.get("stages", []) if definition else []
    if all_stages and next_stage == all_stages[-1]:
        new_status = "resolved"

    now = datetime.now(timezone.utc).isoformat()
    await update_by_id(db.cases, case_id,
        {"$set": {
            "stage": next_stage,
            "stages": stages,
            "status": new_status,
            "updatedAt": now,
            "notes": body.notes if body.notes else doc.get("notes"),
        }},
    )

    await _write_audit(db, case_id, "stage_transition", user, {
        "from": doc["stage"],
        "to": next_stage,
        "action": body.action,
    })

    updated = await find_by_id(db.cases, case_id)
    return _to_response(updated)


# ---------- Available transitions ----------

@router.get("/{case_id}/transitions")
async def list_available_transitions(
    case_id: str,
    user: dict = Depends(get_current_user),
):
    """Return available stage transitions for the given case based on user role."""
    db = get_db()
    doc = await find_by_id(db.cases, case_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    user_role = user.get("role", "WORKER")
    transitions = await get_available_transitions(doc["type"], doc["stage"], user_role)
    return transitions
