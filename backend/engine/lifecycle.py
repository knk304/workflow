"""Dynamic case lifecycle engine — reads workflow definitions from MongoDB."""

from datetime import datetime, timezone
from database import get_db


class TransitionDeniedError(Exception):
    pass


async def get_workflow_definition(case_type_slug: str) -> dict | None:
    """Load workflow definition (stages + transitions) from case_types collection."""
    db = get_db()
    doc = await db.case_types.find_one({"slug": case_type_slug})
    if not doc:
        return None
    return {
        "stages": doc.get("stages", []),
        "transitions": doc.get("transitions", []),
    }


async def get_next_stage(case_type: str, current_stage: str, action: str, user_role: str) -> str:
    """Determine the next stage given current state and action."""
    definition = await get_workflow_definition(case_type)
    if not definition:
        raise TransitionDeniedError(f"Unknown case type: {case_type}")

    for t in definition["transitions"]:
        if t["from"] == current_stage and t["action"] == action:
            if user_role not in t["roles"]:
                raise TransitionDeniedError(
                    f"Role '{user_role}' cannot perform '{action}' at stage '{current_stage}'"
                )
            return t["to"]

    raise TransitionDeniedError(
        f"No transition found: stage='{current_stage}', action='{action}'"
    )


async def get_available_transitions(case_type: str, current_stage: str, user_role: str) -> list[dict]:
    """Return available transitions for a given case type, stage, and role."""
    definition = await get_workflow_definition(case_type)
    if not definition:
        return []
    return [
        {"action": t["action"], "to": t["to"], "from": t["from"]}
        for t in definition["transitions"]
        if t["from"] == current_stage and user_role in t["roles"]
    ]


async def get_first_stage(case_type: str) -> str:
    """Return the first stage for a case type, defaulting to 'intake'."""
    definition = await get_workflow_definition(case_type)
    if definition and definition["stages"]:
        return definition["stages"][0]
    return "intake"


def build_stage_entry(stage_name: str) -> dict:
    return {
        "name": stage_name,
        "status": "in_progress",
        "enteredAt": datetime.now(timezone.utc).isoformat(),
        "completedAt": None,
        "completedBy": None,
    }


def complete_current_stage(stages: list[dict], actor_id: str) -> list[dict]:
    """Mark the last stage as completed."""
    if stages:
        stages[-1]["status"] = "completed"
        stages[-1]["completedAt"] = datetime.now(timezone.utc).isoformat()
        stages[-1]["completedBy"] = actor_id
    return stages
