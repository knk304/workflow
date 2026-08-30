"""
Temporal Demo Seed — Employee Onboarding case type with use_temporal=True.

Creates:
  - Case type: "Employee Onboarding (Temporal Demo)"  [ct-onboarding-temporal]
  - 3 case instances in different states:
      ONB-001  in_progress  (Stage 1 active — waiting on assignment step)
      ONB-002  in_progress  (Stage 2 active — waiting on approval step)
      ONB-003  resolved     (completed full lifecycle)

Run:
    cd backend
    python seed_temporal_demo.py
"""

import asyncio
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, ".")

from database import connect_db, get_db


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _now(delta_days=0):
    return (datetime.now(timezone.utc) + timedelta(days=delta_days)).isoformat()


def _step(sid, name, stype, order, config=None, sla_hours=None):
    return {
        "id": sid, "name": name, "type": stype,
        "order": order, "required": True,
        "skip_when": None, "visible_when": None,
        "sla_hours": sla_hours, "config": config or {},
    }


def _proc(pid, name, order, steps, is_parallel=False, start_when=None):
    return {
        "id": pid, "name": name, "type": "sequential",
        "order": order, "is_parallel": is_parallel,
        "start_when": start_when, "sla_hours": None, "steps": steps,
    }


def _stage(sid, name, order, processes, on_complete="auto_advance",
           resolution_status=None):
    return {
        "id": sid, "name": name, "stage_type": "primary",
        "order": order, "on_complete": on_complete,
        "resolution_status": resolution_status, "skip_when": None,
        "entry_criteria": None, "required_attachments": [],
        "delete_open_assignments": True, "resolve_child_cases": True,
        "sla_hours": None, "processes": processes,
    }


def _rt_step(def_id, name, stype, order, status="pending",
             started_at=None, completed_at=None, assigned_to=None, **kw):
    return {
        "definition_id": def_id, "name": name, "type": stype,
        "status": status, "order": order, "required": True,
        "started_at": started_at, "completed_at": completed_at,
        "assigned_to": assigned_to, "form_submission_id": None,
        "approval_chain_id": kw.get("approval_chain_id"),
        "child_case_id": None, "decision_branch_taken": None,
        "skipped_reason": None, "notes": kw.get("notes"), "sla_target": None,
    }


def _rt_proc(def_id, name, order, steps, status="pending",
             started_at=None, completed_at=None):
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


# ─── Case Type Blueprint ───────────────────────────────────────────────────────

CASE_TYPE = {
    "_id": "ct-onboarding-temporal",
    "name": "Employee Onboarding (Temporal Demo)",
    "slug": "employee-onboarding-temporal",
    "description": (
        "End-to-end onboarding workflow for new hires. "
        "Uses Temporal for durable execution — survives restarts, "
        "retries automation steps, and drives precise SLA timers."
    ),
    "icon": "badge",
    "prefix": "ONB",
    "field_schema": {
        "employee_name": {"type": "string", "label": "Employee Name"},
        "department": {"type": "string", "label": "Department"},
        "start_date": {"type": "date", "label": "Start Date"},
        "manager_id": {"type": "string", "label": "Manager User ID"},
        "laptop_model": {"type": "string", "label": "Laptop Model"},
        "equipment_shipped": {"type": "boolean", "label": "Equipment Shipped"},
    },
    "stages": [
        # ── Stage 1: Intake ──────────────────────────────────────────────
        _stage("stg-intake", "Intake", 0, [
            _proc("proc-collect-info", "Collect Employee Info", 0, [
                _step("step-fill-form", "Fill Onboarding Form", "assignment", 0,
                      config={"assignee_type": "creator"},
                      sla_hours=8),
                _step("step-upload-docs", "Upload ID Documents", "attachment", 1,
                      sla_hours=24),
            ]),
        ]),
        # ── Stage 2: HR Review ───────────────────────────────────────────
        _stage("stg-hr-review", "HR Review", 1, [
            _proc("proc-hr-approval", "HR Approval", 0, [
                _step("step-hr-review", "Review & Approve Hire", "approval", 0,
                      config={"approver_role": "MANAGER", "mode": "sequential"},
                      sla_hours=48),
                _step("step-bgcheck", "Background Check Automation", "automation", 1,
                      config={"automation_type": "api_call",
                              "endpoint": "/api/mock/bgcheck",
                              "method": "POST"},
                      sla_hours=72),
            ]),
        ]),
        # ── Stage 3: IT Setup ────────────────────────────────────────────
        _stage("stg-it-setup", "IT Setup", 2, [
            _proc("proc-provision", "Provision Accounts", 0, [
                _step("step-create-email", "Create Email Account", "automation", 0,
                      config={"automation_type": "api_call",
                              "endpoint": "/api/mock/create-email",
                              "method": "POST"}),
                _step("step-create-slack", "Provision Slack Account", "automation", 1,
                      config={"automation_type": "api_call",
                              "endpoint": "/api/mock/create-slack",
                              "method": "POST"}),
                _step("step-ship-laptop", "Ship Laptop", "assignment", 2,
                      config={"assigned_role": "WORKER"},
                      sla_hours=24),
            ]),
        ]),
        # ── Stage 4: Orientation ─────────────────────────────────────────
        _stage("stg-orientation", "Orientation", 3, [
            _proc("proc-orientation", "Orientation Day", 0, [
                _step("step-welcome-meeting", "Schedule Welcome Meeting", "assignment", 0,
                      config={"assigned_role": "MANAGER"}),
                _step("step-compliance-training", "Complete Compliance Training", "assignment", 1,
                      config={"assignee_type": "owner"},
                      sla_hours=72),
            ]),
        ], on_complete="resolve_case", resolution_status="resolved"),
    ],
    "attachment_categories": [
        {"id": "cat-id-doc", "name": "Government ID", "required_for_resolution": True,
         "allowed_types": ["pdf", "jpg", "png"]},
        {"id": "cat-contract", "name": "Signed Contract", "required_for_resolution": True,
         "allowed_types": ["pdf"]},
    ],
    "case_wide_actions": ["add_comment", "upload_document"],
    "intake_enabled": False,
    "use_temporal": True,           # ← This case type uses Temporal durable execution
    "is_active": True,
    "version": 1,
    "created_by": "user-admin",
    "created_at": _now(-30),
    "updated_at": _now(-1),
}


