"""
Temporal Real Use-Case Seed — Expense Reimbursement Request

A compact, realistic 3-stage case type designed to exercise the Temporal
workflow end to end using only step types that are actually wired correctly
in temporal_worker/workflows/case_workflow.py today:

  - assignment  -> human step, waits for `step_completed` signal
  - attachment  -> human step, waits for `step_completed` signal
  - approval    -> human step, waits for `step_completed` signal
  - automation  -> runs as a durable Temporal activity with retries

NOTE: "decision" and "subprocess" step types are intentionally NOT used here.
In the current CaseWorkflow, only "automation" steps are executed as
activities — every other step type (including decision/subprocess, which are
supposed to be evaluated automatically per engine/steps/decision_step.py)
falls into the human-signal wait branch and would hang forever waiting for a
signal that is never sent. That's a real gap to fix separately.

Story: an employee submits an expense report, an automated policy check
validates it, a manager approves it, and finance pays it out.

Stages:
  1. Submission        — fill expense form (assignment), upload receipt (attachment)
  2. Review & Approval — automated policy check (automation), manager approval (approval)
  3. Payment            — process payment (automation) -> resolves the case

Run:
    cd backend
    python seed_temporal_expense_demo.py
"""

import asyncio
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, ".")

from database import connect_db, get_db


def _now(delta_days=0):
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


def _bp_step(sid, name, stype, order, config=None, sla_hours=None):
    return {
        "id": sid, "name": name, "type": stype, "order": order,
        "required": True, "skip_when": None, "visible_when": None,
        "sla_hours": sla_hours, "config": config or {},
    }


def _bp_proc(pid, name, order, steps):
    return {
        "id": pid, "name": name, "type": "sequential", "order": order,
        "is_parallel": False, "start_when": None, "sla_hours": None,
        "steps": steps,
    }


def _bp_stage(sid, name, order, processes, on_complete="auto_advance",
              resolution_status=None):
    return {
        "id": sid, "name": name, "stage_type": "primary", "order": order,
        "on_complete": on_complete, "resolution_status": resolution_status,
        "skip_when": None, "entry_criteria": None, "required_attachments": [],
        "delete_open_assignments": True, "resolve_child_cases": True,
        "sla_hours": None, "processes": processes,
    }


def _rt_step(def_id, name, stype, order, status="pending", started_at=None,
             completed_at=None, assigned_to=None, **kw):
    return {
        "definition_id": def_id, "name": name, "type": stype, "status": status,
        "order": order, "required": True, "started_at": started_at,
        "completed_at": completed_at, "assigned_to": assigned_to,
        "form_submission_id": None, "approval_chain_id": kw.get("approval_chain_id"),
        "child_case_id": None, "decision_branch_taken": None,
        "skipped_reason": None, "notes": kw.get("notes"), "sla_target": None,
    }


def _rt_proc(def_id, name, order, steps, status="pending", started_at=None,
             completed_at=None):
    return {
        "definition_id": def_id, "name": name, "type": "sequential",
        "status": status, "order": order, "is_parallel": False,
        "started_at": started_at, "completed_at": completed_at,
        "steps": steps, "start_when": None,
    }


def _rt_stage(def_id, name, order, processes, status="pending",
              on_complete="auto_advance", resolution_status=None,
              entered_at=None, completed_at=None):
    return {
        "definition_id": def_id, "name": name, "stage_type": "primary",
        "status": status, "order": order, "on_complete": on_complete,
        "resolution_status": resolution_status,
        "entered_at": entered_at, "completed_at": completed_at,
        "processes": processes,
    }


