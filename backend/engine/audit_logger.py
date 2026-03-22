"""
Centralized audit logger for the Pega-Lite workflow engine.

Captures detailed structured audit events for every engine action:
  - Case lifecycle (create, resolve, withdraw)
  - Stage transitions (enter, complete, skip, change)
  - Process orchestration (start, complete, skip)
  - Step execution (activate, complete, skip)
  - Decision evaluations (input, output, trace, branches)
  - Automation actions (each action with result)
  - Approval decisions (approve, reject, delegate)
  - Subprocess events (child create, child resolve, field propagation)
  - Rule evaluations (condition, data, trace, result)
  - Field changes (before/after)
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
import uuid


class AuditCategory(str, Enum):
    case = "case"
    stage = "stage"
    process = "process"
    step = "step"
    decision = "decision"
    rule = "rule"
    approval = "approval"
    assignment = "assignment"
    automation = "automation"
    subprocess = "subprocess"
    field = "field"
    sla = "sla"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _actor_info(user: dict | str | None) -> tuple[str, str]:
    """Extract actor ID and name from a user dict or string."""
    if user is None:
        return "system", "System"
    if isinstance(user, str):
        return user, ""
    return str(user.get("_id", "system")), user.get("name", user.get("fullName", user.get("email", "")))


def _correlation_id() -> str:
    return str(uuid.uuid4())


async def write_audit(
    db,
    entity_id: str,
    category: AuditCategory,
    action: str,
    actor: dict | str | None = None,
    details: dict | None = None,
    changes: dict | None = None,
    correlation_id: str | None = None,
    entity_type: str = "case",
):
    """
    Write a structured audit log entry.

    Args:
        db: Database instance
        entity_id: The case/entity ID this audit belongs to
        category: AuditCategory enum for filtering
        action: Human-readable action name
        actor: User dict, user ID string, or None for system
        details: Rich structured details (input, output, trace, etc.)
        changes: Before/after changes dict
        correlation_id: Optional ID to group related events
        entity_type: Top-level entity type (usually "case")
    """
    actor_id, actor_name = _actor_info(actor)
    doc = {
        "entityType": entity_type,
        "entityId": entity_id,
        "category": category.value,
        "action": action,
        "actorId": actor_id,
        "actorName": actor_name,
        "details": details or {},
        "changes": changes or {},
        "correlationId": correlation_id or _correlation_id(),
        "timestamp": _now(),
    }
    await db.audit_logs.insert_one(doc)
    return doc


# ── Convenience helpers for specific events ──────────────────


async def log_case_created(db, case_id: str, case_type_name: str, title: str,
                           priority: str, actor: dict | str | None = None,
                           custom_fields: dict | None = None,
                           parent_case_id: str | None = None):
    return await write_audit(db, case_id, AuditCategory.case, "case_created", actor, details={
        "case_type": case_type_name,
        "title": title,
        "priority": priority,
        "initial_fields": custom_fields or {},
        "parent_case_id": parent_case_id,
    })


async def log_case_resolved(db, case_id: str, resolution_status: str,
                            actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.case, "case_resolved", actor, details={
        "resolution_status": resolution_status,
    }, changes={
        "before": {"status": "in_progress"},
        "after": {"status": resolution_status},
    })


async def log_case_updated(db, case_id: str, changes_dict: dict,
                           actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.field, "fields_updated", actor,
                             details={"updated_fields": list(changes_dict.keys())},
                             changes=changes_dict)


async def log_stage_entered(db, case_id: str, stage_id: str, stage_name: str,
                            actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.stage, "stage_entered", actor, details={
        "stage_id": stage_id,
        "stage_name": stage_name,
    }, changes={
        "before": {"stage_status": "pending"},
        "after": {"stage_status": "in_progress"},
    })


async def log_stage_completed(db, case_id: str, stage_id: str, stage_name: str,
                              on_complete: str, actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.stage, "stage_completed", actor, details={
        "stage_id": stage_id,
        "stage_name": stage_name,
        "on_complete_action": on_complete,
    }, changes={
        "before": {"stage_status": "in_progress"},
        "after": {"stage_status": "completed"},
    })


async def log_stage_skipped(db, case_id: str, stage_id: str, stage_name: str,
                            reason: str, condition: dict | None = None,
                            trace: list | None = None,
                            actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.stage, "stage_skipped", actor, details={
        "stage_id": stage_id,
        "stage_name": stage_name,
        "skip_reason": reason,
        "condition": condition or {},
        "evaluation_trace": trace or [],
    }, changes={
        "before": {"stage_status": "pending"},
        "after": {"stage_status": "skipped"},
    })


async def log_stage_changed(db, case_id: str, from_stage_id: str, to_stage_id: str,
                            reason: str, actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.stage, "stage_changed", actor, details={
        "from_stage_id": from_stage_id,
        "to_stage_id": to_stage_id,
        "reason": reason,
    }, changes={
        "before": {"current_stage": from_stage_id},
        "after": {"current_stage": to_stage_id},
    })


async def log_stage_advanced_manually(db, case_id: str, stage_id: str,
                                      actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.stage, "stage_advanced_manually", actor, details={
        "stage_id": stage_id,
    })


async def log_process_started(db, case_id: str, stage_id: str, process_id: str,
                              process_name: str, start_when: dict | None = None,
                              trace: list | None = None,
                              actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.process, "process_started", actor, details={
        "stage_id": stage_id,
        "process_id": process_id,
        "process_name": process_name,
        "start_when_condition": start_when or {},
        "evaluation_trace": trace or [],
    }, changes={
        "before": {"process_status": "pending"},
        "after": {"process_status": "in_progress"},
    })


async def log_process_skipped(db, case_id: str, stage_id: str, process_id: str,
                              process_name: str, start_when: dict | None = None,
                              data_snapshot: dict | None = None,
                              trace: list | None = None,
                              actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.process, "process_skipped", actor, details={
        "stage_id": stage_id,
        "process_id": process_id,
        "process_name": process_name,
        "start_when_condition": start_when or {},
        "data_snapshot": data_snapshot or {},
        "evaluation_trace": trace or [],
    }, changes={
        "before": {"process_status": "pending"},
        "after": {"process_status": "skipped"},
    })


async def log_process_completed(db, case_id: str, stage_id: str, process_id: str,
                                process_name: str,
                                actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.process, "process_completed", actor, details={
        "stage_id": stage_id,
        "process_id": process_id,
        "process_name": process_name,
    }, changes={
        "before": {"process_status": "in_progress"},
        "after": {"process_status": "completed"},
    })


async def log_step_activated(db, case_id: str, stage_id: str, process_id: str,
                             step_id: str, step_name: str, step_type: str,
                             actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.step, "step_activated", actor, details={
        "stage_id": stage_id,
        "process_id": process_id,
        "step_id": step_id,
        "step_name": step_name,
        "step_type": step_type,
    }, changes={
        "before": {"step_status": "pending"},
        "after": {"step_status": "in_progress"},
    })


async def log_step_completed(db, case_id: str, stage_id: str, process_id: str,
                             step_id: str, step_name: str, step_type: str,
                             actor: dict | str | None = None,
                             completion_data: dict | None = None):
    return await write_audit(db, case_id, AuditCategory.step, "step_completed", actor, details={
        "stage_id": stage_id,
        "process_id": process_id,
        "step_id": step_id,
        "step_name": step_name,
        "step_type": step_type,
        "completion_data": completion_data or {},
    }, changes={
        "before": {"step_status": "in_progress"},
        "after": {"step_status": "completed"},
    })


async def log_step_skipped(db, case_id: str, stage_id: str, process_id: str,
                           step_id: str, step_name: str, step_type: str,
                           reason: str, condition: dict | None = None,
                           trace: list | None = None,
                           actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.step, "step_skipped", actor, details={
        "stage_id": stage_id,
        "process_id": process_id,
        "step_id": step_id,
        "step_name": step_name,
        "step_type": step_type,
        "skip_reason": reason,
        "condition": condition or {},
        "evaluation_trace": trace or [],
    }, changes={
        "before": {"step_status": "pending"},
        "after": {"step_status": "skipped"},
    })


async def log_decision_evaluated(db, case_id: str, stage_id: str, process_id: str,
                                 step_id: str, step_name: str,
                                 mode: str, input_data: dict,
                                 output_value: Any, branch_taken: str | None,
                                 branches_available: list | None = None,
                                 evaluation_trace: list | None = None,
                                 actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.decision, "decision_evaluated", actor, details={
        "step_id": step_id,
        "step_name": step_name,
        "stage_id": stage_id,
        "process_id": process_id,
        "mode": mode,
        "input": input_data,
        "output": output_value,
        "branch_taken": branch_taken,
        "branches_available": branches_available or [],
        "evaluation_trace": evaluation_trace or [],
    })


async def log_rule_evaluated(db, case_id: str, context: str,
                             condition: dict, data: dict,
                             result: bool, trace: list | None = None,
                             actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.rule, "rule_evaluated", actor, details={
        "context": context,
        "condition": condition,
        "data_snapshot": _safe_snapshot(data),
        "result": result,
        "evaluation_trace": trace or [],
    })


async def log_automation_executed(db, case_id: str, stage_id: str, process_id: str,
                                  step_id: str, step_name: str,
                                  actions_executed: list,
                                  rules_evaluated: list | None = None,
                                  actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.automation, "automation_executed", actor, details={
        "step_id": step_id,
        "step_name": step_name,
        "stage_id": stage_id,
        "process_id": process_id,
        "actions": actions_executed,
        "rules_evaluated": rules_evaluated or [],
    })


async def log_approval_chain_created(db, case_id: str, chain_id: str,
                                     step_id: str, step_name: str,
                                     mode: str, approvers: list,
                                     actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.approval, "approval_chain_created", actor, details={
        "chain_id": chain_id,
        "step_id": step_id,
        "step_name": step_name,
        "mode": mode,
        "approvers": [{"user_id": a.get("user_id"), "role": a.get("user_role"), "sequence": a.get("sequence")}
                      for a in approvers],
    })


async def log_approval_decision(db, case_id: str, chain_id: str,
                                decision: str, notes: str | None = None,
                                actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.approval, f"approval_{decision}", actor, details={
        "chain_id": chain_id,
        "decision": decision,
        "notes": notes or "",
    })


async def log_approval_delegated(db, case_id: str, chain_id: str,
                                 from_user: str, to_user: str,
                                 actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.approval, "approval_delegated", actor, details={
        "chain_id": chain_id,
        "from_user": from_user,
        "to_user": to_user,
    })


async def log_assignment_created(db, case_id: str, assignment_id: str,
                                 step_id: str, step_name: str,
                                 assignment_type: str,
                                 assigned_to: str | None = None,
                                 assigned_role: str | None = None,
                                 actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.assignment, "assignment_created", actor, details={
        "assignment_id": assignment_id,
        "step_id": step_id,
        "step_name": step_name,
        "type": assignment_type,
        "assigned_to": assigned_to,
        "assigned_role": assigned_role,
    })


async def log_subprocess_created(db, case_id: str, child_case_id: str,
                                 step_id: str, step_name: str,
                                 child_type_id: str,
                                 field_mapping: dict | None = None,
                                 actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.subprocess, "subprocess_created", actor, details={
        "child_case_id": child_case_id,
        "step_id": step_id,
        "step_name": step_name,
        "child_case_type_id": child_type_id,
        "field_mapping": field_mapping or {},
    })


async def log_subprocess_resolved(db, case_id: str, child_case_id: str,
                                  step_id: str, resolution_status: str,
                                  propagated_fields: list | None = None,
                                  actor: dict | str | None = None):
    return await write_audit(db, case_id, AuditCategory.subprocess, "subprocess_resolved", actor, details={
        "child_case_id": child_case_id,
        "step_id": step_id,
        "resolution_status": resolution_status,
        "propagated_fields": propagated_fields or [],
    })


def _safe_snapshot(data: dict, max_keys: int = 20) -> dict:
    """Create a bounded snapshot of data for audit logging."""
    if not data:
        return {}
    if len(data) <= max_keys:
        return dict(data)
    keys = list(data.keys())[:max_keys]
    snapshot = {k: data[k] for k in keys}
    snapshot["_truncated"] = f"{len(data) - max_keys} more fields"
    return snapshot