# ─── Case Instance 1: Stage 1 Active (waiting on assignment) ──────────────────

CASE_ONB_001 = {
    "_id": "ONB-001",
    "case_type_id": "ct-onboarding-temporal",
    "title": "Onboarding — Sarah Chen",
    "status": "in_progress",
    "priority": "high",
    "owner_id": "user-1",
    "team_id": "team-1",
    "created_by": "user-admin",
    "created_at": _now(-2),
    "updated_at": _now(-1),
    "resolved_at": None,
    "resolution_status": None,
    "current_stage_id": "stg-intake",
    "current_process_id": "proc-collect-info",
    "current_step_id": "step-fill-form",
    "custom_fields": {
        "employee_name": "Sarah Chen",
        "department": "Engineering",
        "start_date": _now(7)[:10],
        "manager_id": "user-1",
    },
    "sla_target_date": _now(5),
    "sla_days_remaining": 5,
    "escalation_level": 0,
    "parent_case_id": None,
    "parent_step_id": None,
    # Temporal workflow started when case was created
    "temporal_workflow_id": "case-ONB-001",
    "stages": [
        _rt_stage("stg-intake", "Intake", 0, [
            _rt_proc("proc-collect-info", "Collect Employee Info", 0, [
                _rt_step("step-fill-form", "Fill Onboarding Form", "assignment", 0,
                         status="in_progress", started_at=_now(-2), assigned_to="user-1"),
                _rt_step("step-upload-docs", "Upload ID Documents", "attachment", 1),
            ], status="in_progress", started_at=_now(-2)),
        ], status="in_progress", entered_at=_now(-2)),
        _rt_stage("stg-hr-review", "HR Review", 1, [
            _rt_proc("proc-hr-approval", "HR Approval", 0, [
                _rt_step("step-hr-review", "Review & Approve Hire", "approval", 0),
                _rt_step("step-bgcheck", "Background Check Automation", "automation", 1),
            ]),
        ]),
        _rt_stage("stg-it-setup", "IT Setup", 2, [
            _rt_proc("proc-provision", "Provision Accounts", 0, [
                _rt_step("step-create-email", "Create Email Account", "automation", 0),
                _rt_step("step-create-slack", "Provision Slack Account", "automation", 1),
                _rt_step("step-ship-laptop", "Ship Laptop", "assignment", 2),
            ]),
        ]),
        _rt_stage("stg-orientation", "Orientation", 3, [
            _rt_proc("proc-orientation", "Orientation Day", 0, [
                _rt_step("step-welcome-meeting", "Schedule Welcome Meeting", "assignment", 0),
                _rt_step("step-compliance-training", "Complete Compliance Training", "assignment", 1),
            ]),
        ]),
    ],
}


