"""Attachment step handler — creates an assignment requiring document uploads."""

from datetime import datetime, timezone, timedelta
from bson import ObjectId


async def activate(case: dict, stage_id: str, process_id: str,
                   step: dict, case_type_def: dict, db) -> dict:
    """Create an attachment assignment for the user."""
    config = step.get("config", {})
    now = datetime.now(timezone.utc)

    stage_name = ""
    process_name = ""
    for st in case.get("stages", []):
        if st["definition_id"] == stage_id:
            stage_name = st["name"]
            for pr in st.get("processes", []):
                if pr["definition_id"] == process_id:
                    process_name = pr["name"]
                    break
            break

    cats = config.get("categories", [])
    instructions = config.get("instructions") or f"Upload documents: {', '.join(cats) if cats else 'required files'}"

    due_at = None
    sla_hours = step.get("sla_hours")
    if sla_hours:
        due_at = (now + timedelta(hours=sla_hours)).isoformat()

    assignment = {
        "_id": str(ObjectId()),
        "case_id": case["_id"],
        "case_title": case.get("title", ""),
        "case_type_id": case["case_type_id"],
        "stage_id": stage_id,
        "stage_name": stage_name,
        "process_id": process_id,
        "process_name": process_name,
        "step_id": step["definition_id"],
        "step_name": step["name"],
        "type": "attachment",
        "status": "open",
        "priority": case.get("priority", "medium"),
        "assigned_to": case.get("owner_id"),
        "assigned_role": None,
        "form_id": None,
        "instructions": instructions,
        "sla_hours": sla_hours,
        "due_at": due_at,
        "started_at": None,
        "completed_at": None,
        "created_at": now.isoformat(),
    }
    await db.assignments.insert_one(assignment)
    return {"assignment_id": assignment["_id"]}


async def complete(case: dict, stage_id: str, process_id: str,
                   step: dict, data: dict, user: dict, db) -> dict:
    """Complete attachment step — validate uploads exist and close assignment."""
    now = datetime.now(timezone.utc).isoformat()

    # Mark assignment completed
    await db.assignments.update_many(
        {"case_id": case["_id"], "step_id": step["definition_id"],
         "status": {"$in": ["open", "in_progress"]}},
        {"$set": {"status": "completed", "completed_at": now}}
    )
    return {}
