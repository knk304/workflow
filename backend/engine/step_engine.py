"""
Step engine — activates and completes individual steps.

Delegates to step-type-specific handlers in engine/steps/.
After completion, triggers process_engine.check_process_completion().
"""

from datetime import datetime, timezone
from engine.rule_engine import rule_engine
from engine.steps import (
    assignment_step,
    approval_step,
    attachment_step,
    decision_step,
    automation_step,
    subprocess_step,
)

# Step type → handler module
STEP_HANDLERS = {
    "assignment": assignment_step,
    "approval": approval_step,
    "attachment": attachment_step,
    "decision": decision_step,
    "automation": automation_step,
    "subprocess": subprocess_step,
}


async def activate_step(case_id: str, stage_id: str, process_id: str,
                         step_def_id: str, db) -> dict:
    """
    Activate a step: evaluate skip_when, delegate to type handler.
    Returns refreshed case document.
    """
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise ValueError(f"Case {case_id} not found")

    step = _find_step(case, stage_id, process_id, step_def_id)
    if not step:
        raise ValueError(f"Step {step_def_id} not found in case {case_id}")

    # Load the case type definition for config lookup
    case_type_def = await db.case_type_definitions.find_one({"_id": case["case_type_id"]})
    step_config = _get_step_config(case_type_def, stage_id, process_id, step_def_id) if case_type_def else {}

    # Merge blueprint config into the runtime step
    step_with_config = {**step}
    if step_config:
        step_with_config["config"] = step_config.get("config", {})
        step_with_config["sla_hours"] = step_config.get("sla_hours")

    now = datetime.now(timezone.utc).isoformat()
    data = case.get("custom_fields", {})

    # Evaluate skip_when
    skip_when = step_config.get("skip_when") if step_config else None
    if skip_when and rule_engine.evaluate(skip_when, data):
        await _update_step_status(case_id, stage_id, process_id, step_def_id,
                                  "skipped", now, db, skipped_reason="skip_when condition met")
        # Check if process is complete
        from engine.process_engine import check_process_completion
        await check_process_completion(case_id, stage_id, process_id, db)
        return await db.cases.find_one({"_id": case_id})

    # Mark step in_progress
    await _update_step_status(case_id, stage_id, process_id, step_def_id,
                              "in_progress", now, db, set_started=True)

    # Resolve form fields for human steps (assignment, approval, attachment)
    # Populate from FormDefinition if form_id is set and no inline form_fields
    if step["type"] in ("assignment", "approval", "attachment"):
        config = step_config.get("config", {}) if step_config else {}
        # Also check runtime step config as fallback
        runtime_config = step.get("config") or {}
        inline_fields = config.get("form_fields") or runtime_config.get("form_fields") or []
        form_id = config.get("form_id") or runtime_config.get("form_id")
        if not inline_fields and form_id:
            form_def = await db.case_forms.find_one({"_id": form_id})
            if form_def:
                inline_fields = form_def.get("fields", [])
        if inline_fields:
            await _update_step_extras(case_id, stage_id, process_id, step_def_id,
                                      {"form_fields": inline_fields}, now, db)

    # Update current pointers
    await db.cases.update_one({"_id": case_id}, {"$set": {
        "current_stage_id": stage_id,
        "current_process_id": process_id,
        "current_step_id": step_def_id,
        "status": "in_progress",
        "updated_at": now,
    }})

    # Refresh case
    case = await db.cases.find_one({"_id": case_id})

    # Delegate to handler
    handler = STEP_HANDLERS.get(step["type"])
    if not handler:
        raise ValueError(f"Unknown step type: {step['type']}")

    result = await handler.activate(case, stage_id, process_id, step_with_config, case_type_def or {}, db)

    # Handle auto-completing steps (decision, automation)
    if result.get("auto_complete"):
        # Record decision branch if applicable
        extra: dict = {}
        if result.get("decision_branch_taken"):
            extra["decision_branch_taken"] = result["decision_branch_taken"]

        await _update_step_status(case_id, stage_id, process_id, step_def_id,
                                  "completed", now, db, set_completed=True, extras=extra)

        # For decision steps, skip to the target step
        next_step_id = result.get("next_step_id")
        if next_step_id:
            await _skip_steps_between(case_id, stage_id, process_id, step_def_id,
                                      next_step_id, now, db)
            # Also skip other branch targets that weren't chosen
            if step["type"] == "decision" and step_with_config.get("config"):
                other_ids = _get_other_branch_targets(step_with_config["config"], next_step_id)
                if other_ids:
                    await _skip_specific_steps(case_id, stage_id, process_id, other_ids, now, db)
            # Activate the target step
            return await activate_step(case_id, stage_id, process_id, next_step_id, db)

        # Handle change_stage from automation
        for ar in result.get("action_results", []):
            if ar.get("change_stage_to"):
                from engine.lifecycle import change_stage
                return await change_stage(case_id, ar["change_stage_to"],
                                           "automation action", {"_id": "system"})

        # Normal auto-complete → check process completion
        from engine.process_engine import check_process_completion
        await check_process_completion(case_id, stage_id, process_id, db)
        return await db.cases.find_one({"_id": case_id})

    # Handle subprocess waiting state
    if result.get("status_override") == "waiting":
        await _update_step_status(case_id, stage_id, process_id, step_def_id,
                                  "waiting", now, db,
                                  extras={"child_case_id": result.get("child_case_id")})

    return await db.cases.find_one({"_id": case_id})


