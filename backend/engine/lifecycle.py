"""
Pega-Lite case lifecycle engine — instantiates, advances, and resolves cases.

Depends on:
  - engine/step_engine.py   (step activation/completion)
  - engine/process_engine.py (process orchestration)
  - engine/rule_engine.py    (condition evaluation)
"""

from datetime import datetime, timezone
from database import get_db
from engine.rule_engine import rule_engine


class TransitionDeniedError(Exception):
    pass


# ── Case Instantiation ────────────────────────────────────

async def instantiate_case(
    case_type_id: str,
    title: str,
    owner_id: str,
    team_id: str | None = None,
    priority: str = "medium",
    custom_fields: dict | None = None,
    created_by: str | None = None,
    parent_case_id: str | None = None,
    parent_step_id: str | None = None,
) -> dict | None:
    """
    Create a new case from a case type definition.
    1. Load blueprint
    2. Generate case ID with prefix
    3. Deep-copy stages → processes → steps into runtime instances
    4. Set first primary stage to in_progress
    5. Start first process + first step
    6. Return case instance
    """
    db = get_db()
    case_type = await db.case_type_definitions.find_one({"_id": case_type_id})
    if not case_type:
        return None

    now = datetime.now(timezone.utc).isoformat()
    prefix = case_type.get("prefix", "CASE")
    seq = await _next_sequence(db, prefix)
    case_id = f"{prefix}-{seq:03d}"

    # Deep-copy hierarchy into runtime instances
    stages_runtime = []
    for stage_def in case_type.get("stages", []):
        processes_runtime = []
        for proc_def in stage_def.get("processes", []):
            steps_runtime = []
            for step_def in proc_def.get("steps", []):
                step_config = step_def.get("config", {})
                steps_runtime.append({
                    "definition_id": step_def["id"],
                    "name": step_def["name"],
                    "type": step_def["type"],
                    "status": "pending",
                    "order": step_def.get("order", 0),
                    "required": step_def.get("required", True),
                    "config": step_config,
                    "form_fields": step_config.get("form_fields", []),
                    "sla_hours": step_def.get("sla_hours"),
                    "started_at": None,
                    "completed_at": None,
                    "assigned_to": None,
                    "form_submission_id": None,
                    "approval_chain_id": None,
                    "child_case_id": None,
                    "decision_branch_taken": None,
                    "skipped_reason": None,
                    "notes": None,
                    "sla_target": None,
                })
            processes_runtime.append({
                "definition_id": proc_def["id"],
                "name": proc_def["name"],
                "type": proc_def.get("type", "sequential"),
                "status": "pending",
                "order": proc_def.get("order", 0),
                "is_parallel": proc_def.get("is_parallel", False),
                "started_at": None,
                "completed_at": None,
                "steps": steps_runtime,
                "start_when": proc_def.get("start_when"),
            })
        stages_runtime.append({
            "definition_id": stage_def["id"],
            "name": stage_def["name"],
            "stage_type": stage_def.get("stage_type", "primary"),
            "status": "pending",
            "order": stage_def.get("order", 0),
            "on_complete": stage_def.get("on_complete", "auto_advance"),
            "resolution_status": stage_def.get("resolution_status"),
            "entered_at": None,
            "completed_at": None,
            "completed_by": None,
            "processes": processes_runtime,
        })

    case_doc = {
        "_id": case_id,
        "case_type_id": case_type_id,
        "case_type_name": case_type["name"],
        "title": title,
        "status": "open",
        "priority": priority,
        "owner_id": owner_id,
        "team_id": team_id,
        "custom_fields": custom_fields or {},
        "current_stage_id": None,
        "current_process_id": None,
        "current_step_id": None,
        "stages": stages_runtime,
        "created_by": created_by or owner_id,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "resolution_status": None,
        "parent_case_id": parent_case_id,
        "parent_step_id": parent_step_id,
        "sla_target_date": None,
        "sla_days_remaining": None,
        "escalation_level": 0,
    }

    await db.cases.insert_one(case_doc)

    # Write audit log
    await db.audit_logs.insert_one({
        "entityType": "case",
        "entityId": case_id,
        "action": "created",
        "actorId": created_by or owner_id,
        "actorName": "",
        "changes": {"case_type": case_type["name"], "title": title},
        "timestamp": now,
    })

    # Enter first primary stage
    first_stage = _get_first_primary_stage(stages_runtime)
    if first_stage:
        await _enter_stage(case_id, first_stage, db)

    return await db.cases.find_one({"_id": case_id})


# ── Stage Entry ────────────────────────────────────────────