# ─── Case Instance 2: Stage 2 Active (waiting on manager approval) ────────────

CASE_ONB_002 = {
    "_id": "ONB-002",
    "case_type_id": "ct-onboarding-temporal",
    "title": "Onboarding — Marcus Webb",
    "status": "in_progress",
    "priority": "medium",
    "owner_id": "user-2",
    "team_id": "team-1",
    "created_by": "user-admin",
    "created_at": _now(-7),
    "updated_at": _now(-3),
    "resolved_at": None,
    "resolution_status": None,
    "current_stage_id": "stg-hr-review",
    "current_process_id": "proc-hr-approval",
    "current_step_id": "step-hr-review",
    "custom_fields": {
        "employee_name": "Marcus Webb",
        "department": "Product",
        "start_date": _now(14)[:10],
        "manager_id": "user-1",
    },
    "sla_target_date": _now(3),
    "sla_days_remaining": 3,
    "escalation_level": 0,
    "parent_case_id": None,
    "parent_step_id": None,
    "temporal_workflow_id": "case-ONB-002",
    "stages": [
        _rt_stage("stg-intake", "Intake", 0, [
            _rt_proc("proc-collect-info", "Collect Employee Info", 0, [
                _rt_step("step-fill-form", "Fill Onboarding Form", "assignment", 0,
                         status="completed", started_at=_now(-7), completed_at=_now(-6),
                         assigned_to="user-2"),
                _rt_step("step-upload-docs", "Upload ID Documents", "attachment", 1,
                         status="completed", started_at=_now(-6), completed_at=_now(-5)),
            ], status="completed", started_at=_now(-7), completed_at=_now(-5)),
        ], status="completed", entered_at=_now(-7), completed_at=_now(-5)),
        _rt_stage("stg-hr-review", "HR Review", 1, [
            _rt_proc("proc-hr-approval", "HR Approval", 0, [
                _rt_step("step-hr-review", "Review & Approve Hire", "approval", 0,
                         status="in_progress", started_at=_now(-5), assigned_to="user-1"),
                _rt_step("step-bgcheck", "Background Check Automation", "automation", 1),
            ], status="in_progress", started_at=_now(-5)),
        ], status="in_progress", entered_at=_now(-5)),
        _rt_stage("stg-it-setup", "IT Setup", 2, [
            _rt_proc("proc-provision", "Provision Accounts", 0, [
                _rt_step("step-create-email", "Create Email Account", "automation", 0),
                _rt_step("step-create-slack", "Provision Slack Account", "automation", 1),
                _rt_step("step-ship-laptop", "Ship Laptop", "assignment", 2),
            ]),
        ]),
        _rt_stage("stg-orientation", "Orientation", 3, [
            _rt_proc("proc-orientation", "Orientation Day", 0, [
                _rt_step("step-welcome-meeting", "Schedule Welcome Meeting", "assignment", 0),
                _rt_step("step-compliance-training", "Complete Compliance Training", "assignment", 1),
            ]),
        ]),
    ],
}


# ─── Case Instance 3: Fully Resolved ──────────────────────────────────────────

