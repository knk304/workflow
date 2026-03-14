"""Lightweight case lifecycle engine — PEGA-inspired stage transitions."""

from datetime import datetime, timezone

# Default stage definitions per case type
WORKFLOW_DEFINITIONS: dict[str, dict] = {
    "loan_origination": {
        "stages": ["intake", "documents", "underwriting", "approval", "disbursement"],
        "transitions": [
            {"from": "intake", "action": "submit", "to": "documents", "roles": ["WORKER", "MANAGER"]},
            {"from": "documents", "action": "verify", "to": "underwriting", "roles": ["WORKER", "MANAGER"]},
            {"from": "underwriting", "action": "approve", "to": "approval", "roles": ["MANAGER"]},
            {"from": "underwriting", "action": "reject", "to": "intake", "roles": ["MANAGER"]},
            {"from": "approval", "action": "approve", "to": "disbursement", "roles": ["MANAGER", "ADMIN"]},
            {"from": "approval", "action": "reject", "to": "underwriting", "roles": ["MANAGER", "ADMIN"]},
            {"from": "disbursement", "action": "complete", "to": "disbursement", "roles": ["WORKER", "MANAGER"]},
        ],
    },
}


class TransitionDeniedError(Exception):
    pass


def get_next_stage(case_type: str, current_stage: str, action: str, user_role: str) -> str:
    """Determine the next stage given current state and action."""
    definition = WORKFLOW_DEFINITIONS.get(case_type)
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
