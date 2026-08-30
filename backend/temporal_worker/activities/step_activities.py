"""Step-level activities — wrap existing step_engine and process_engine."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from temporalio import activity

from database import get_db


@dataclass
class CompleteStepParams:
    case_id: str
    stage_id: str
    process_id: str
    step_id: str
    completed_by: str
    form_data: dict | None = None
    notes: str | None = None
    config: dict | None = None


@dataclass
class GetStepStatusParams:
    case_id: str
    stage_id: str
    process_id: str
    step_id: str


@dataclass
class RunAutomationStepParams:
    case_id: str
    stage_id: str
    process_id: str
    step_id: str
    config: dict


# ── Queries ──────────────────────────────────────────────────────────

@activity.defn
async def get_step_status_activity(params: GetStepStatusParams) -> dict:
    """Return current runtime status of a specific step."""
    db = get_db()
    case = await db.cases.find_one({"_id": params.case_id})
    if not case:
        raise ValueError(f"Case {params.case_id} not found")
    for stage in case.get("stages", []):
        if stage["definition_id"] != params.stage_id:
            continue
        for process in stage.get("processes", []):
            if process["definition_id"] != params.process_id:
                continue
            for step in process.get("steps", []):
                if step["definition_id"] == params.step_id:
                    return {"status": step["status"], "step": step}
    return {"status": "not_found"}


@activity.defn
async def get_active_step_activity(case_id: str) -> dict | None:
    """Return the currently active (in_progress) step, if any."""
    db = get_db()
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return None
    for stage in case.get("stages", []):
        if stage.get("status") != "in_progress":
            continue
        for process in stage.get("processes", []):
            if process.get("status") != "in_progress":
                continue
            for step in process.get("steps", []):
                if step.get("status") == "in_progress":
                    # Look up the blueprint config so automation hooks (e.g. simulate_failures) are visible to the workflow
                    config = {}
                    case_type_def = await db.case_type_definitions.find_one({"_id": case["case_type_id"]})
                    if case_type_def:
                        for bp_stage in case_type_def.get("stages", []):
                            if bp_stage.get("id") != stage["definition_id"]:
                                continue
                            for bp_proc in bp_stage.get("processes", []):
                                if bp_proc.get("id") != process["definition_id"]:
                                    continue
                                for bp_step in bp_proc.get("steps", []):
                                    if bp_step.get("id") == step["definition_id"]:
                                        config = bp_step.get("config", {})
                    return {
                        "stage_id": stage["definition_id"],
                        "process_id": process["definition_id"],
                        "step_id": step["definition_id"],
                        "step_type": step.get("type"),
                        "step_name": step.get("name"),
                        "config": config,
                    }
    return None


# ── Completion ───────────────────────────────────────────────────────

@activity.defn
async def complete_step_activity(params: CompleteStepParams) -> dict:
    """
    Complete a step using the existing step_engine handler.
    Used by the workflow to durably complete automation steps.
    Human steps are completed via the API → signal path.
    """
    from engine.steps.automation_step import complete as automation_complete

    db = get_db()
    case = await db.cases.find_one({"_id": params.case_id})
    if not case:
        raise ValueError(f"Case {params.case_id} not found")

    step = _find_step(case, params.stage_id, params.process_id, params.step_id)
    if not step:
        raise ValueError(f"Step {params.step_id} not found")

    if step.get("status") not in ("in_progress", "pending"):
        return {"skipped": True, "status": step["status"]}

    if step.get("type") == "automation":
        # Demo/test hook: force the activity to fail on the first N attempts so
        # Temporal's retry policy kicks in and the attempt shows up as a pending activity.
        simulate_failures = (params.config or {}).get("simulate_failures", 0)
        if simulate_failures and activity.info().attempt <= simulate_failures:
            raise RuntimeError(
                f"Simulated transient failure (attempt {activity.info().attempt} of {simulate_failures})"
            )
        await automation_complete(
            case, params.stage_id, params.process_id, params.step_id,
            params.completed_by, db
        )
    else:
        # Generic field update for non-automation steps completed via API
        now = datetime.now(timezone.utc).isoformat()
        await db.cases.update_one(
            {"_id": params.case_id,
             "stages.definition_id": params.stage_id},
            {"$set": {
                "stages.$[stage].processes.$[proc].steps.$[step].status": "completed",
                "stages.$[stage].processes.$[proc].steps.$[step].completed_at": now,
                "stages.$[stage].processes.$[proc].steps.$[step].notes": params.notes,
                "updated_at": now,
            }},
            array_filters=[
                {"stage.definition_id": params.stage_id},
                {"proc.definition_id": params.process_id},
                {"step.definition_id": params.step_id},
            ]
        )

    updated = await db.cases.find_one({"_id": params.case_id})
    return {"completed": True, "case_status": updated.get("status")}


# ── Helpers ──────────────────────────────────────────────────────────

def _find_step(case: dict, stage_id: str, process_id: str, step_id: str) -> dict | None:
    for stage in case.get("stages", []):
        if stage["definition_id"] != stage_id:
            continue
        for process in stage.get("processes", []):
            if process["definition_id"] != process_id:
                continue
            for step in process.get("steps", []):
                if step["definition_id"] == step_id:
                    return step
    return None