CASE_TYPE = {
    "_id": "ct-expense-temporal",
    "name": "Expense Reimbursement (Temporal)",
    "slug": "expense-reimbursement-temporal",
    "description": (
        "Employee submits an expense report, an automated policy check runs, "
        "a manager approves it, and finance processes payment. "
        "Durable execution via Temporal."
    ),
    "icon": "receipt",
    "prefix": "EXP",
    "field_schema": {
        "employee_name": {"type": "string", "label": "Employee Name"},
        "amount": {"type": "number", "label": "Amount"},
        "category": {"type": "string", "label": "Expense Category"},
        "manager_id": {"type": "string", "label": "Manager User ID"},
    },
    "stages": [
        # Stage 1: Submission
        _bp_stage("stg-submission", "Submission", 0, [
            _bp_proc("proc-submit", "Submit Expense", 0, [
                _bp_step("step-fill-form", "Fill Expense Form", "assignment", 0,
                         config={"assignee_type": "owner"}, sla_hours=8),
                _bp_step("step-upload-receipt", "Upload Receipt", "attachment", 1,
                         config={"category": "receipt"}, sla_hours=24),
            ]),
        ]),
        # Stage 2: Review & Approval
        _bp_stage("stg-review", "Review & Approval", 1, [
            _bp_proc("proc-review", "Policy Check & Approval", 0, [
                _bp_step("step-policy-check", "Automated Policy Check", "automation", 0,
                         config={"automation_type": "api_call",
                                 "endpoint": "/api/mock/expense-policy-check",
                                 "method": "POST"},
                         sla_hours=4),
                _bp_step("step-mgr-approval", "Manager Approval", "approval", 1,
                         config={"approver_role": "MANAGER", "mode": "sequential"},
                         sla_hours=48),
            ]),
        ]),
        # Stage 3: Payment
        _bp_stage("stg-payment", "Payment", 2, [
            _bp_proc("proc-payment", "Process Payment", 0, [
                _bp_step("step-process-payment", "Process Payment", "automation", 0,
                         config={"automation_type": "api_call",
                                 "endpoint": "/api/mock/process-payment",
                                 "method": "POST",
                                 # Demo hook: fails the first 3 attempts so Temporal
                                 # shows real retry-driven pending activities before succeeding.
                                 "simulate_failures": 3},
                         sla_hours=24),
            ]),
        ], on_complete="resolve_case", resolution_status="resolved"),
    ],
    "attachment_categories": [
        {"id": "cat-receipt", "name": "Receipt", "required_for_resolution": True,
         "allowed_types": ["pdf", "jpg", "png"]},
    ],
    "case_wide_actions": ["add_comment", "upload_document"],
    "intake_enabled": False,
    "use_temporal": True,
    "is_active": True,
    "version": 1,
    "created_by": "system-seed",
    "created_at": _now(-14),
    "updated_at": _now(-1),
}


# Case 1: waiting on the employee to fill the expense form (assignment step)
CASE_EXP_001 = {
    "_id": "EXP-001",
    "case_type_id": "ct-expense-temporal",
    "title": "Expense — Client Dinner (Dana Reyes)",
    "status": "in_progress",
    "priority": "medium",
    "owner_id": "user-1",
    "team_id": "team-1",
    "created_by": "user-1",
    "created_at": _now(-1),
    "updated_at": _now(-1),
    "resolved_at": None,
    "resolution_status": None,
    "current_stage_id": "stg-submission",
    "current_process_id": "proc-submit",
    "current_step_id": "step-fill-form",
    "custom_fields": {
        "employee_name": "Dana Reyes",
        "amount": 185.50,
        "category": "Meals",
        "manager_id": "user-2",
    },
    "sla_target_date": _now(1),
    "sla_days_remaining": 1,
    "escalation_level": 0,
    "parent_case_id": None,
    "parent_step_id": None,
    "temporal_workflow_id": "case-EXP-001",
    "stages": [
        _rt_stage("stg-submission", "Submission", 0, [
            _rt_proc("proc-submit", "Submit Expense", 0, [
                _rt_step("step-fill-form", "Fill Expense Form", "assignment", 0,
                         status="in_progress", started_at=_now(-1), assigned_to="user-1"),
                _rt_step("step-upload-receipt", "Upload Receipt", "attachment", 1),
            ], status="in_progress", started_at=_now(-1)),
        ], status="in_progress", entered_at=_now(-1)),
        _rt_stage("stg-review", "Review & Approval", 1, [
            _rt_proc("proc-review", "Policy Check & Approval", 0, [
                _rt_step("step-policy-check", "Automated Policy Check", "automation", 0),
                _rt_step("step-mgr-approval", "Manager Approval", "approval", 1),
            ]),
        ]),
        _rt_stage("stg-payment", "Payment", 2, [
            _rt_proc("proc-payment", "Process Payment", 0, [
                _rt_step("step-process-payment", "Process Payment", "automation", 0),
            ]),
        ]),
    ],
}

