"""
Process engine — orchestrates steps within a process and processes within a stage.

Responsibilities:
  - Start a process (evaluate start_when, activate first step)
  - Check if a process is complete after a step completes
  - Check if a stage is complete after a process completes
  - Start the next process in a stage
"""

from datetime import datetime, timezone
from engine.rule_engine import rule_engine


async def start_process(case: dict, stage_id: str, process: dict, db) -> dict:
    """
    Start a process: evaluate start_when, mark in_progress, activate first step.
    Returns updated case dict read back from DB.
    """
    now = datetime.now(timezone.utc).isoformat()
    data = case.get("custom_fields", {})

    # Evaluate start_when condition
    start_when = process.get("start_when")
    if start_when and not rule_engine.evaluate(start_when, data):
        # Skip this process
        await _update_process_status(case["_id"], stage_id, process["definition_id"],
                                     "skipped", now, db)
        return await db.cases.find_one({"_id": case["_id"]})

    # Mark process in_progress
    await _update_process_status(case["_id"], stage_id, process["definition_id"],
                                 "in_progress", now, db, set_started=True)

    # Activate first step
    steps = process.get("steps", [])
    if steps:
        sorted_steps = sorted(steps, key=lambda s: s.get("order", 0))
        from engine.step_engine import activate_step
        return await activate_step(case["_id"], stage_id, process["definition_id"],
                                   sorted_steps[0]["definition_id"], db)

    # No steps — auto-complete the process
    await _update_process_status(case["_id"], stage_id, process["definition_id"],
                                 "completed", now, db, set_completed=True)
    return await db.cases.find_one({"_id": case["_id"]})


async def check_process_completion(case_id: str, stage_id: str, process_id: str, db) -> bool:
    """
    After a step completes, check if the process is done.
    If not done, activate the next pending step.
    If done, check stage completion.
    Returns True if process is complete.
    """
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return False

    process = _find_process(case, stage_id, process_id)
    if not process:
        return False

    steps = process.get("steps", [])
    all_done = all(s["status"] in ("completed", "skipped") for s in steps)

    if all_done:
        now = datetime.now(timezone.utc).isoformat()
        await _update_process_status(case_id, stage_id, process_id, "completed",
                                     now, db, set_completed=True)

        # Check if stage is complete
        await check_stage_completion(case_id, stage_id, db)
        return True
    else:
        # Find next pending step and activate it
        sorted_steps = sorted(steps, key=lambda s: s.get("order", 0))
        for step in sorted_steps:
            if step["status"] == "pending":
                from engine.step_engine import activate_step
                await activate_step(case_id, stage_id, process_id,
                                    step["definition_id"], db)
                return False
    return False


async def check_stage_completion(case_id: str, stage_id: str, db) -> bool:
    """
    After a process completes, check if all processes in the stage are done.
    If done, apply on_complete action. If not, start next process.
    """
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return False

    stage = _find_stage(case, stage_id)
    if not stage:
        return False

    processes = stage.get("processes", [])
    all_done = all(p["status"] in ("completed", "skipped") for p in processes)

    if all_done:
        now = datetime.now(timezone.utc).isoformat()

        # Mark stage completed
        await _update_stage_status(case_id, stage_id, "completed", now, db, set_completed=True)

        # Apply on_complete action
        on_complete = stage.get("on_complete", "auto_advance")

        if on_complete == "resolve_case":
            from engine.lifecycle import resolve_case
            resolution = stage.get("resolution_status", "resolved_completed")
            await resolve_case(case_id, resolution)
        elif on_complete == "auto_advance":
            from engine.lifecycle import advance_to_next_stage
            await advance_to_next_stage(case_id, stage_id, db)
        # wait_for_user → do nothing, wait for manual advance

        return True
    else:
        # Start next pending process
        sorted_procs = sorted(processes, key=lambda p: p.get("order", 0))
        for proc in sorted_procs:
            if proc["status"] == "pending":
                case = await db.cases.find_one({"_id": case_id})
                await start_process(case, stage_id, proc, db)
                return False

    return False


# ── Helpers ──────────────────────────────────────────────

def _find_stage(case: dict, stage_id: str) -> dict | None:
    for s in case.get("stages", []):
        if s["definition_id"] == stage_id:
            return s
    return None


def _find_process(case: dict, stage_id: str, process_id: str) -> dict | None:
    stage = _find_stage(case, stage_id)
    if not stage:
        return None
    for p in stage.get("processes", []):
        if p["definition_id"] == process_id:
            return p
    return None


async def _update_process_status(case_id: str, stage_id: str, process_id: str,
                                  status: str, now: str, db,
                                  set_started: bool = False, set_completed: bool = False):
    """Update a nested process status inside the case document."""
    set_fields: dict = {
        "updated_at": now,
    }
    # MongoDB positional operator doesn't support nested arrays directly,
    # so we read-modify-write the stages array.
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return
    stages = case.get("stages", [])
    for stage in stages:
        if stage["definition_id"] == stage_id:
            for proc in stage.get("processes", []):
                if proc["definition_id"] == process_id:
                    proc["status"] = status
                    if set_started and not proc.get("started_at"):
                        proc["started_at"] = now
                    if set_completed:
                        proc["completed_at"] = now
                    break
            break
    await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, **set_fields}})


async def _update_stage_status(case_id: str, stage_id: str, status: str, now: str, db,
                                set_completed: bool = False):
    """Update a stage status inside the case document."""
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return
    stages = case.get("stages", [])
    for stage in stages:
        if stage["definition_id"] == stage_id:
            stage["status"] = status
            if set_completed:
                stage["completed_at"] = now
            break
    await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, "updated_at": now}})
