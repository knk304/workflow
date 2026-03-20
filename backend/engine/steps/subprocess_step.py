"""Subprocess step handler — spawns a child case and waits for resolution."""

from datetime import datetime, timezone


async def activate(case: dict, stage_id: str, process_id: str,
                   step: dict, case_type_def: dict, db) -> dict:
    """
    Create a child case from the configured child_case_type_id.
    Mark this step as 'waiting' until the child resolves.
    """
    config = step.get("config", {})
    child_type_id = config.get("child_case_type_id")
    if not child_type_id:
        return {"auto_complete": True, "error": "no child_case_type_id configured"}

    field_mapping = config.get("field_mapping", {})
    parent_fields = case.get("custom_fields", {})

    # Map parent fields to child
    child_fields = {}
    for parent_key, child_key in field_mapping.items():
        if parent_key in parent_fields:
            child_fields[child_key] = parent_fields[parent_key]

    # Defer to lifecycle.instantiate_case (imported late to avoid circular)
    from engine.lifecycle import instantiate_case
    child_case = await instantiate_case(
        case_type_id=child_type_id,
        title=f"Subprocess: {step['name']} (from {case['_id']})",
        owner_id=case.get("owner_id", "system"),
        team_id=case.get("team_id"),
        custom_fields=child_fields,
        created_by=case.get("owner_id", "system"),
        parent_case_id=case["_id"],
        parent_step_id=step["definition_id"],
    )

    if not child_case:
        return {"auto_complete": True, "error": f"Failed to create child case type {child_type_id}"}

    return {
        "auto_complete": False,  # step stays in 'waiting'
        "status_override": "waiting",
        "child_case_id": child_case["_id"],
    }


async def on_child_resolved(parent_case: dict, step: dict, child_case: dict, db) -> dict:
    """Called when a child case resolves — propagate fields back and complete parent step."""
    config = step.get("config", {})
    propagate = config.get("propagate_fields", {})
    now = datetime.now(timezone.utc).isoformat()

    child_fields = child_case.get("custom_fields", {})
    updates = {}
    for child_key, parent_key in propagate.items():
        if child_key in child_fields:
            updates[f"custom_fields.{parent_key}"] = child_fields[child_key]

    if updates:
        updates["updated_at"] = now
        await db.cases.update_one({"_id": parent_case["_id"]}, {"$set": updates})

    return {"propagated_fields": list(propagate.keys())}


async def complete(case: dict, stage_id: str, process_id: str,
                   step: dict, data: dict, user: dict, db) -> dict:
    """Subprocess steps complete via on_child_resolved, not manual completion."""
    return {}
