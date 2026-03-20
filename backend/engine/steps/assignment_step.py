"""Assignment step handler — creates an Assignment record for a human worker."""

from datetime import datetime, timezone, timedelta
from bson import ObjectId


async def activate(case: dict, stage_id: str, process_id: str,
                   step: dict, case_type_def: dict, db) -> dict:
    """Create an assignment record when an assignment step is activated."""
    config = step.get("config", {})
    now = datetime.now(timezone.utc)

    # Resolve stage/process names from case runtime
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

    due_at = None
    sla_hours = step.get("sla_hours") or config.get("sla_hours")
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
        "type": "form" if config.get("form_id") else "action",
        "status": "open",
        "priority": case.get("priority", "medium"),
        "assigned_to": config.get("assignee_user_id"),
        "assigned_role": config.get("assignee_role"),
        "form_id": config.get("form_id"),
        "instructions": config.get("instructions"),
        "sla_hours": sla_hours,
        "due_at": due_at,
        "started_at": None,
        "completed_at": None,
        "created_at": now.isoformat(),
    }
    await db.assignments.insert_one(assignment)

    # Optionally set case status
    if config.get("set_case_status"):
        await db.cases.update_one(
            {"_id": case["_id"]},
            {"$set": {"status": config["set_case_status"], "updated_at": now.isoformat()}}
        )

    return {"assignment_id": assignment["_id"]}


async def complete(case: dict, stage_id: str, process_id: str,
                   step: dict, data: dict, user: dict, db) -> dict:
    """Complete an assignment step — save form data, close assignment."""
    now = datetime.now(timezone.utc).isoformat()

    # Save form submission if provided
    form_data = data.get("form_data")
    submission_id = None
    if form_data:
        from bson import ObjectId as OID
        submission_id = str(OID())
        await db.form_submissions.insert_one({
            "_id": submission_id,
            "form_id": step.get("config", {}).get("form_id"),
            "case_id": case["_id"],
            "step_id": step["definition_id"],
            "data": form_data,
            "submitted_by": str(user["_id"]),
            "submitted_at": now,
        })
        # Merge form data into case custom_fields
        custom_fields = case.get("custom_fields", {})
        custom_fields.update(form_data)
        await db.cases.update_one(
            {"_id": case["_id"]},
            {"$set": {"custom_fields": custom_fields, "updated_at": now}}
        )

    # Mark assignment as completed
    await db.assignments.update_one(
        {"case_id": case["_id"], "step_id": step["definition_id"], "status": {"$in": ["open", "in_progress"]}},
        {"$set": {"status": "completed", "completed_at": now}}
    )

    return {"form_submission_id": submission_id}
