"""Approval step handler — creates approval chain + assignment."""

from datetime import datetime, timezone, timedelta
from bson import ObjectId


async def activate(case: dict, stage_id: str, process_id: str,
                   step: dict, case_type_def: dict, db) -> dict:
    """Create an approval chain and assignment(s) for approvers."""
    config = step.get("config", {})
    now = datetime.now(timezone.utc)
    mode = config.get("mode", "sequential")

    # Build approver list
    approvers = []
    for i, uid in enumerate(config.get("approver_user_ids", [])):
        approvers.append({
            "user_id": uid,
            "sequence": i + 1,
            "status": "pending",
            "decision_at": None,
            "decision_notes": None,
        })
    # If no specific users, create placeholder approvers from roles
    if not approvers:
        for i, role in enumerate(config.get("approver_roles", ["MANAGER"])):
            approvers.append({
                "user_id": None,
                "user_role": role,
                "sequence": i + 1,
                "status": "pending",
                "decision_at": None,
                "decision_notes": None,
            })

    chain_id = str(ObjectId())
    chain = {
        "_id": chain_id,
        "case_id": case["_id"],
        "step_id": step["definition_id"],
        "stage_id": stage_id,
        "process_id": process_id,
        "mode": mode,
        "status": "pending",
        "approvers": approvers,
        "allow_delegation": config.get("allow_delegation", True),
        "rejection_stage_id": config.get("rejection_stage_id"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.approval_chains.insert_one(chain)

    # Resolve names for assignment
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
    sla_hours = step.get("sla_hours")
    if sla_hours:
        due_at = (now + timedelta(hours=sla_hours)).isoformat()

    # Create assignments: sequential → first approver only; parallel → all
    targets = approvers if mode == "parallel" else approvers[:1]
    for approver in targets:
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
            "type": "approval",
            "status": "open",
            "priority": case.get("priority", "medium"),
            "assigned_to": approver.get("user_id"),
            "assigned_role": approver.get("user_role"),
            "form_id": None,
            "instructions": f"Please review and approve/reject: {step['name']}",
            "sla_hours": sla_hours,
            "due_at": due_at,
            "started_at": None,
            "completed_at": None,
            "created_at": now.isoformat(),
        }
        await db.assignments.insert_one(assignment)

    return {"approval_chain_id": chain_id}


async def complete(case: dict, stage_id: str, process_id: str,
                   step: dict, data: dict, user: dict, db) -> dict:
    """
    Handle approval decision (approve/reject).
    Returns dict with 'rejected' key if rejected and has rejection_stage_id.
    """
    now = datetime.now(timezone.utc).isoformat()
    decision = data.get("decision", "approved")
    notes = data.get("notes", "")
    delegate_to = data.get("delegate_to")

    # Find the approval chain for this step
    chain = await db.approval_chains.find_one({
        "case_id": case["_id"],
        "step_id": step["definition_id"],
        "status": "pending",
    })

    result = {}
    if chain:
        # Handle delegation
        if delegate_to:
            await db.approval_chains.update_one(
                {"_id": chain["_id"], "approvers.user_id": str(user["_id"])},
                {"$set": {
                    "approvers.$.status": "delegated",
                    "approvers.$.delegated_to": delegate_to,
                    "updated_at": now,
                }}
            )
            # Create new assignment for delegate
            await db.assignments.insert_one({
                "_id": str(ObjectId()),
                "case_id": case["_id"],
                "case_title": case.get("title", ""),
                "case_type_id": case["case_type_id"],
                "stage_id": stage_id,
                "stage_name": "",
                "process_id": process_id,
                "process_name": "",
                "step_id": step["definition_id"],
                "step_name": step["name"],
                "type": "approval",
                "status": "open",
                "priority": case.get("priority", "medium"),
                "assigned_to": delegate_to,
                "instructions": f"Delegated approval: {step['name']}",
                "created_at": now,
            })
            return {"delegated": True}

        # Record decision on the approver
        user_id = str(user["_id"])
        await db.approval_chains.update_one(
            {"_id": chain["_id"], "approvers.user_id": user_id},
            {"$set": {
                "approvers.$.status": decision,
                "approvers.$.decision_at": now,
                "approvers.$.decision_notes": notes,
                "updated_at": now,
            }}
        )

        if decision == "rejected":
            await db.approval_chains.update_one(
                {"_id": chain["_id"]},
                {"$set": {"status": "rejected", "updated_at": now}}
            )
            # Close open assignments for this step
            await db.assignments.update_many(
                {"case_id": case["_id"], "step_id": step["definition_id"], "status": {"$in": ["open", "in_progress"]}},
                {"$set": {"status": "cancelled", "completed_at": now}}
            )
            rejection_stage = chain.get("rejection_stage_id")
            if rejection_stage:
                result["change_stage_to"] = rejection_stage
        else:
            # Check if all approvers are done
            refreshed = await db.approval_chains.find_one({"_id": chain["_id"]})
            approvers = refreshed.get("approvers", [])
            all_done = all(a["status"] in ("approved", "delegated") for a in approvers)

            if all_done:
                await db.approval_chains.update_one(
                    {"_id": chain["_id"]},
                    {"$set": {"status": "approved", "updated_at": now}}
                )
            elif chain.get("mode") == "sequential":
                # Activate next approver
                for a in approvers:
                    if a["status"] == "pending":
                        await db.assignments.insert_one({
                            "_id": str(ObjectId()),
                            "case_id": case["_id"],
                            "case_title": case.get("title", ""),
                            "case_type_id": case["case_type_id"],
                            "stage_id": stage_id,
                            "step_id": step["definition_id"],
                            "step_name": step["name"],
                            "type": "approval",
                            "status": "open",
                            "priority": case.get("priority", "medium"),
                            "assigned_to": a.get("user_id"),
                            "assigned_role": a.get("user_role"),
                            "instructions": f"Please approve: {step['name']}",
                            "created_at": now,
                        })
                        return {"pending_next_approver": True}

    # Close assignment
    await db.assignments.update_many(
        {"case_id": case["_id"], "step_id": step["definition_id"],
         "status": {"$in": ["open", "in_progress"]}},
        {"$set": {"status": "completed", "completed_at": now}}
    )
    return result