# Case 2: automation already ran, waiting on manager approval
CASE_EXP_002 = {
    "_id": "EXP-002",
    "case_type_id": "ct-expense-temporal",
    "title": "Expense — Conference Travel (Miguel Torres)",
    "status": "in_progress",
    "priority": "high",
    "owner_id": "user-2",
    "team_id": "team-1",
    "created_by": "user-2",
    "created_at": _now(-3),
    "updated_at": _now(-1),
    "resolved_at": None,
    "resolution_status": None,
    "current_stage_id": "stg-review",
    "current_process_id": "proc-review",
    "current_step_id": "step-mgr-approval",
    "custom_fields": {
        "employee_name": "Miguel Torres",
        "amount": 1240.00,
        "category": "Travel",
        "manager_id": "user-1",
    },
    "sla_target_date": _now(1),
    "sla_days_remaining": 1,
    "escalation_level": 0,
    "parent_case_id": None,
    "parent_step_id": None,
    "temporal_workflow_id": "case-EXP-002",
    "stages": [
        _rt_stage("stg-submission", "Submission", 0, [
            _rt_proc("proc-submit", "Submit Expense", 0, [
                _rt_step("step-fill-form", "Fill Expense Form", "assignment", 0,
                         status="completed", started_at=_now(-3), completed_at=_now(-3),
                         assigned_to="user-2"),
                _rt_step("step-upload-receipt", "Upload Receipt", "attachment", 1,
                         status="completed", started_at=_now(-3), completed_at=_now(-2)),
            ], status="completed", started_at=_now(-3), completed_at=_now(-2)),
        ], status="completed", entered_at=_now(-3), completed_at=_now(-2)),
        _rt_stage("stg-review", "Review & Approval", 1, [
            _rt_proc("proc-review", "Policy Check & Approval", 0, [
                _rt_step("step-policy-check", "Automated Policy Check", "automation", 0,
                         status="completed", started_at=_now(-2), completed_at=_now(-2),
                         notes="Within policy limit."),
                _rt_step("step-mgr-approval", "Manager Approval", "approval", 1,
                         status="in_progress", started_at=_now(-1), assigned_to="user-1"),
            ], status="in_progress", started_at=_now(-2)),
        ], status="in_progress", entered_at=_now(-2)),
        _rt_stage("stg-payment", "Payment", 2, [
            _rt_proc("proc-payment", "Process Payment", 0, [
                _rt_step("step-process-payment", "Process Payment", "automation", 0),
            ]),
        ]),
    ],
}

# Case 3: fully resolved (paid)
CASE_EXP_003 = {
    "_id": "EXP-003",
    "case_type_id": "ct-expense-temporal",
    "title": "Expense — Office Supplies (Priya Patel)",
    "status": "resolved",
    "priority": "low",
    "owner_id": "user-3",
    "team_id": "team-2",
    "created_by": "user-3",
    "created_at": _now(-10),
    "updated_at": _now(-1),
    "resolved_at": _now(-1),
    "resolution_status": "resolved",
    "current_stage_id": "stg-payment",
    "current_process_id": "proc-payment",
    "current_step_id": "step-process-payment",
    "custom_fields": {
        "employee_name": "Priya Patel",
        "amount": 64.99,
        "category": "Supplies",
        "manager_id": "user-1",
    },
    "sla_target_date": _now(-5),
    "sla_days_remaining": 0,
    "escalation_level": 0,
    "parent_case_id": None,
    "parent_step_id": None,
    "temporal_workflow_id": "case-EXP-003",
    "stages": [
        _rt_stage("stg-submission", "Submission", 0, [
            _rt_proc("proc-submit", "Submit Expense", 0, [
                _rt_step("step-fill-form", "Fill Expense Form", "assignment", 0,
                         status="completed", started_at=_now(-10), completed_at=_now(-9),
                         assigned_to="user-3"),
                _rt_step("step-upload-receipt", "Upload Receipt", "attachment", 1,
                         status="completed", started_at=_now(-9), completed_at=_now(-9)),
            ], status="completed", started_at=_now(-10), completed_at=_now(-9)),
        ], status="completed", entered_at=_now(-10), completed_at=_now(-9)),
        _rt_stage("stg-review", "Review & Approval", 1, [
            _rt_proc("proc-review", "Policy Check & Approval", 0, [
                _rt_step("step-policy-check", "Automated Policy Check", "automation", 0,
                         status="completed", started_at=_now(-8), completed_at=_now(-8),
                         notes="Within policy limit."),
                _rt_step("step-mgr-approval", "Manager Approval", "approval", 1,
                         status="completed", started_at=_now(-8), completed_at=_now(-6),
                         assigned_to="user-1", notes="Approved."),
            ], status="completed", started_at=_now(-8), completed_at=_now(-6)),
        ], status="completed", entered_at=_now(-8), completed_at=_now(-6)),
        _rt_stage("stg-payment", "Payment", 2, [
            _rt_proc("proc-payment", "Process Payment", 0, [
                _rt_step("step-process-payment", "Process Payment", "automation", 0,
                         status="completed", started_at=_now(-1), completed_at=_now(-1),
                         notes="Paid via direct deposit."),
            ], status="completed", started_at=_now(-1), completed_at=_now(-1)),
        ], status="completed", on_complete="resolve_case", resolution_status="resolved",
           entered_at=_now(-1), completed_at=_now(-1)),
    ],
}