CASE_ONB_003 = {
    "_id": "ONB-003",
    "case_type_id": "ct-onboarding-temporal",
    "title": "Onboarding — Priya Patel",
    "status": "resolved",
    "priority": "low",
    "owner_id": "user-1",
    "team_id": "team-2",
    "created_by": "user-admin",
    "created_at": _now(-21),
    "updated_at": _now(-1),
    "resolved_at": _now(-1),
    "resolution_status": "resolved",
    "current_stage_id": "stg-orientation",
    "current_process_id": "proc-orientation",
    "current_step_id": "step-compliance-training",
    "custom_fields": {
        "employee_name": "Priya Patel",
        "department": "Design",
        "start_date": _now(-7)[:10],
        "manager_id": "user-1",
        "laptop_model": "MacBook Pro 14\"",
        "equipment_shipped": True,
    },
    "sla_target_date": _now(-3),
    "sla_days_remaining": 0,
    "escalation_level": 0,
    "parent_case_id": None,
    "parent_step_id": None,
    "temporal_workflow_id": "case-ONB-003",
    "stages": [
        _rt_stage("stg-intake", "Intake", 0, [
            _rt_proc("proc-collect-info", "Collect Employee Info", 0, [
                _rt_step("step-fill-form", "Fill Onboarding Form", "assignment", 0,
                         status="completed", started_at=_now(-21), completed_at=_now(-20),
                         assigned_to="user-1"),
                _rt_step("step-upload-docs", "Upload ID Documents", "attachment", 1,
                         status="completed", started_at=_now(-20), completed_at=_now(-19)),
            ], status="completed", started_at=_now(-21), completed_at=_now(-19)),
        ], status="completed", entered_at=_now(-21), completed_at=_now(-19)),
        _rt_stage("stg-hr-review", "HR Review", 1, [
            _rt_proc("proc-hr-approval", "HR Approval", 0, [
                _rt_step("step-hr-review", "Review & Approve Hire", "approval", 0,
                         status="completed", started_at=_now(-19), completed_at=_now(-17),
                         assigned_to="user-1",
                         notes="All documents verified. Approved."),
                _rt_step("step-bgcheck", "Background Check Automation", "automation", 1,
                         status="completed", started_at=_now(-17), completed_at=_now(-14),
                         notes="Background check passed."),
            ], status="completed", started_at=_now(-19), completed_at=_now(-14)),
        ], status="completed", entered_at=_now(-19), completed_at=_now(-14)),
        _rt_stage("stg-it-setup", "IT Setup", 2, [
            _rt_proc("proc-provision", "Provision Accounts", 0, [
                _rt_step("step-create-email", "Create Email Account", "automation", 0,
                         status="completed", started_at=_now(-14), completed_at=_now(-14),
                         notes="ppatel@company.com created."),
                _rt_step("step-create-slack", "Provision Slack Account", "automation", 1,
                         status="completed", started_at=_now(-14), completed_at=_now(-14),
                         notes="Slack account provisioned."),
                _rt_step("step-ship-laptop", "Ship Laptop", "assignment", 2,
                         status="completed", started_at=_now(-13), completed_at=_now(-10),
                         assigned_to="user-2",
                         notes="MacBook Pro 14 shipped via FedEx #123456789."),
            ], status="completed", started_at=_now(-14), completed_at=_now(-10)),
        ], status="completed", entered_at=_now(-14), completed_at=_now(-10)),
        _rt_stage("stg-orientation", "Orientation", 3, [
            _rt_proc("proc-orientation", "Orientation Day", 0, [
                _rt_step("step-welcome-meeting", "Schedule Welcome Meeting", "assignment", 0,
                         status="completed", started_at=_now(-10), completed_at=_now(-8),
                         assigned_to="user-1"),
                _rt_step("step-compliance-training", "Complete Compliance Training", "assignment", 1,
                         status="completed", started_at=_now(-7), completed_at=_now(-1),
                         assigned_to="user-3",
                         notes="All modules completed. Score: 94%."),
            ], status="completed", started_at=_now(-10), completed_at=_now(-1)),
        ], status="completed", on_complete="resolve_case",
           resolution_status="resolved",
           entered_at=_now(-10), completed_at=_now(-1)),
    ],
}


# ─── Assignments for ONB-001 (active step) ────────────────────────────────────

ASSIGNMENT_ONB_001 = {
    "_id": "asgn-onb-001-intake",
    "case_id": "ONB-001",
    "case_title": "Onboarding — Sarah Chen",
    "case_type_id": "ct-onboarding-temporal",
    "stage_id": "stg-intake",
    "stage_name": "Intake",
    "process_id": "proc-collect-info",
    "process_name": "Collect Employee Info",
    "step_id": "step-fill-form",
    "step_name": "Fill Onboarding Form",
    "step_definition_id": "step-fill-form",
    "status": "open",
    "priority": "high",
    "assigned_to": "user-1",
    "assigned_role": None,
    "assigned_team_id": None,
    "created_at": _now(-2),
    "updated_at": _now(-2),
    "due_at": _now(1),
}

# ─── Assignment for ONB-002 (HR approval step) ────────────────────────────────

ASSIGNMENT_ONB_002 = {
    "_id": "asgn-onb-002-hr",
    "case_id": "ONB-002",
    "case_title": "Onboarding — Marcus Webb",
    "case_type_id": "ct-onboarding-temporal",
    "stage_id": "stg-hr-review",
    "stage_name": "HR Review",
    "process_id": "proc-hr-approval",
    "process_name": "HR Approval",
    "step_id": "step-hr-review",
    "step_name": "Review & Approve Hire",
    "step_definition_id": "step-hr-review",
    "status": "open",
    "priority": "medium",
    "assigned_to": "user-1",
    "assigned_role": "MANAGER",
    "assigned_team_id": None,
    "created_at": _now(-5),
    "updated_at": _now(-5),
    "due_at": _now(3),
}