async def complete_step(case_id: str, step_def_id: str, data: dict, user: dict, db) -> dict:
    """
    Complete a human step (assignment, approval, attachment).
    Finds the step location in the nested hierarchy, delegates to handler, then checks completion.
    """
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise ValueError(f"Case {case_id} not found")

    # Find the step and its stage/process context
    stage_id, process_id, step = _find_step_global(case, step_def_id)
    if not step:
        raise ValueError(f"Step {step_def_id} not found in case {case_id}")

    if step["status"] == "completed":
        # Already completed — idempotent, just return current case state
        return await db.cases.find_one({"_id": case_id})
    if step["status"] not in ("in_progress", "waiting"):
        raise ValueError(f"Step {step_def_id} is not active (status: {step['status']})") 

    # Load config from case type definition
    case_type_def = await db.case_type_definitions.find_one({"_id": case["case_type_id"]})
    step_config = _get_step_config(case_type_def, stage_id, process_id, step_def_id) if case_type_def else {}
    step_with_config = {**step}
    if step_config:
        step_with_config["config"] = step_config.get("config", {})

    now = datetime.now(timezone.utc).isoformat()

    # Delegate to handler
    handler = STEP_HANDLERS.get(step["type"])
    if not handler:
        raise ValueError(f"Unknown step type: {step['type']}")

    result = await handler.complete(case, stage_id, process_id, step_with_config, data, user, db)

    # Handle approval rejection → change stage
    if result.get("change_stage_to"):
        await _update_step_status(case_id, stage_id, process_id, step_def_id,
                                  "completed", now, db, set_completed=True,
                                  extras={"notes": data.get("notes", "rejected")})
        from engine.lifecycle import change_stage
        return await change_stage(case_id, result["change_stage_to"],
                                   "approval rejected", user)

    # Handle delegation — don't complete the step yet
    if result.get("delegated") or result.get("pending_next_approver"):
        return await db.cases.find_one({"_id": case_id})

    # Mark step completed
    extras: dict = {}
    if data.get("notes"):
        extras["notes"] = data["notes"]

    await _update_step_status(case_id, stage_id, process_id, step_def_id,
                              "completed", now, db, set_completed=True, extras=extras)

    # Write audit log
    await db.audit_logs.insert_one({
        "entityType": "case",
        "entityId": case_id,
        "action": f"step_completed:{step['name']}",
        "actorId": str(user["_id"]),
        "actorName": user.get("name", user.get("email", "")),
        "changes": {"step_id": step_def_id, "step_type": step["type"]},
        "timestamp": now,
    })

    # Check process completion
    from engine.process_engine import check_process_completion
    await check_process_completion(case_id, stage_id, process_id, db)
    return await db.cases.find_one({"_id": case_id})


# ── Helpers ──────────────────────────────────────────────

def _find_step(case: dict, stage_id: str, process_id: str, step_def_id: str) -> dict | None:
    for stage in case.get("stages", []):
        if stage["definition_id"] == stage_id:
            for proc in stage.get("processes", []):
                if proc["definition_id"] == process_id:
                    for step in proc.get("steps", []):
                        if step["definition_id"] == step_def_id:
                            return step
    return None