ASSIGNMENT_EXP_001 = {
    "_id": "asgn-exp-001-form",
    "case_id": "EXP-001",
    "case_title": "Expense — Client Dinner (Dana Reyes)",
    "case_type_id": "ct-expense-temporal",
    "stage_id": "stg-submission",
    "stage_name": "Submission",
    "process_id": "proc-submit",
    "process_name": "Submit Expense",
    "step_id": "step-fill-form",
    "step_name": "Fill Expense Form",
    "step_definition_id": "step-fill-form",
    "status": "open",
    "priority": "medium",
    "assigned_to": "user-1",
    "assigned_role": None,
    "assigned_team_id": None,
    "created_at": _now(-1),
    "updated_at": _now(-1),
    "due_at": _now(0),
}

ASSIGNMENT_EXP_002 = {
    "_id": "asgn-exp-002-approval",
    "case_id": "EXP-002",
    "case_title": "Expense — Conference Travel (Miguel Torres)",
    "case_type_id": "ct-expense-temporal",
    "stage_id": "stg-review",
    "stage_name": "Review & Approval",
    "process_id": "proc-review",
    "process_name": "Policy Check & Approval",
    "step_id": "step-mgr-approval",
    "step_name": "Manager Approval",
    "step_definition_id": "step-mgr-approval",
    "status": "open",
    "priority": "high",
    "assigned_to": "user-1",
    "assigned_role": "MANAGER",
    "assigned_team_id": None,
    "created_at": _now(-1),
    "updated_at": _now(-1),
    "due_at": _now(1),
}


async def seed_expense_temporal_demo():
    await connect_db()
    db = get_db()

    await db.counters.update_one(
        {"_id": "EXP"}, {"$setOnInsert": {"seq": 3}}, upsert=True,
    )

    await db.case_type_definitions.replace_one(
        {"_id": "ct-expense-temporal"}, CASE_TYPE, upsert=True
    )
    print("✓ Case type upserted: Expense Reimbursement (Temporal)")

    for case, label in [
        (CASE_EXP_001, "EXP-001 — Dana Reyes (waiting on employee to fill form)"),
        (CASE_EXP_002, "EXP-002 — Miguel Torres (waiting on manager approval)"),
        (CASE_EXP_003, "EXP-003 — Priya Patel (resolved / paid)"),
    ]:
        await db.cases.replace_one({"_id": case["_id"]}, case, upsert=True)
        print(f"✓ Case upserted: {label}")

    for asgn in [ASSIGNMENT_EXP_001, ASSIGNMENT_EXP_002]:
        await db.assignments.replace_one({"_id": asgn["_id"]}, asgn, upsert=True)
    print("✓ Assignments upserted: 2 open assignments")

    print()
    print("-" * 55)
    print("Expense Reimbursement (Temporal) Demo Ready")
    print("-" * 55)
    print("Case Type : Expense Reimbursement (Temporal)")
    print("            use_temporal = True")
    print("            3 stages: Submission -> Review & Approval -> Payment")
    print()
    print("Cases:")
    print("  EXP-001  Dana Reyes     waiting on: Fill Expense Form (assignment)")
    print("  EXP-002  Miguel Torres  waiting on: Manager Approval (approval)")
    print("  EXP-003  Priya Patel    resolved / paid")
    print()
    print("To exercise the full Temporal loop:")
    print("  1. Complete step-fill-form for EXP-001 (assignment)")
    print("     -> workflow signals step_completed -> automation runs step-policy-check")
    print("  2. Complete step-upload-receipt for EXP-001 (attachment)")
    print("  3. Approve step-mgr-approval for EXP-002 (approval)")
    print("     -> workflow signals step_completed -> next stage: Payment automation runs")
    print("  4. Watch Temporal UI: activity scheduled/completed events for automation steps")


if __name__ == "__main__":
    asyncio.run(seed_expense_temporal_demo())