# ─── Audit log entries ────────────────────────────────────────────────────────

def _audit(event_type, case_id, details, days_ago=0):
    return {
        "event_type": event_type,
        "case_id": case_id,
        "actor": "user-admin",
        "details": details,
        "created_at": _now(-days_ago),
    }


AUDIT_LOGS = [
    _audit("temporal_workflow_started", "ONB-001",
           {"workflow_id": "case-ONB-001", "task_queue": "workflow-queue"}, 2),
    _audit("step_activated", "ONB-001",
           {"step_id": "step-fill-form", "step_type": "assignment"}, 2),
    _audit("temporal_workflow_started", "ONB-002",
           {"workflow_id": "case-ONB-002", "task_queue": "workflow-queue"}, 7),
    _audit("step_completed", "ONB-002",
           {"step_id": "step-fill-form", "completed_by": "user-2"}, 6),
    _audit("temporal_signal_sent", "ONB-002",
           {"signal": "step_completed", "step_id": "step-fill-form"}, 6),
    _audit("step_activated", "ONB-002",
           {"step_id": "step-hr-review", "step_type": "approval"}, 5),
    _audit("temporal_workflow_started", "ONB-003",
           {"workflow_id": "case-ONB-003", "task_queue": "workflow-queue"}, 21),
    _audit("case_resolved", "ONB-003",
           {"resolution_status": "resolved"}, 1),
]


# ─── Main ─────────────────────────────────────────────────────────────────────

async def seed_temporal_demo():
    await connect_db()
    db = get_db()

    # Ensure counters exist for ONB prefix
    await db.counters.update_one(
        {"_id": "ONB"},
        {"$setOnInsert": {"seq": 3}},
        upsert=True,
    )

    # Upsert case type (safe to re-run)
    await db.case_type_definitions.replace_one(
        {"_id": "ct-onboarding-temporal"}, CASE_TYPE, upsert=True
    )
    print("✓  Case type upserted: Employee Onboarding (Temporal Demo)")

    # Upsert cases
    for case, label in [
        (CASE_ONB_001, "ONB-001 — Sarah Chen (Stage 1 active)"),
        (CASE_ONB_002, "ONB-002 — Marcus Webb (Stage 2 active)"),
        (CASE_ONB_003, "ONB-003 — Priya Patel (Resolved)"),
    ]:
        await db.cases.replace_one({"_id": case["_id"]}, case, upsert=True)
        print(f"✓  Case upserted: {label}")

    # Upsert assignments
    for asgn in [ASSIGNMENT_ONB_001, ASSIGNMENT_ONB_002]:
        await db.assignments.replace_one({"_id": asgn["_id"]}, asgn, upsert=True)
    print("✓  Assignments upserted: 2 open assignments")

    # Insert audit logs (skip if already present for idempotency)
    for log in AUDIT_LOGS:
        await db.audit_logs.insert_one(log)
    print(f"✓  Audit logs inserted: {len(AUDIT_LOGS)} entries")

    print()
    print("─" * 55)
    print("Temporal Demo Data Ready")
    print("─" * 55)
    print("Case Type : Employee Onboarding (Temporal Demo)")
    print("           → use_temporal = True")
    print("           → 4 stages: Intake → HR Review → IT Setup → Orientation")
    print()
    print("Cases:")
    print("  ONB-001  Sarah Chen     in_progress  Stage: Intake (step: Fill Form)")
    print("  ONB-002  Marcus Webb    in_progress  Stage: HR Review (step: Approval)")
    print("  ONB-003  Priya Patel    resolved     Full lifecycle completed")
    print()
    print("Open the app:")
    print("  Portal    → http://localhost:4200/portal/cases")
    print("  Temporal  → http://localhost:4200/temporal")
    print("  Temporal UI (direct) → http://localhost:8233")
    print()
    print("To trigger a live CaseWorkflow for ONB-001:")
    print("  POST http://localhost:8000/api/temporal/cases/ONB-001/start")
    print("  (Bearer token required — log in via /api/auth/login first)")


if __name__ == "__main__":
    asyncio.run(seed_temporal_demo())