async def _enter_stage(case_id: str, stage: dict, db):
    """Enter a stage: mark in_progress, start first process."""
    now = datetime.now(timezone.utc).isoformat()

    # Update stage status
    case = await db.cases.find_one({"_id": case_id})
    stages = case.get("stages", [])
    for s in stages:
        if s["definition_id"] == stage["definition_id"]:
            s["status"] = "in_progress"
            s["entered_at"] = now
            break
    await db.cases.update_one({"_id": case_id}, {"$set": {
        "stages": stages,
        "current_stage_id": stage["definition_id"],
        "status": "in_progress",
        "updated_at": now,
    }})

    # Start first process
    processes = sorted(stage.get("processes", []), key=lambda p: p.get("order", 0))
    if processes:
        case = await db.cases.find_one({"_id": case_id})
        from engine.process_engine import start_process
        await start_process(case, stage["definition_id"], processes[0], db)

        # Start parallel processes that should start alongside the first
        for proc in processes[1:]:
            if proc.get("is_parallel"):
                case = await db.cases.find_one({"_id": case_id})
                await start_process(case, stage["definition_id"], proc, db)
            else:
                break  # Sequential — stop at first non-parallel


async def advance_to_next_stage(case_id: str, completed_stage_id: str, db):
    """Find and enter the next primary stage, skipping if skip_when is met."""
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return

    stages = case.get("stages", [])
    primary_stages = sorted(
        [s for s in stages if s.get("stage_type") == "primary"],
        key=lambda s: s.get("order", 0)
    )

    # Find the next stage after the completed one
    found_completed = False
    for stage in primary_stages:
        if stage["definition_id"] == completed_stage_id:
            found_completed = True
            continue
        if not found_completed:
            continue

        # Evaluate skip_when
        case_type = await db.case_type_definitions.find_one({"_id": case["case_type_id"]})
        stage_def = _find_stage_def(case_type, stage["definition_id"]) if case_type else None
        skip_when = stage_def.get("skip_when") if stage_def else None
        data = case.get("custom_fields", {})

        if skip_when and rule_engine.evaluate(skip_when, data):
            # Skip this stage
            now = datetime.now(timezone.utc).isoformat()
            for s in stages:
                if s["definition_id"] == stage["definition_id"]:
                    s["status"] = "skipped"
                    break
            await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, "updated_at": now}})
            continue

        # Evaluate entry_criteria
        entry_criteria = stage_def.get("entry_criteria") if stage_def else None
        if entry_criteria and not rule_engine.evaluate(entry_criteria, data):
            # Cannot enter — park
            return

        # Enter this stage
        await _enter_stage(case_id, stage, db)
        return

    # No more stages — all done, resolve case
    await resolve_case(case_id, "resolved_completed")


# ── Change Stage (Alternate / Jump) ────────────────────────

async def change_stage(case_id: str, target_stage_id: str, reason: str,
                        user: dict | None = None) -> dict:
    """Jump to an alternate stage (or any stage). Cancels current work."""
    db = get_db()
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise TransitionDeniedError(f"Case {case_id} not found")

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user["_id"]) if user else "system"

    # Cancel open assignments for current stage
    current_stage_id = case.get("current_stage_id")
    if current_stage_id:
        await db.assignments.update_many(
            {"case_id": case_id, "stage_id": current_stage_id,
             "status": {"$in": ["open", "in_progress"]}},
            {"$set": {"status": "cancelled", "completed_at": now}}
        )

    # Mark current stage as cancelled
    stages = case.get("stages", [])
    for s in stages:
        if s["definition_id"] == current_stage_id and s["status"] == "in_progress":
            s["status"] = "cancelled"
            s["completed_at"] = now
            s["completed_by"] = user_id
            break

    await db.cases.update_one({"_id": case_id}, {"$set": {"stages": stages, "updated_at": now}})

    # Write audit log
    await db.audit_logs.insert_one({
        "entityType": "case",
        "entityId": case_id,
        "action": "stage_changed",
        "actorId": user_id,
        "actorName": user.get("name", "") if user else "system",
        "changes": {"from_stage": current_stage_id, "to_stage": target_stage_id, "reason": reason},
        "timestamp": now,
    })

    # Find target stage and enter it
    target_stage = None
    for s in stages:
        if s["definition_id"] == target_stage_id:
            target_stage = s
            break
    if not target_stage:
        raise TransitionDeniedError(f"Target stage {target_stage_id} not found")

    await _enter_stage(case_id, target_stage, db)
    return await db.cases.find_one({"_id": case_id})


# ── Case Resolution ────────────────────────────────────────

