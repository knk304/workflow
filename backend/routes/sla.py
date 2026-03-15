"""SLA engine — background worker + routes for SLA definitions and dashboard."""

from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone, timedelta

from auth_deps import get_current_user
from database import get_db
from id_utils import find_by_id, update_by_id
from models.phase2 import SLADefinitionCreate, SLADefinitionResponse

router = APIRouter(prefix="/api/sla", tags=["sla"])


def _to_response(doc: dict) -> SLADefinitionResponse:
    return SLADefinitionResponse(
        id=str(doc["_id"]),
        case_type_id=doc["case_type_id"],
        stage=doc["stage"],
        hours_target=doc["hours_target"],
        escalation_enabled=doc.get("escalation_enabled", True),
        escalate_to_role=doc.get("escalate_to_role", "MANAGER"),
        created_at=doc["created_at"],
    )


# ---------- SLA Definition CRUD ----------

@router.post("/definitions", status_code=status.HTTP_201_CREATED, response_model=SLADefinitionResponse)
async def create_sla_definition(body: SLADefinitionCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "case_type_id": body.case_type_id,
        "stage": body.stage,
        "hours_target": body.hours_target,
        "escalation_enabled": body.escalation_enabled,
        "escalate_to_role": body.escalate_to_role,
        "created_at": now,
    }
    result = await db.sla_definitions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.get("/definitions", response_model=list[SLADefinitionResponse])
async def list_sla_definitions(
    case_type_id: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if case_type_id:
        query["case_type_id"] = case_type_id
    cursor = db.sla_definitions.find(query)
    return [_to_response(doc) async for doc in cursor]


# ---------- SLA Dashboard ----------

@router.get("/dashboard")
async def sla_dashboard(user: dict = Depends(get_current_user)):
    """Get SLA heatmap data — at-risk cases color-coded by urgency."""
    db = get_db()
    now = datetime.now(timezone.utc)

    cases = []
    cursor = db.cases.find({"status": {"$in": ["open", "pending"]}})
    async for doc in cursor:
        sla = doc.get("sla", {})
        target_str = sla.get("targetDate")
        if not target_str:
            continue

        target = datetime.fromisoformat(target_str.replace("Z", "+00:00"))
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)

        total_hours = max((target - datetime.fromisoformat(doc["createdAt"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)).total_seconds() / 3600, 1)
        elapsed_hours = (now - datetime.fromisoformat(doc["createdAt"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)).total_seconds() / 3600
        pct = (elapsed_hours / total_hours) * 100
        remaining_hours = max(0, (target - now).total_seconds() / 3600)

        risk = "normal"
        if pct >= 125:
            risk = "critical"
        elif pct >= 100:
            risk = "breached"
        elif pct >= 75:
            risk = "warning"

        cases.append({
            "id": str(doc["_id"]),
            "type": doc["type"],
            "stage": doc["stage"],
            "priority": doc["priority"],
            "owner_id": doc["ownerId"],
            "sla_target": target_str,
            "percentage_elapsed": round(pct, 1),
            "remaining_hours": round(remaining_hours, 1),
            "risk": risk,
            "escalated": sla.get("escalated", False),
            "escalation_level": sla.get("escalationLevel", 0),
        })

    # Sort by risk severity
    risk_order = {"critical": 0, "breached": 1, "warning": 2, "normal": 3}
    cases.sort(key=lambda c: risk_order.get(c["risk"], 4))

    return {
        "summary": {
            "total": len(cases),
            "critical": sum(1 for c in cases if c["risk"] == "critical"),
            "breached": sum(1 for c in cases if c["risk"] == "breached"),
            "warning": sum(1 for c in cases if c["risk"] == "warning"),
            "normal": sum(1 for c in cases if c["risk"] == "normal"),
        },
        "cases": cases,
    }


@router.post("/{case_id}/acknowledge")
async def acknowledge_sla(case_id: str, user: dict = Depends(get_current_user)):
    """Acknowledge SLA warning to suppress further alerts."""
    db = get_db()
    doc = await find_by_id(db.cases, case_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    now = datetime.now(timezone.utc).isoformat()
    await update_by_id(db.cases, case_id,
        {"$set": {"sla.acknowledged_at": now, "sla.acknowledged_by": str(user["_id"])}},
    )
    return {"acknowledged": True, "case_id": case_id}


# ---------- SLA Background Worker Logic ----------

async def check_sla_breaches():
    """Called by scheduler every 15 min to check and escalate SLAs."""
    from database import get_db
    db = get_db()
    now = datetime.now(timezone.utc)

    cursor = db.cases.find({"status": {"$in": ["open", "pending"]}})
    async for doc in cursor:
        sla = doc.get("sla", {})
        target_str = sla.get("targetDate")
        if not target_str:
            continue

        # Skip already acknowledged
        if sla.get("acknowledged_at"):
            continue

        target = datetime.fromisoformat(target_str.replace("Z", "+00:00"))
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)

        created = datetime.fromisoformat(doc["createdAt"].replace("Z", "+00:00"))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)

        total_hours = max((target - created).total_seconds() / 3600, 1)
        elapsed_hours = (now - created).total_seconds() / 3600
        pct = (elapsed_hours / total_hours) * 100
        current_level = sla.get("escalationLevel", 0)

        new_level = current_level
        if pct >= 125 and current_level < 2:
            new_level = 2
        elif pct >= 100 and current_level < 1:
            new_level = 1
        elif pct >= 75 and current_level < 0:
            new_level = 0

        if new_level > current_level or (pct >= 75 and current_level == 0 and not sla.get("escalated")):
            escalated = pct >= 100
            await db.cases.update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "sla.escalated": escalated,
                    "sla.escalationLevel": new_level,
                }},
            )

            # Create notification
            level_labels = {0: "SLA Warning (75%)", 1: "SLA Breach (100%)", 2: "Critical Escalation (125%)"}
            await db.notifications.insert_one({
                "userId": doc["ownerId"],
                "type": "sla_warning",
                "title": level_labels.get(new_level, "SLA Alert"),
                "message": f"Case {doc['_id']} has reached {round(pct)}% of SLA target",
                "entityType": "case",
                "entityId": str(doc["_id"]),
                "isRead": False,
                "createdAt": now.isoformat(),
            })