def _find_step_global(case: dict, step_def_id: str) -> tuple[str | None, str | None, dict | None]:
    """Find step by definition_id anywhere in the case, return (stage_id, process_id, step)."""
    for stage in case.get("stages", []):
        for proc in stage.get("processes", []):
            for step in proc.get("steps", []):
                if step["definition_id"] == step_def_id:
                    return stage["definition_id"], proc["definition_id"], step
    return None, None, None


def _get_step_config(case_type_def: dict, stage_id: str, process_id: str, step_def_id: str) -> dict:
    """Get the step definition from the case type blueprint."""
    if not case_type_def:
        return {}
    for stage in case_type_def.get("stages", []):
        if stage.get("id") == stage_id:
            for proc in stage.get("processes", []):
                if proc.get("id") == process_id:
                    for step in proc.get("steps", []):
                        if step.get("id") == step_def_id:
                            return step
    return {}


async def _update_step_status(case_id: str, stage_id: str, process_id: str,
                                step_def_id: str, status: str, now: str, db,
                                set_started: bool = False, set_completed: bool = False,
                                skipped_reason: str | None = None, extras: dict | None = None):
    """Update a nested step status using read-modify-write."""
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return
    stages = case.get("stages", [])
    for stage in stages:
        if stage["definition_id"] == stage_id:
            for proc in stage.get("processes", []):
                if proc["definition_id"] == process_id:
                    for step in proc.get("steps", []):
                        if step["definition_id"] == step_def_id:
                            step["status"] = status
                            if set_started and not step.get("started_at"):
                                step["started_at"] = now
                            if set_completed:
                                step["completed_at"] = now
                            if skipped_reason:
                                step["skipped_reason"] = skipped_reason
                            if extras:
                                step.update(extras)
                            break
                    break
            break
    await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, "updated_at": now}})


def _get_other_branch_targets(config: dict, chosen_step_id: str) -> set:
    """Return step IDs from decision branches that were NOT chosen."""
    targets = set()
    for branch in config.get("branches", []):
        sid = branch.get("next_step_id")
        if sid and sid != chosen_step_id:
            targets.add(sid)
    default = config.get("default_step_id")
    if default and default != chosen_step_id:
        targets.add(default)
    return targets


async def _skip_specific_steps(case_id: str, stage_id: str, process_id: str,
                                step_ids: set, now: str, db):
    """Skip specific steps by definition_id in the same process."""
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return
    stages = case.get("stages", [])
    for stage in stages:
        if stage["definition_id"] == stage_id:
            for proc in stage.get("processes", []):
                if proc["definition_id"] == process_id:
                    for step in proc.get("steps", []):
                        if step["definition_id"] in step_ids and step["status"] == "pending":
                            step["status"] = "skipped"
                            step["skipped_reason"] = "decision branch not taken"
                    break
            break
    await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, "updated_at": now}})


async def _skip_steps_between(case_id: str, stage_id: str, process_id: str,
                                from_step_id: str, to_step_id: str, now: str, db):
    """Skip all steps between from_step and to_step in the same process."""
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return
    stages = case.get("stages", [])
    for stage in stages:
        if stage["definition_id"] == stage_id:
            for proc in stage.get("processes", []):
                if proc["definition_id"] == process_id:
                    steps = sorted(proc.get("steps", []), key=lambda s: s.get("order", 0))
                    skipping = False
                    for step in steps:
                        if step["definition_id"] == from_step_id:
                            skipping = True
                            continue
                        if step["definition_id"] == to_step_id:
                            break
                        if skipping and step["status"] == "pending":
                            step["status"] = "skipped"
                            step["skipped_reason"] = f"decision branch skipped to {to_step_id}"
                    break
            break
    await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, "updated_at": now}})


async def _update_step_extras(case_id: str, stage_id: str, process_id: str,
                               step_def_id: str, extras: dict, now: str, db):
    """Update extra fields on a step (e.g. form_fields) without changing status."""
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return
    stages = case.get("stages", [])
    for stage in stages:
        if stage["definition_id"] == stage_id:
            for proc in stage.get("processes", []):
                if proc["definition_id"] == process_id:
                    for step in proc.get("steps", []):
                        if step["definition_id"] == step_def_id:
                            step.update(extras)
                            break
                    break
            break
    await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, "updated_at": now}})