async def resolve_case(case_id: str, resolution_status: str,
                        user: dict | None = None) -> dict:
    """Resolve a case — cancel assignments, set status, notify parent."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user["_id"]) if user else "system"

    # Cancel all open assignments
    await db.assignments.update_many(
        {"case_id": case_id, "status": {"$in": ["open", "in_progress"]}},
        {"$set": {"status": "cancelled", "completed_at": now}}
    )

    # Update case
    await db.cases.update_one({"_id": case_id}, {"$set": {
        "status": resolution_status,
        "resolved_at": now,
        "resolution_status": resolution_status,
        "updated_at": now,
    }})

    # Write audit log
    await db.audit_logs.insert_one({
        "entityType": "case",
        "entityId": case_id,
        "action": "resolved",
        "actorId": user_id,
        "actorName": user.get("name", "") if user else "system",
        "changes": {"resolution_status": resolution_status},
        "timestamp": now,
    })

    # If this is a child case, complete the parent subprocess step
    case = await db.cases.find_one({"_id": case_id})
    if case and case.get("parent_case_id"):
        parent_id = case["parent_case_id"]
        parent_step_id = case.get("parent_step_id")
        if parent_step_id:
            from engine.steps.subprocess_step import on_child_resolved
            parent_case = await db.cases.find_one({"_id": parent_id})
            if parent_case:
                # Find the subprocess step
                _, _, step = _find_step_global(parent_case, parent_step_id)
                if step:
                    await on_child_resolved(parent_case, step, case, db)
                    # Complete the parent step
                    from engine.step_engine import complete_step
                    await complete_step(parent_id, parent_step_id, {}, user or {"_id": "system"}, db)

    return await db.cases.find_one({"_id": case_id})


# ── Manual Stage Advance ───────────────────────────────────

async def manual_advance_stage(case_id: str, user: dict) -> dict:
    """Manually advance to the next stage (for wait_for_user completion)."""
    db = get_db()
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise TransitionDeniedError(f"Case {case_id} not found")

    current_stage_id = case.get("current_stage_id")
    if not current_stage_id:
        raise TransitionDeniedError("No active stage")

    # Verify stage is completed (all processes done)
    stage = None
    for s in case.get("stages", []):
        if s["definition_id"] == current_stage_id:
            stage = s
            break
    if not stage:
        raise TransitionDeniedError("Current stage not found")

    if stage.get("on_complete") != "wait_for_user":
        raise TransitionDeniedError("Stage does not require manual advance")

    # Check all processes are complete
    procs = stage.get("processes", [])
    all_done = all(p["status"] in ("completed", "skipped") for p in procs)
    if not all_done:
        raise TransitionDeniedError("Not all processes are complete in this stage")

    now = datetime.now(timezone.utc).isoformat()
    await db.audit_logs.insert_one({
        "entityType": "case",
        "entityId": case_id,
        "action": "stage_advanced_manually",
        "actorId": str(user["_id"]),
        "actorName": user.get("name", ""),
        "changes": {"stage": current_stage_id},
        "timestamp": now,
    })

    await advance_to_next_stage(case_id, current_stage_id, db)
    return await db.cases.find_one({"_id": case_id})


# ── Helpers ──────────────────────────────────────────────

def _get_first_primary_stage(stages: list[dict]) -> dict | None:
    """Return the first primary stage by order."""
    primary = [s for s in stages if s.get("stage_type") == "primary"]
    primary.sort(key=lambda s: s.get("order", 0))
    return primary[0] if primary else None


def _find_stage_def(case_type: dict, stage_id: str) -> dict | None:
    for s in case_type.get("stages", []):
        if s.get("id") == stage_id:
            return s
    return None


def _find_step_global(case: dict, step_def_id: str) -> tuple:
    for stage in case.get("stages", []):
        for proc in stage.get("processes", []):
            for step in proc.get("steps", []):
                if step["definition_id"] == step_def_id:
                    return stage["definition_id"], proc["definition_id"], step
    return None, None, None


async def _next_sequence(db, prefix: str) -> int:
    """Atomically increment a counter for case ID generation."""
    result = await db.counters.find_one_and_update(
        {"_id": f"case_{prefix}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return result["seq"]


# ── Legacy compatibility (used by old routes until Sprint B rewrite) ──

async def get_workflow_definition(case_type_slug: str) -> dict | None:
    db = get_db()
    doc = await db.case_types.find_one({"slug": case_type_slug})
    if not doc:
        return None
    return {"stages": doc.get("stages", []), "transitions": doc.get("transitions", [])}

async def get_next_stage(case_type: str, current_stage: str, action: str, user_role: str) -> str:
    definition = await get_workflow_definition(case_type)
    if not definition:
        raise TransitionDeniedError(f"Unknown case type: {case_type}")
    for t in definition["transitions"]:
        if t["from"] == current_stage and t["action"] == action:
            if user_role not in t["roles"]:
                raise TransitionDeniedError(f"Role '{user_role}' cannot perform '{action}'")
            return t["to"]
    raise TransitionDeniedError(f"No transition found: stage='{current_stage}', action='{action}'")

async def get_available_transitions(case_type: str, current_stage: str, user_role: str) -> list:
    definition = await get_workflow_definition(case_type)
    if not definition:
        return []
    return [{"action": t["action"], "to": t["to"], "from": t["from"]}
            for t in definition["transitions"] if t["from"] == current_stage and user_role in t["roles"]]

async def get_first_stage(case_type: str) -> str:
    definition = await get_workflow_definition(case_type)
    if definition and definition["stages"]:
        return definition["stages"][0]
    return "intake"

def build_stage_entry(stage_name: str) -> dict:
    return {"name": stage_name, "status": "in_progress",
            "enteredAt": datetime.now(timezone.utc).isoformat(), "completedAt": None, "completedBy": None}

def complete_current_stage(stages: list, actor_id: str) -> list:
    if stages:
        stages[-1]["status"] = "completed"
        stages[-1]["completedAt"] = datetime.now(timezone.utc).isoformat()
        stages[-1]["completedBy"] = actor_id
    return stages
