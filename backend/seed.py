"""Consolidated seed data for all collections — hierarchical Pega-Lite model."""

from datetime import datetime, timezone, timedelta
from database import get_db
from security import hash_password


async def force_reseed():
    """Drop all collections and re-seed from scratch."""
    db = get_db()
    collections = [
        "users", "teams", "case_types", "case_type_definitions", "cases",
        "tasks", "assignments", "comments", "notifications", "workflows",
        "approval_chains", "sla_definitions", "case_forms",
        "approval_routing_rules", "documents", "audit_logs",
        "form_submissions", "decision_tables", "counters",
    ]
    for col in collections:
        await db[col].drop()
    await _insert_all(db)


async def seed_all():
    """Seed all collections if the database is empty."""
    db = get_db()
    count = await db.users.count_documents({})
    if count > 0:
        return
    await _insert_all(db)


# ─── Blueprint helpers ─────────────────────────────

def _step(sid, name, stype, order, config=None, skip_when=None, sla_hours=None):
    return {"id": sid, "name": name, "type": stype, "order": order,
            "required": True, "skip_when": skip_when, "visible_when": None,
            "sla_hours": sla_hours, "config": config or {}}

def _proc(pid, name, order, steps, is_parallel=False, start_when=None):
    return {"id": pid, "name": name, "type": "sequential", "order": order,
            "is_parallel": is_parallel, "start_when": start_when,
            "sla_hours": None, "steps": steps}

def _stage(sid, name, order, processes, stage_type="primary",
           on_complete="auto_advance", resolution_status=None, skip_when=None):
    return {"id": sid, "name": name, "stage_type": stage_type,
            "order": order, "on_complete": on_complete,
            "resolution_status": resolution_status, "skip_when": skip_when,
            "entry_criteria": None, "required_attachments": [],
            "delete_open_assignments": True, "resolve_child_cases": True,
            "sla_hours": None, "processes": processes}


# ─── Runtime instance helpers (matches instantiate_case shape) ──

def _rt_step(def_id, name, stype, order, status="pending",
             started_at=None, completed_at=None, assigned_to=None, **kw):
    return {"definition_id": def_id, "name": name, "type": stype,
            "status": status, "order": order,
            "started_at": started_at, "completed_at": completed_at,
            "assigned_to": assigned_to, "form_submission_id": None,
            "approval_chain_id": kw.get("approval_chain_id"),
            "child_case_id": None, "decision_branch_taken": None,
            "skipped_reason": None, "notes": kw.get("notes"),
            "sla_target": None}

def _rt_proc(def_id, name, order, steps, status="pending",
             started_at=None, completed_at=None, **kw):
    return {"definition_id": def_id, "name": name, "type": "sequential",
            "status": status, "order": order, "is_parallel": False,
            "started_at": started_at, "completed_at": completed_at,
            "steps": steps, "start_when": None}

def _rt_stage(def_id, name, order, processes, status="pending",
              on_complete="auto_advance", resolution_status=None,
              entered_at=None, completed_at=None, completed_by=None):
    return {"definition_id": def_id, "name": name,
            "stage_type": "primary", "status": status, "order": order,
            "on_complete": on_complete, "resolution_status": resolution_status,
            "entered_at": entered_at, "completed_at": completed_at,
            "completed_by": completed_by, "processes": processes}


async def _insert_all(db):
    now = datetime.now(timezone.utc).isoformat()
    sla_30 = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    sla_20 = (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()
    sla_15 = (datetime.now(timezone.utc) + timedelta(days=15)).isoformat()

    # ─── Users ──────────────────────────────────
    users = [
        {"_id": "user-1", "email": "alice@example.com", "name": "Alice Johnson", "role": "MANAGER",
         "team_ids": ["team-1", "team-2"], "hashed_password": hash_password("demo123"),
         "avatar": None, "is_active": True, "created_at": "2025-01-01T00:00:00.000Z"},
        {"_id": "user-2", "email": "bob@example.com", "name": "Bob Smith", "role": "WORKER",
         "team_ids": ["team-1", "team-3"], "hashed_password": hash_password("demo123"),
         "avatar": None, "is_active": True, "created_at": "2025-02-15T00:00:00.000Z"},
        {"_id": "user-3", "email": "carol@example.com", "name": "Carol Davis", "role": "WORKER",
         "team_ids": ["team-2", "team-3"], "hashed_password": hash_password("demo123"),
         "avatar": None, "is_active": True, "created_at": "2025-03-10T00:00:00.000Z"},
        {"_id": "user-admin", "email": "admin@example.com", "name": "Admin User", "role": "ADMIN",
         "team_ids": ["team-1", "team-2", "team-3"], "hashed_password": hash_password("admin123"),
         "avatar": None, "is_active": True, "created_at": "2025-01-01T00:00:00.000Z"},
    ]
    await db.users.insert_many(users)

    # ─── Teams ──────────────────────────────────
    teams = [
        {"_id": "team-1", "name": "Loan Processing", "description": "Handles all loan origination cases",
         "member_ids": ["user-1", "user-2", "user-admin"], "created_at": "2025-01-01T00:00:00.000Z"},
        {"_id": "team-2", "name": "Customer Onboarding", "description": "KYC and new customer onboarding",
         "member_ids": ["user-1", "user-3", "user-admin"], "created_at": "2025-01-01T00:00:00.000Z"},
        {"_id": "team-3", "name": "Claims Department", "description": "Insurance claims processing and review",
         "member_ids": ["user-2", "user-3", "user-admin"], "created_at": "2025-01-01T00:00:00.000Z"},
    ]
    await db.teams.insert_many(teams)

    # ═══════════════════════════════════════════════════════════
    # CASE TYPE DEFINITIONS (hierarchical blueprints)
    # ═══════════════════════════════════════════════════════════

    ct_base = {"icon": "folder", "attachment_categories": [], "case_wide_actions": [],
               "created_by": "user-admin", "created_at": "2025-01-15T00:00:00Z",
               "updated_at": "2025-01-15T00:00:00Z", "version": 1, "is_active": True}

    # ──── 1) Loan Origination ────
    ct_loan = {
        **ct_base,
        "_id": "ct-loan", "name": "Loan Origination", "slug": "loan_origination",
        "description": "End-to-end loan processing workflow", "prefix": "LOAN",
        "field_schema": {
            "loanAmount": {"type": "number", "label": "Loan Amount"},
            "loanType": {"type": "string", "label": "Loan Type"},
            "applicantName": {"type": "string", "label": "Applicant Name"},
            "applicantIncome": {"type": "number", "label": "Annual Income"},
        },
        "stages": [
            _stage("stage-intake", "Intake Review", 1, [
                _proc("proc-intake", "Application Intake", 1, [
                    _step("step-fill-app", "Fill Application", "assignment", 1,
                          config={"assignee_role": "WORKER", "form_id": "form-loan-intake"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-docs", "Document Collection", 2, [
                _proc("proc-docs", "Collect Documents", 1, [
                    _step("step-upload-docs", "Upload Documents", "attachment", 1,
                          config={"required_categories": ["income", "identity"]}, sla_hours=72),
                    _step("step-verify-docs", "Verify Documents", "assignment", 2,
                          config={"assignee_role": "WORKER"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-underwriting", "Underwriting", 3, [
                _proc("proc-risk", "Risk Assessment", 1, [
                    _step("step-auto-credit", "Auto Credit Check", "automation", 1,
                          config={"actions": [{"type": "set_field", "config": {"field": "creditChecked", "value": True}}]}),
                    _step("step-risk-review", "Risk Review", "assignment", 2,
                          config={"assignee_role": "MANAGER"}, sla_hours=48),
                ]),
                _proc("proc-decision", "Approval Decision", 2, [
                    _step("step-amount-check", "Amount Decision", "decision", 1,
                          config={"mode": "first_match", "branches": [
                              {"id": "branch-high", "label": "High Value",
                               "condition": {"field": "loanAmount", "operator": "gt", "value": 100000},
                               "next_step_id": "step-vp-approval"},
                              {"id": "branch-standard", "label": "Standard",
                               "condition": {"field": "loanAmount", "operator": "lte", "value": 100000},
                               "next_step_id": "step-mgr-approval"},
                          ], "default_step_id": "step-mgr-approval"}),
                    _step("step-mgr-approval", "Manager Approval", "approval", 2,
                          config={"mode": "sequential",
                                  "approver_roles": ["MANAGER"],
                                  "on_reject_stage": "stage-intake"}),
                    _step("step-vp-approval", "VP Approval", "approval", 3,
                          config={"mode": "sequential",
                                  "approver_roles": ["MANAGER", "ADMIN"],
                                  "on_reject_stage": "stage-underwriting"}),
                ]),
            ]),
            _stage("stage-disburse", "Disbursement", 4, [
                _proc("proc-disburse", "Disbursement Process", 1, [
                    _step("step-send-funds", "Process Disbursement", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=48),
                    _step("step-confirm-notify", "Confirmation Notification", "automation", 2,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Loan Disbursed", "message": "Your loan has been disbursed."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
            # Alternate stages
            _stage("stage-rejected", "Rejected", 10, [
                _proc("proc-reject-notify", "Rejection Notification", 1, [
                    _step("step-reject-notify", "Send Rejection", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Loan Rejected", "message": "Your loan application has been rejected."}}]}),
                ]),
            ], stage_type="alternate", on_complete="resolve_case", resolution_status="resolved_rejected"),
        ],
    }

    # ──── 2) Customer Onboarding (KYC) ────
    ct_kyc = {
        **ct_base,
        "_id": "ct-kyc", "name": "Customer Onboarding", "slug": "customer_onboarding",
        "description": "KYC verification and new customer account setup", "prefix": "KYC",
        "field_schema": {
            "customerName": {"type": "string", "label": "Customer Name"},
            "accountType": {"type": "string", "label": "Account Type"},
            "riskLevel": {"type": "string", "label": "Risk Level"},
        },
        "stages": [
            _stage("stage-app-review", "Application Review", 1, [
                _proc("proc-app-review", "Review Application", 1, [
                    _step("step-kyc-form", "KYC Application Form", "assignment", 1,
                          config={"assignee_role": "WORKER", "form_id": "form-kyc-intake"}, sla_hours=12),
                ]),
            ]),
            _stage("stage-id-verify", "Identity Verification", 2, [
                _proc("proc-id-verify", "Verify Identity", 1, [
                    _step("step-upload-id", "Upload ID Documents", "attachment", 1,
                          config={"required_categories": ["identity"]}, sla_hours=48),
                    _step("step-verify-id", "Verify Identity", "assignment", 2,
                          config={"assignee_role": "WORKER"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-risk", "Risk Assessment", 3, [
                _proc("proc-risk-assess", "Assess Risk", 1, [
                    _step("step-risk-decision", "Risk Level Decision", "decision", 1,
                          config={"mode": "first_match", "branches": [
                              {"id": "branch-high-risk", "label": "High Risk",
                               "condition": {"field": "riskLevel", "operator": "eq", "value": "high"},
                               "next_step_id": "step-edd"},
                              {"id": "branch-low-risk", "label": "Low/Medium Risk",
                               "condition": {"field": "riskLevel", "operator": "in", "value": ["low", "medium"]},
                               "next_step_id": "step-auto-clear"},
                          ], "default_step_id": "step-edd"}),
                    _step("step-auto-clear", "Auto Clear", "automation", 2,
                          config={"actions": [{"type": "set_field", "config": {"field": "riskCleared", "value": True}}]}),
                    _step("step-edd", "Enhanced Due Diligence", "assignment", 3,
                          config={"assignee_role": "MANAGER"}, sla_hours=72),
                ]),
            ]),
            _stage("stage-acct-setup", "Account Setup", 4, [
                _proc("proc-acct-setup", "Setup Account", 1, [
                    _step("step-create-acct", "Create Account", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-welcome", "Welcome", 5, [
                _proc("proc-welcome", "Welcome Process", 1, [
                    _step("step-welcome-notify", "Send Welcome Pack", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Welcome!", "message": "Your account is ready."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
        ],
    }

    # ──── 3) Insurance Claims ────
    ct_claims = {
        **ct_base,
        "_id": "ct-claims", "name": "Insurance Claims", "slug": "insurance_claims",
        "description": "Process and adjudicate insurance claims", "prefix": "CLM",
        "field_schema": {
            "claimantName": {"type": "string", "label": "Claimant Name"},
            "claimType": {"type": "string", "label": "Claim Type"},
            "claimAmount": {"type": "number", "label": "Claim Amount"},
            "policyNumber": {"type": "string", "label": "Policy Number"},
        },
        "stages": [
            _stage("stage-claim-intake", "Claim Intake", 1, [
                _proc("proc-claim-intake", "Record Claim", 1, [
                    _step("step-claim-form", "Submit Claim Form", "assignment", 1,
                          config={"assignee_role": "WORKER", "form_id": "form-claims-intake"}, sla_hours=8),
                ]),
            ]),
            _stage("stage-investigation", "Investigation", 2, [
                _proc("proc-investigate", "Investigate Claim", 1, [
                    _step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=96),
                    _step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2,
                          config={"required_categories": ["evidence", "reports"]}),
                ]),
            ]),
            _stage("stage-adjudicate", "Adjudication", 3, [
                _proc("proc-adjudicate", "Adjudicate Claim", 1, [
                    _step("step-adjudicate-decision", "Coverage Decision", "decision", 1,
                          config={"mode": "first_match", "branches": [
                              {"id": "branch-high-claim", "label": "High Value Claim",
                               "condition": {"field": "claimAmount", "operator": "gt", "value": 50000},
                               "next_step_id": "step-senior-review"},
                              {"id": "branch-normal", "label": "Standard Claim",
                               "condition": {"field": "claimAmount", "operator": "lte", "value": 50000},
                               "next_step_id": "step-mgr-adjudicate"},
                          ], "default_step_id": "step-mgr-adjudicate"}),
                    _step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2,
                          config={"mode": "sequential", "approver_roles": ["MANAGER"],
                                  "on_reject_stage": "stage-denied"}),
                    _step("step-senior-review", "Senior Review", "approval", 3,
                          config={"mode": "sequential", "approver_roles": ["MANAGER", "ADMIN"],
                                  "on_reject_stage": "stage-denied"}),
                ]),
            ]),
            _stage("stage-settlement", "Settlement", 4, [
                _proc("proc-settle", "Process Settlement", 1, [
                    _step("step-calc-payout", "Calculate Payout", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=48),
                    _step("step-issue-payment", "Issue Payment", "assignment", 2,
                          config={"assignee_role": "WORKER"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-closure", "Closure", 5, [
                _proc("proc-closure", "Close Claim", 1, [
                    _step("step-close-notify", "Send Closure Notification", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Claim Closed", "message": "Your claim has been resolved."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
            # Alternate: denied
            _stage("stage-denied", "Denied", 10, [
                _proc("proc-deny-notify", "Denial Notification", 1, [
                    _step("step-deny-notify", "Send Denial Notice", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Claim Denied", "message": "Your claim has been denied."}}]}),
                ]),
            ], stage_type="alternate", on_complete="resolve_case", resolution_status="resolved_rejected"),
        ],
    }

    await db.case_type_definitions.insert_many([ct_loan, ct_kyc, ct_claims])

    # ═══════════════════════════════════════════════════════════
    # COUNTERS (for case ID sequencing)
    # ═══════════════════════════════════════════════════════════
    counters = [
        {"_id": "LOAN", "seq": 3},   # 3 loan cases seeded
        {"_id": "KYC", "seq": 3},    # 3 KYC cases
        {"_id": "CLM", "seq": 3},    # 3 claims cases
    ]
    await db.counters.insert_many(counters)

    # ═══════════════════════════════════════════════════════════
    # CASES (hierarchical runtime instances)
    # ═══════════════════════════════════════════════════════════

    # ── Loan case 1: in Document Collection stage ──
    cases = [
        {
            "_id": "LOAN-001", "case_type_id": "ct-loan", "case_type_name": "Loan Origination",
            "title": "Mortgage - John Doe", "status": "in_progress", "priority": "high",
            "owner_id": "user-1", "team_id": "team-1",
            "custom_fields": {"loanAmount": 250000, "loanType": "Mortgage", "applicantName": "John Doe", "applicantIncome": 85000},
            "current_stage_id": "stage-docs", "current_process_id": "proc-docs", "current_step_id": "step-upload-docs",
            "stages": [
                _rt_stage("stage-intake", "Intake Review", 1, [
                    _rt_proc("proc-intake", "Application Intake", 1, [
                        _rt_step("step-fill-app", "Fill Application", "assignment", 1,
                                 status="completed", started_at="2026-02-01T10:00:00Z",
                                 completed_at="2026-02-02T14:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-02-01T10:00:00Z", completed_at="2026-02-02T14:00:00Z"),
                ], status="completed", entered_at="2026-02-01T10:00:00Z",
                   completed_at="2026-02-02T14:00:00Z", completed_by="user-2"),
                _rt_stage("stage-docs", "Document Collection", 2, [
                    _rt_proc("proc-docs", "Collect Documents", 1, [
                        _rt_step("step-upload-docs", "Upload Documents", "attachment", 1,
                                 status="in_progress", started_at="2026-02-02T14:00:00Z"),
                        _rt_step("step-verify-docs", "Verify Documents", "assignment", 2),
                    ], status="in_progress", started_at="2026-02-02T14:00:00Z"),
                ], status="in_progress", entered_at="2026-02-02T14:00:00Z"),
                _rt_stage("stage-underwriting", "Underwriting", 3, [
                    _rt_proc("proc-risk", "Risk Assessment", 1, [
                        _rt_step("step-auto-credit", "Auto Credit Check", "automation", 1),
                        _rt_step("step-risk-review", "Risk Review", "assignment", 2),
                    ]),
                    _rt_proc("proc-decision", "Approval Decision", 2, [
                        _rt_step("step-amount-check", "Amount Decision", "decision", 1),
                        _rt_step("step-mgr-approval", "Manager Approval", "approval", 2),
                        _rt_step("step-vp-approval", "VP Approval", "approval", 3),
                    ]),
                ]),
                _rt_stage("stage-disburse", "Disbursement", 4, [
                    _rt_proc("proc-disburse", "Disbursement Process", 1, [
                        _rt_step("step-send-funds", "Process Disbursement", "assignment", 1),
                        _rt_step("step-confirm-notify", "Confirmation Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-02-01T10:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 25, "escalation_level": 0,
        },

        # ── Loan case 2: in Underwriting (risk review step) ──
        {
            "_id": "LOAN-002", "case_type_id": "ct-loan", "case_type_name": "Loan Origination",
            "title": "Personal Loan - Jane Smith", "status": "in_progress", "priority": "medium",
            "owner_id": "user-2", "team_id": "team-1",
            "custom_fields": {"loanAmount": 50000, "loanType": "Personal", "applicantName": "Jane Smith", "applicantIncome": 62000, "creditChecked": True},
            "current_stage_id": "stage-underwriting", "current_process_id": "proc-risk", "current_step_id": "step-risk-review",
            "stages": [
                _rt_stage("stage-intake", "Intake Review", 1, [
                    _rt_proc("proc-intake", "Application Intake", 1, [
                        _rt_step("step-fill-app", "Fill Application", "assignment", 1,
                                 status="completed", started_at="2026-01-20T09:00:00Z",
                                 completed_at="2026-01-20T11:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-20T09:00:00Z", completed_at="2026-01-20T11:00:00Z"),
                ], status="completed", entered_at="2026-01-20T09:00:00Z",
                   completed_at="2026-01-20T11:00:00Z", completed_by="user-2"),
                _rt_stage("stage-docs", "Document Collection", 2, [
                    _rt_proc("proc-docs", "Collect Documents", 1, [
                        _rt_step("step-upload-docs", "Upload Documents", "attachment", 1,
                                 status="completed", started_at="2026-01-20T11:00:00Z",
                                 completed_at="2026-01-22T10:00:00Z"),
                        _rt_step("step-verify-docs", "Verify Documents", "assignment", 2,
                                 status="completed", started_at="2026-01-22T10:00:00Z",
                                 completed_at="2026-01-22T16:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-20T11:00:00Z", completed_at="2026-01-22T16:00:00Z"),
                ], status="completed", entered_at="2026-01-20T11:00:00Z",
                   completed_at="2026-01-22T16:00:00Z", completed_by="user-2"),
                _rt_stage("stage-underwriting", "Underwriting", 3, [
                    _rt_proc("proc-risk", "Risk Assessment", 1, [
                        _rt_step("step-auto-credit", "Auto Credit Check", "automation", 1,
                                 status="completed", started_at="2026-01-22T16:00:00Z",
                                 completed_at="2026-01-22T16:00:00Z"),
                        _rt_step("step-risk-review", "Risk Review", "assignment", 2,
                                 status="in_progress", started_at="2026-01-22T16:00:00Z",
                                 assigned_to="user-1"),
                    ], status="in_progress", started_at="2026-01-22T16:00:00Z"),
                    _rt_proc("proc-decision", "Approval Decision", 2, [
                        _rt_step("step-amount-check", "Amount Decision", "decision", 1),
                        _rt_step("step-mgr-approval", "Manager Approval", "approval", 2),
                        _rt_step("step-vp-approval", "VP Approval", "approval", 3),
                    ]),
                ], status="in_progress", entered_at="2026-01-22T16:00:00Z"),
                _rt_stage("stage-disburse", "Disbursement", 4, [
                    _rt_proc("proc-disburse", "Disbursement Process", 1, [
                        _rt_step("step-send-funds", "Process Disbursement", "assignment", 1),
                        _rt_step("step-confirm-notify", "Confirmation Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-01-20T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 18, "escalation_level": 0,
        },

        # ── Loan case 3: in Underwriting VP approval (high value, escalated) ──
        {
            "_id": "LOAN-003", "case_type_id": "ct-loan", "case_type_name": "Loan Origination",
            "title": "Commercial Loan - Acme Corp", "status": "in_progress", "priority": "critical",
            "owner_id": "user-1", "team_id": "team-1",
            "custom_fields": {"loanAmount": 500000, "loanType": "Commercial", "applicantName": "Acme Corp", "applicantIncome": 2000000, "creditChecked": True},
            "current_stage_id": "stage-underwriting", "current_process_id": "proc-decision", "current_step_id": "step-vp-approval",
            "stages": [
                _rt_stage("stage-intake", "Intake Review", 1, [
                    _rt_proc("proc-intake", "Application Intake", 1, [
                        _rt_step("step-fill-app", "Fill Application", "assignment", 1,
                                 status="completed", started_at="2026-01-10T08:00:00Z",
                                 completed_at="2026-01-10T10:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-01-10T08:00:00Z", completed_at="2026-01-10T10:00:00Z"),
                ], status="completed", entered_at="2026-01-10T08:00:00Z",
                   completed_at="2026-01-10T10:00:00Z", completed_by="user-1"),
                _rt_stage("stage-docs", "Document Collection", 2, [
                    _rt_proc("proc-docs", "Collect Documents", 1, [
                        _rt_step("step-upload-docs", "Upload Documents", "attachment", 1,
                                 status="completed", started_at="2026-01-10T10:00:00Z",
                                 completed_at="2026-01-11T14:00:00Z"),
                        _rt_step("step-verify-docs", "Verify Documents", "assignment", 2,
                                 status="completed", started_at="2026-01-11T14:00:00Z",
                                 completed_at="2026-01-12T14:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-10T10:00:00Z", completed_at="2026-01-12T14:00:00Z"),
                ], status="completed", entered_at="2026-01-10T10:00:00Z",
                   completed_at="2026-01-12T14:00:00Z", completed_by="user-2"),
                _rt_stage("stage-underwriting", "Underwriting", 3, [
                    _rt_proc("proc-risk", "Risk Assessment", 1, [
                        _rt_step("step-auto-credit", "Auto Credit Check", "automation", 1,
                                 status="completed", started_at="2026-01-12T14:00:00Z",
                                 completed_at="2026-01-12T14:00:00Z"),
                        _rt_step("step-risk-review", "Risk Review", "assignment", 2,
                                 status="completed", started_at="2026-01-12T14:00:00Z",
                                 completed_at="2026-01-13T10:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-01-12T14:00:00Z", completed_at="2026-01-13T10:00:00Z"),
                    _rt_proc("proc-decision", "Approval Decision", 2, [
                        _rt_step("step-amount-check", "Amount Decision", "decision", 1,
                                 status="completed", started_at="2026-01-13T10:00:00Z",
                                 completed_at="2026-01-13T10:00:00Z"),
                        _rt_step("step-mgr-approval", "Manager Approval", "approval", 2,
                                 status="skipped"),
                        _rt_step("step-vp-approval", "VP Approval", "approval", 3,
                                 status="in_progress", started_at="2026-01-15T09:00:00Z",
                                 assigned_to="user-admin"),
                    ], status="in_progress", started_at="2026-01-13T10:00:00Z"),
                ], status="in_progress", entered_at="2026-01-12T14:00:00Z"),
                _rt_stage("stage-disburse", "Disbursement", 4, [
                    _rt_proc("proc-disburse", "Disbursement Process", 1, [
                        _rt_step("step-send-funds", "Process Disbursement", "assignment", 1),
                        _rt_step("step-confirm-notify", "Confirmation Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-01-10T08:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 5, "escalation_level": 1,
        },

        # ── KYC case 1: in Identity Verification ──
        {
            "_id": "KYC-001", "case_type_id": "ct-kyc", "case_type_name": "Customer Onboarding",
            "title": "KYC - Michael Chen", "status": "in_progress", "priority": "high",
            "owner_id": "user-3", "team_id": "team-2",
            "custom_fields": {"customerName": "Michael Chen", "accountType": "Premium Checking", "riskLevel": "medium"},
            "current_stage_id": "stage-id-verify", "current_process_id": "proc-id-verify", "current_step_id": "step-verify-id",
            "stages": [
                _rt_stage("stage-app-review", "Application Review", 1, [
                    _rt_proc("proc-app-review", "Review Application", 1, [
                        _rt_step("step-kyc-form", "KYC Application Form", "assignment", 1,
                                 status="completed", started_at="2026-03-01T09:00:00Z",
                                 completed_at="2026-03-01T11:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-03-01T09:00:00Z", completed_at="2026-03-01T11:00:00Z"),
                ], status="completed", entered_at="2026-03-01T09:00:00Z",
                   completed_at="2026-03-01T11:00:00Z", completed_by="user-3"),
                _rt_stage("stage-id-verify", "Identity Verification", 2, [
                    _rt_proc("proc-id-verify", "Verify Identity", 1, [
                        _rt_step("step-upload-id", "Upload ID Documents", "attachment", 1,
                                 status="completed", started_at="2026-03-01T11:00:00Z",
                                 completed_at="2026-03-02T09:30:00Z"),
                        _rt_step("step-verify-id", "Verify Identity", "assignment", 2,
                                 status="in_progress", started_at="2026-03-02T09:30:00Z",
                                 assigned_to="user-3"),
                    ], status="in_progress", started_at="2026-03-01T11:00:00Z"),
                ], status="in_progress", entered_at="2026-03-01T11:00:00Z"),
                _rt_stage("stage-risk", "Risk Assessment", 3, [
                    _rt_proc("proc-risk-assess", "Assess Risk", 1, [
                        _rt_step("step-risk-decision", "Risk Level Decision", "decision", 1),
                        _rt_step("step-auto-clear", "Auto Clear", "automation", 2),
                        _rt_step("step-edd", "Enhanced Due Diligence", "assignment", 3),
                    ]),
                ]),
                _rt_stage("stage-acct-setup", "Account Setup", 4, [
                    _rt_proc("proc-acct-setup", "Setup Account", 1, [
                        _rt_step("step-create-acct", "Create Account", "assignment", 1),
                    ]),
                ]),
                _rt_stage("stage-welcome", "Welcome", 5, [
                    _rt_proc("proc-welcome", "Welcome Process", 1, [
                        _rt_step("step-welcome-notify", "Send Welcome Pack", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-3", "created_at": "2026-03-01T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 15, "escalation_level": 0,
        },

        # ── KYC case 2: in Risk Assessment (high-risk, EDD step) ──
        {
            "_id": "KYC-002", "case_type_id": "ct-kyc", "case_type_name": "Customer Onboarding",
            "title": "KYC - Global Trading LLC", "status": "in_progress", "priority": "critical",
            "owner_id": "user-1", "team_id": "team-2",
            "custom_fields": {"customerName": "Global Trading LLC", "accountType": "Business Account", "riskLevel": "high"},
            "current_stage_id": "stage-risk", "current_process_id": "proc-risk-assess", "current_step_id": "step-edd",
            "stages": [
                _rt_stage("stage-app-review", "Application Review", 1, [
                    _rt_proc("proc-app-review", "Review Application", 1, [
                        _rt_step("step-kyc-form", "KYC Application Form", "assignment", 1,
                                 status="completed", started_at="2026-02-20T08:00:00Z",
                                 completed_at="2026-02-20T10:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-02-20T08:00:00Z", completed_at="2026-02-20T10:00:00Z"),
                ], status="completed", entered_at="2026-02-20T08:00:00Z",
                   completed_at="2026-02-20T10:00:00Z", completed_by="user-1"),
                _rt_stage("stage-id-verify", "Identity Verification", 2, [
                    _rt_proc("proc-id-verify", "Verify Identity", 1, [
                        _rt_step("step-upload-id", "Upload ID Documents", "attachment", 1,
                                 status="completed", started_at="2026-02-20T10:00:00Z",
                                 completed_at="2026-02-21T14:00:00Z"),
                        _rt_step("step-verify-id", "Verify Identity", "assignment", 2,
                                 status="completed", started_at="2026-02-21T14:00:00Z",
                                 completed_at="2026-02-22T16:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-20T10:00:00Z", completed_at="2026-02-22T16:00:00Z"),
                ], status="completed", entered_at="2026-02-20T10:00:00Z",
                   completed_at="2026-02-22T16:00:00Z", completed_by="user-3"),
                _rt_stage("stage-risk", "Risk Assessment", 3, [
                    _rt_proc("proc-risk-assess", "Assess Risk", 1, [
                        _rt_step("step-risk-decision", "Risk Level Decision", "decision", 1,
                                 status="completed", started_at="2026-02-22T16:00:00Z",
                                 completed_at="2026-02-22T16:00:00Z"),
                        _rt_step("step-auto-clear", "Auto Clear", "automation", 2,
                                 status="skipped"),
                        _rt_step("step-edd", "Enhanced Due Diligence", "assignment", 3,
                                 status="in_progress", started_at="2026-02-22T16:00:00Z",
                                 assigned_to="user-1"),
                    ], status="in_progress", started_at="2026-02-22T16:00:00Z"),
                ], status="in_progress", entered_at="2026-02-22T16:00:00Z"),
                _rt_stage("stage-acct-setup", "Account Setup", 4, [
                    _rt_proc("proc-acct-setup", "Setup Account", 1, [
                        _rt_step("step-create-acct", "Create Account", "assignment", 1),
                    ]),
                ]),
                _rt_stage("stage-welcome", "Welcome", 5, [
                    _rt_proc("proc-welcome", "Welcome Process", 1, [
                        _rt_step("step-welcome-notify", "Send Welcome Pack", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-02-20T08:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_15, "sla_days_remaining": 8, "escalation_level": 1,
        },

        # ── KYC case 3: in Account Setup ──
        {
            "_id": "KYC-003", "case_type_id": "ct-kyc", "case_type_name": "Customer Onboarding",
            "title": "KYC - Sarah Williams", "status": "in_progress", "priority": "low",
            "owner_id": "user-3", "team_id": "team-2",
            "custom_fields": {"customerName": "Sarah Williams", "accountType": "Savings", "riskLevel": "low", "riskCleared": True},
            "current_stage_id": "stage-acct-setup", "current_process_id": "proc-acct-setup", "current_step_id": "step-create-acct",
            "stages": [
                _rt_stage("stage-app-review", "Application Review", 1, [
                    _rt_proc("proc-app-review", "Review Application", 1, [
                        _rt_step("step-kyc-form", "KYC Application Form", "assignment", 1,
                                 status="completed", started_at="2026-02-10T09:00:00Z",
                                 completed_at="2026-02-10T10:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-10T09:00:00Z", completed_at="2026-02-10T10:00:00Z"),
                ], status="completed", entered_at="2026-02-10T09:00:00Z",
                   completed_at="2026-02-10T10:00:00Z", completed_by="user-3"),
                _rt_stage("stage-id-verify", "Identity Verification", 2, [
                    _rt_proc("proc-id-verify", "Verify Identity", 1, [
                        _rt_step("step-upload-id", "Upload ID Documents", "attachment", 1,
                                 status="completed", started_at="2026-02-10T10:00:00Z",
                                 completed_at="2026-02-10T14:00:00Z"),
                        _rt_step("step-verify-id", "Verify Identity", "assignment", 2,
                                 status="completed", started_at="2026-02-10T14:00:00Z",
                                 completed_at="2026-02-11T09:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-10T10:00:00Z", completed_at="2026-02-11T09:00:00Z"),
                ], status="completed", entered_at="2026-02-10T10:00:00Z",
                   completed_at="2026-02-11T09:00:00Z", completed_by="user-3"),
                _rt_stage("stage-risk", "Risk Assessment", 3, [
                    _rt_proc("proc-risk-assess", "Assess Risk", 1, [
                        _rt_step("step-risk-decision", "Risk Level Decision", "decision", 1,
                                 status="completed", started_at="2026-02-11T09:00:00Z",
                                 completed_at="2026-02-11T09:00:00Z"),
                        _rt_step("step-auto-clear", "Auto Clear", "automation", 2,
                                 status="completed", started_at="2026-02-11T09:00:00Z",
                                 completed_at="2026-02-11T09:00:00Z"),
                        _rt_step("step-edd", "Enhanced Due Diligence", "assignment", 3,
                                 status="skipped"),
                    ], status="completed", started_at="2026-02-11T09:00:00Z", completed_at="2026-02-11T09:00:00Z"),
                ], status="completed", entered_at="2026-02-11T09:00:00Z",
                   completed_at="2026-02-11T14:00:00Z", completed_by="user-1"),
                _rt_stage("stage-acct-setup", "Account Setup", 4, [
                    _rt_proc("proc-acct-setup", "Setup Account", 1, [
                        _rt_step("step-create-acct", "Create Account", "assignment", 1,
                                 status="in_progress", started_at="2026-02-11T14:00:00Z",
                                 assigned_to="user-3"),
                    ], status="in_progress", started_at="2026-02-11T14:00:00Z"),
                ], status="in_progress", entered_at="2026-02-11T14:00:00Z"),
                _rt_stage("stage-welcome", "Welcome", 5, [
                    _rt_proc("proc-welcome", "Welcome Process", 1, [
                        _rt_step("step-welcome-notify", "Send Welcome Pack", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-3", "created_at": "2026-02-10T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 12, "escalation_level": 0,
        },

        # ── Claims case 1: in Investigation ──
        {
            "_id": "CLM-001", "case_type_id": "ct-claims", "case_type_name": "Insurance Claims",
            "title": "Auto Claim - Robert Taylor", "status": "in_progress", "priority": "high",
            "owner_id": "user-2", "team_id": "team-3",
            "custom_fields": {"claimantName": "Robert Taylor", "claimType": "Auto Collision", "claimAmount": 18500, "policyNumber": "POL-2025-44821"},
            "current_stage_id": "stage-investigation", "current_process_id": "proc-investigate", "current_step_id": "step-gather-evidence",
            "stages": [
                _rt_stage("stage-claim-intake", "Claim Intake", 1, [
                    _rt_proc("proc-claim-intake", "Record Claim", 1, [
                        _rt_step("step-claim-form", "Submit Claim Form", "assignment", 1,
                                 status="completed", started_at="2026-03-05T10:00:00Z",
                                 completed_at="2026-03-05T11:30:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-03-05T10:00:00Z", completed_at="2026-03-05T11:30:00Z"),
                ], status="completed", entered_at="2026-03-05T10:00:00Z",
                   completed_at="2026-03-05T11:30:00Z", completed_by="user-2"),
                _rt_stage("stage-investigation", "Investigation", 2, [
                    _rt_proc("proc-investigate", "Investigate Claim", 1, [
                        _rt_step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                                 status="in_progress", started_at="2026-03-05T11:30:00Z",
                                 assigned_to="user-2"),
                        _rt_step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2),
                    ], status="in_progress", started_at="2026-03-05T11:30:00Z"),
                ], status="in_progress", entered_at="2026-03-05T11:30:00Z"),
                _rt_stage("stage-adjudicate", "Adjudication", 3, [
                    _rt_proc("proc-adjudicate", "Adjudicate Claim", 1, [
                        _rt_step("step-adjudicate-decision", "Coverage Decision", "decision", 1),
                        _rt_step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2),
                        _rt_step("step-senior-review", "Senior Review", "approval", 3),
                    ]),
                ]),
                _rt_stage("stage-settlement", "Settlement", 4, [
                    _rt_proc("proc-settle", "Process Settlement", 1, [
                        _rt_step("step-calc-payout", "Calculate Payout", "assignment", 1),
                        _rt_step("step-issue-payment", "Issue Payment", "assignment", 2),
                    ]),
                ]),
                _rt_stage("stage-closure", "Closure", 5, [
                    _rt_proc("proc-closure", "Close Claim", 1, [
                        _rt_step("step-close-notify", "Send Closure Notification", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-03-05T10:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 14, "escalation_level": 0,
        },

        # ── Claims case 2: in Adjudication (high-value, escalated) ──
        {
            "_id": "CLM-002", "case_type_id": "ct-claims", "case_type_name": "Insurance Claims",
            "title": "Property Claim - Maria Garcia", "status": "in_progress", "priority": "critical",
            "owner_id": "user-3", "team_id": "team-3",
            "custom_fields": {"claimantName": "Maria Garcia", "claimType": "Property Damage", "claimAmount": 125000, "policyNumber": "POL-2024-31056"},
            "current_stage_id": "stage-adjudicate", "current_process_id": "proc-adjudicate", "current_step_id": "step-senior-review",
            "stages": [
                _rt_stage("stage-claim-intake", "Claim Intake", 1, [
                    _rt_proc("proc-claim-intake", "Record Claim", 1, [
                        _rt_step("step-claim-form", "Submit Claim Form", "assignment", 1,
                                 status="completed", started_at="2026-02-15T08:00:00Z",
                                 completed_at="2026-02-15T10:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-15T08:00:00Z", completed_at="2026-02-15T10:00:00Z"),
                ], status="completed", entered_at="2026-02-15T08:00:00Z",
                   completed_at="2026-02-15T10:00:00Z", completed_by="user-3"),
                _rt_stage("stage-investigation", "Investigation", 2, [
                    _rt_proc("proc-investigate", "Investigate Claim", 1, [
                        _rt_step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                                 status="completed", started_at="2026-02-15T10:00:00Z",
                                 completed_at="2026-02-18T16:00:00Z", assigned_to="user-2"),
                        _rt_step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2,
                                 status="completed", started_at="2026-02-18T16:00:00Z",
                                 completed_at="2026-02-20T16:00:00Z"),
                    ], status="completed", started_at="2026-02-15T10:00:00Z", completed_at="2026-02-20T16:00:00Z"),
                ], status="completed", entered_at="2026-02-15T10:00:00Z",
                   completed_at="2026-02-20T16:00:00Z", completed_by="user-2"),
                _rt_stage("stage-adjudicate", "Adjudication", 3, [
                    _rt_proc("proc-adjudicate", "Adjudicate Claim", 1, [
                        _rt_step("step-adjudicate-decision", "Coverage Decision", "decision", 1,
                                 status="completed", started_at="2026-02-20T16:00:00Z",
                                 completed_at="2026-02-20T16:00:00Z"),
                        _rt_step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2,
                                 status="skipped"),
                        _rt_step("step-senior-review", "Senior Review", "approval", 3,
                                 status="in_progress", started_at="2026-02-20T16:00:00Z",
                                 assigned_to="user-admin",
                                 approval_chain_id="approval-2"),
                    ], status="in_progress", started_at="2026-02-20T16:00:00Z"),
                ], status="in_progress", entered_at="2026-02-20T16:00:00Z"),
                _rt_stage("stage-settlement", "Settlement", 4, [
                    _rt_proc("proc-settle", "Process Settlement", 1, [
                        _rt_step("step-calc-payout", "Calculate Payout", "assignment", 1),
                        _rt_step("step-issue-payment", "Issue Payment", "assignment", 2),
                    ]),
                ]),
                _rt_stage("stage-closure", "Closure", 5, [
                    _rt_proc("proc-closure", "Close Claim", 1, [
                        _rt_step("step-close-notify", "Send Closure Notification", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-3", "created_at": "2026-02-15T08:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_15, "sla_days_remaining": 4, "escalation_level": 1,
        },

        # ── Claims case 3: in Settlement ──
        {
            "_id": "CLM-003", "case_type_id": "ct-claims", "case_type_name": "Insurance Claims",
            "title": "Medical Claim - David Kim", "status": "in_progress", "priority": "medium",
            "owner_id": "user-2", "team_id": "team-3",
            "custom_fields": {"claimantName": "David Kim", "claimType": "Medical", "claimAmount": 8200, "policyNumber": "POL-2025-17893"},
            "current_stage_id": "stage-settlement", "current_process_id": "proc-settle", "current_step_id": "step-calc-payout",
            "stages": [
                _rt_stage("stage-claim-intake", "Claim Intake", 1, [
                    _rt_proc("proc-claim-intake", "Record Claim", 1, [
                        _rt_step("step-claim-form", "Submit Claim Form", "assignment", 1,
                                 status="completed", started_at="2026-01-28T09:00:00Z",
                                 completed_at="2026-01-28T10:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-28T09:00:00Z", completed_at="2026-01-28T10:00:00Z"),
                ], status="completed", entered_at="2026-01-28T09:00:00Z",
                   completed_at="2026-01-28T10:00:00Z", completed_by="user-2"),
                _rt_stage("stage-investigation", "Investigation", 2, [
                    _rt_proc("proc-investigate", "Investigate Claim", 1, [
                        _rt_step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                                 status="completed", started_at="2026-01-28T10:00:00Z",
                                 completed_at="2026-01-30T14:00:00Z", assigned_to="user-3"),
                        _rt_step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2,
                                 status="completed", started_at="2026-01-30T14:00:00Z",
                                 completed_at="2026-02-01T14:00:00Z"),
                    ], status="completed", started_at="2026-01-28T10:00:00Z", completed_at="2026-02-01T14:00:00Z"),
                ], status="completed", entered_at="2026-01-28T10:00:00Z",
                   completed_at="2026-02-01T14:00:00Z", completed_by="user-3"),
                _rt_stage("stage-adjudicate", "Adjudication", 3, [
                    _rt_proc("proc-adjudicate", "Adjudicate Claim", 1, [
                        _rt_step("step-adjudicate-decision", "Coverage Decision", "decision", 1,
                                 status="completed", started_at="2026-02-01T14:00:00Z",
                                 completed_at="2026-02-01T14:00:00Z"),
                        _rt_step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2,
                                 status="completed", started_at="2026-02-01T14:00:00Z",
                                 completed_at="2026-02-05T09:00:00Z",
                                 approval_chain_id="approval-5"),
                        _rt_step("step-senior-review", "Senior Review", "approval", 3,
                                 status="skipped"),
                    ], status="completed", started_at="2026-02-01T14:00:00Z", completed_at="2026-02-05T09:00:00Z"),
                ], status="completed", entered_at="2026-02-01T14:00:00Z",
                   completed_at="2026-02-05T09:00:00Z", completed_by="user-admin"),
                _rt_stage("stage-settlement", "Settlement", 4, [
                    _rt_proc("proc-settle", "Process Settlement", 1, [
                        _rt_step("step-calc-payout", "Calculate Payout", "assignment", 1,
                                 status="in_progress", started_at="2026-02-05T09:00:00Z",
                                 assigned_to="user-2"),
                        _rt_step("step-issue-payment", "Issue Payment", "assignment", 2),
                    ], status="in_progress", started_at="2026-02-05T09:00:00Z"),
                ], status="in_progress", entered_at="2026-02-05T09:00:00Z"),
                _rt_stage("stage-closure", "Closure", 5, [
                    _rt_proc("proc-closure", "Close Claim", 1, [
                        _rt_step("step-close-notify", "Send Closure Notification", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-01-28T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 10, "escalation_level": 0,
        },
    ]
    await db.cases.insert_many(cases)

    # ═══════════════════════════════════════════════════════════
    # ASSIGNMENTS (materialized worklist)
    # ═══════════════════════════════════════════════════════════
    assignments = [
        # LOAN-001: step-upload-docs waiting
        {"_id": "asgn-1", "case_id": "LOAN-001", "case_type_id": "ct-loan",
         "stage_id": "stage-docs", "process_id": "proc-docs",
         "step_definition_id": "step-upload-docs", "step_name": "Upload Documents",
         "step_type": "attachment", "assigned_to": None, "assigned_role": "WORKER",
         "status": "open", "priority": "high",
         "created_at": "2026-02-02T14:00:00Z", "due_at": "2026-02-05T14:00:00Z",
         "completed_at": None, "completed_by": None},
        # LOAN-002: step-risk-review assigned to Alice
        {"_id": "asgn-2", "case_id": "LOAN-002", "case_type_id": "ct-loan",
         "stage_id": "stage-underwriting", "process_id": "proc-risk",
         "step_definition_id": "step-risk-review", "step_name": "Risk Review",
         "step_type": "assignment", "assigned_to": "user-1", "assigned_role": "MANAGER",
         "status": "in_progress", "priority": "medium",
         "created_at": "2026-01-22T16:00:00Z", "due_at": "2026-01-24T16:00:00Z",
         "completed_at": None, "completed_by": None},
        # LOAN-003: step-vp-approval assigned to Admin
        {"_id": "asgn-3", "case_id": "LOAN-003", "case_type_id": "ct-loan",
         "stage_id": "stage-underwriting", "process_id": "proc-decision",
         "step_definition_id": "step-vp-approval", "step_name": "VP Approval",
         "step_type": "approval", "assigned_to": "user-admin", "assigned_role": "ADMIN",
         "status": "in_progress", "priority": "critical",
         "created_at": "2026-01-15T09:00:00Z", "due_at": "2026-01-17T09:00:00Z",
         "completed_at": None, "completed_by": None},
        # KYC-001: step-verify-id assigned to Carol
        {"_id": "asgn-4", "case_id": "KYC-001", "case_type_id": "ct-kyc",
         "stage_id": "stage-id-verify", "process_id": "proc-id-verify",
         "step_definition_id": "step-verify-id", "step_name": "Verify Identity",
         "step_type": "assignment", "assigned_to": "user-3", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "high",
         "created_at": "2026-03-02T09:30:00Z", "due_at": "2026-03-03T09:30:00Z",
         "completed_at": None, "completed_by": None},
        # KYC-002: step-edd assigned to Alice
        {"_id": "asgn-5", "case_id": "KYC-002", "case_type_id": "ct-kyc",
         "stage_id": "stage-risk", "process_id": "proc-risk-assess",
         "step_definition_id": "step-edd", "step_name": "Enhanced Due Diligence",
         "step_type": "assignment", "assigned_to": "user-1", "assigned_role": "MANAGER",
         "status": "in_progress", "priority": "critical",
         "created_at": "2026-02-22T16:00:00Z", "due_at": "2026-02-25T16:00:00Z",
         "completed_at": None, "completed_by": None},
        # KYC-003: step-create-acct assigned to Carol
        {"_id": "asgn-6", "case_id": "KYC-003", "case_type_id": "ct-kyc",
         "stage_id": "stage-acct-setup", "process_id": "proc-acct-setup",
         "step_definition_id": "step-create-acct", "step_name": "Create Account",
         "step_type": "assignment", "assigned_to": "user-3", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "low",
         "created_at": "2026-02-11T14:00:00Z", "due_at": "2026-02-12T14:00:00Z",
         "completed_at": None, "completed_by": None},
        # CLM-001: step-gather-evidence assigned to Bob
        {"_id": "asgn-7", "case_id": "CLM-001", "case_type_id": "ct-claims",
         "stage_id": "stage-investigation", "process_id": "proc-investigate",
         "step_definition_id": "step-gather-evidence", "step_name": "Gather Evidence",
         "step_type": "assignment", "assigned_to": "user-2", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "high",
         "created_at": "2026-03-05T11:30:00Z", "due_at": "2026-03-09T11:30:00Z",
         "completed_at": None, "completed_by": None},
        # CLM-002: step-senior-review assigned to Admin
        {"_id": "asgn-8", "case_id": "CLM-002", "case_type_id": "ct-claims",
         "stage_id": "stage-adjudicate", "process_id": "proc-adjudicate",
         "step_definition_id": "step-senior-review", "step_name": "Senior Review",
         "step_type": "approval", "assigned_to": "user-admin", "assigned_role": "ADMIN",
         "status": "in_progress", "priority": "critical",
         "created_at": "2026-02-20T16:00:00Z", "due_at": "2026-02-22T16:00:00Z",
         "completed_at": None, "completed_by": None},
        # CLM-003: step-calc-payout assigned to Bob
        {"_id": "asgn-9", "case_id": "CLM-003", "case_type_id": "ct-claims",
         "stage_id": "stage-settlement", "process_id": "proc-settle",
         "step_definition_id": "step-calc-payout", "step_name": "Calculate Payout",
         "step_type": "assignment", "assigned_to": "user-2", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "medium",
         "created_at": "2026-02-05T09:00:00Z", "due_at": "2026-02-07T09:00:00Z",
         "completed_at": None, "completed_by": None},
    ]
    await db.assignments.insert_many(assignments)

    # ─── Tasks (legacy — retained for backward compat) ──────
    tasks = [
        # Loan tasks
        {"_id": "task-1", "caseId": "LOAN-001", "title": "Collect income verification",
         "description": "Request and verify applicant income documents (W-2, pay stubs)",
         "assigneeId": "user-2", "teamId": "team-1", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["documents", "verification"],
         "checklist": [
             {"id": "cl-1", "item": "Request W-2 forms", "checked": True, "completedAt": "2026-02-03T10:00:00Z"},
             {"id": "cl-2", "item": "Request pay stubs (3 months)", "checked": True, "completedAt": "2026-02-03T10:00:00Z"},
             {"id": "cl-3", "item": "Verify income matches application", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-02T14:00:00Z", "updatedAt": "2026-02-05T09:00:00Z", "completedAt": None},
        {"_id": "task-2", "caseId": "LOAN-001", "title": "Property appraisal",
         "description": "Order and review property appraisal report",
         "assigneeId": "user-1", "teamId": "team-1", "status": "pending", "priority": "medium",
         "dueDate": "2026-03-25T00:00:00Z", "dependsOn": ["task-1"], "tags": ["appraisal"],
         "checklist": [
             {"id": "cl-4", "item": "Order appraisal", "checked": False, "completedAt": None},
             {"id": "cl-5", "item": "Review appraisal report", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-02T14:00:00Z", "updatedAt": "2026-02-02T14:00:00Z", "completedAt": None},
        {"_id": "task-3", "caseId": "LOAN-002", "title": "Credit check review",
         "description": "Review applicant credit report and score",
         "assigneeId": "user-2", "teamId": "team-1", "status": "completed", "priority": "high",
         "dueDate": "2026-02-01T00:00:00Z", "dependsOn": [], "tags": ["credit", "underwriting"],
         "checklist": [
             {"id": "cl-6", "item": "Pull credit report", "checked": True, "completedAt": "2026-01-21T11:00:00Z"},
             {"id": "cl-7", "item": "Verify score meets threshold", "checked": True, "completedAt": "2026-01-22T09:00:00Z"},
         ],
         "createdAt": "2026-01-20T11:00:00Z", "updatedAt": "2026-01-22T09:00:00Z", "completedAt": "2026-01-22T09:00:00Z"},
        {"_id": "task-4", "caseId": "LOAN-003", "title": "Final approval review",
         "description": "VP review and sign-off for commercial loan",
         "assigneeId": "user-1", "teamId": "team-1", "status": "blocked", "priority": "critical",
         "dueDate": "2026-02-01T00:00:00Z", "dependsOn": [], "tags": ["approval", "commercial"],
         "checklist": [
             {"id": "cl-8", "item": "Prepare approval packet", "checked": True, "completedAt": "2026-01-16T10:00:00Z"},
             {"id": "cl-9", "item": "Schedule VP review meeting", "checked": False, "completedAt": None},
             {"id": "cl-10", "item": "Obtain VP signature", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-01-15T09:00:00Z", "updatedAt": "2026-01-18T14:00:00Z", "completedAt": None},
        {"_id": "task-5", "caseId": "LOAN-002", "title": "Risk assessment",
         "description": "Complete risk assessment for personal loan underwriting",
         "assigneeId": "user-2", "teamId": "team-1", "status": "in_progress", "priority": "medium",
         "dueDate": "2026-03-10T00:00:00Z", "dependsOn": ["task-3"], "tags": ["underwriting", "risk"],
         "checklist": [
             {"id": "cl-11", "item": "Calculate debt-to-income ratio", "checked": True, "completedAt": "2026-01-23T10:00:00Z"},
             {"id": "cl-12", "item": "Assess collateral value", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-01-22T16:00:00Z", "updatedAt": "2026-01-25T11:00:00Z", "completedAt": None},
        # KYC tasks
        {"_id": "task-6", "caseId": "KYC-001", "title": "Verify government ID",
         "description": "Scan and validate government-issued photo ID",
         "assigneeId": "user-3", "teamId": "team-2", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-18T00:00:00Z", "dependsOn": [], "tags": ["kyc", "identity"],
         "checklist": [
             {"id": "cl-13", "item": "Scan passport or drivers license", "checked": True, "completedAt": "2026-03-02T09:00:00Z"},
             {"id": "cl-14", "item": "Run facial recognition match", "checked": False, "completedAt": None},
             {"id": "cl-15", "item": "Verify document authenticity", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-03-01T11:00:00Z", "updatedAt": "2026-03-02T09:00:00Z", "completedAt": None},
        {"_id": "task-7", "caseId": "KYC-002", "title": "Enhanced due diligence",
         "description": "Perform enhanced due diligence for high-risk corporate entity",
         "assigneeId": "user-1", "teamId": "team-2", "status": "in_progress", "priority": "critical",
         "dueDate": "2026-03-15T00:00:00Z", "dependsOn": [], "tags": ["kyc", "risk", "edd"],
         "checklist": [
             {"id": "cl-16", "item": "Verify beneficial ownership", "checked": True, "completedAt": "2026-02-23T10:00:00Z"},
             {"id": "cl-17", "item": "Screen against sanctions lists", "checked": True, "completedAt": "2026-02-23T14:00:00Z"},
             {"id": "cl-18", "item": "Assess source of funds", "checked": False, "completedAt": None},
             {"id": "cl-19", "item": "Prepare risk report", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-22T16:00:00Z", "updatedAt": "2026-02-23T14:00:00Z", "completedAt": None},
        {"_id": "task-8", "caseId": "KYC-003", "title": "Configure account",
         "description": "Set up savings account with proper tier and interest rate",
         "assigneeId": "user-3", "teamId": "team-2", "status": "pending", "priority": "low",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["account", "setup"],
         "checklist": [
             {"id": "cl-20", "item": "Create account in core banking", "checked": False, "completedAt": None},
             {"id": "cl-21", "item": "Set up online banking access", "checked": False, "completedAt": None},
             {"id": "cl-22", "item": "Mail welcome kit", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-11T14:00:00Z", "updatedAt": "2026-02-11T14:00:00Z", "completedAt": None},
        # Insurance Claims tasks
        {"_id": "task-9", "caseId": "CLM-001", "title": "Obtain repair estimate",
         "description": "Get certified repair estimate from approved body shop",
         "assigneeId": "user-2", "teamId": "team-3", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["investigation", "auto"],
         "checklist": [
             {"id": "cl-23", "item": "Contact approved body shop", "checked": True, "completedAt": "2026-03-06T09:00:00Z"},
             {"id": "cl-24", "item": "Schedule vehicle inspection", "checked": True, "completedAt": "2026-03-06T14:00:00Z"},
             {"id": "cl-25", "item": "Collect written estimate", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-03-05T11:30:00Z", "updatedAt": "2026-03-06T14:00:00Z", "completedAt": None},
        {"_id": "task-10", "caseId": "CLM-002", "title": "Review structural engineer report",
         "description": "Analyze structural damage assessment for property claim",
         "assigneeId": "user-3", "teamId": "team-3", "status": "in_progress", "priority": "critical",
         "dueDate": "2026-03-10T00:00:00Z", "dependsOn": [], "tags": ["adjudication", "property"],
         "checklist": [
             {"id": "cl-26", "item": "Review engineer findings", "checked": True, "completedAt": "2026-02-21T10:00:00Z"},
             {"id": "cl-27", "item": "Validate damage photographs", "checked": True, "completedAt": "2026-02-21T14:00:00Z"},
             {"id": "cl-28", "item": "Compare against policy coverage", "checked": False, "completedAt": None},
             {"id": "cl-29", "item": "Prepare adjudication recommendation", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-20T16:00:00Z", "updatedAt": "2026-02-21T14:00:00Z", "completedAt": None},
        {"_id": "task-11", "caseId": "CLM-003", "title": "Process settlement payment",
         "description": "Issue settlement payment to claimant bank account",
         "assigneeId": "user-2", "teamId": "team-3", "status": "pending", "priority": "medium",
         "dueDate": "2026-03-15T00:00:00Z", "dependsOn": [], "tags": ["settlement", "payment"],
         "checklist": [
             {"id": "cl-30", "item": "Verify claimant bank details", "checked": False, "completedAt": None},
             {"id": "cl-31", "item": "Initiate wire transfer", "checked": False, "completedAt": None},
             {"id": "cl-32", "item": "Send payment confirmation", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-05T09:00:00Z", "updatedAt": "2026-02-05T09:00:00Z", "completedAt": None},
        {"_id": "task-12", "caseId": "CLM-001", "title": "Review police report",
         "description": "Verify police report details match claim submission",
         "assigneeId": "user-3", "teamId": "team-3", "status": "completed", "priority": "high",
         "dueDate": "2026-03-10T00:00:00Z", "dependsOn": [], "tags": ["investigation", "verification"],
         "checklist": [
             {"id": "cl-33", "item": "Obtain police report copy", "checked": True, "completedAt": "2026-03-05T14:00:00Z"},
             {"id": "cl-34", "item": "Cross-reference with claim details", "checked": True, "completedAt": "2026-03-05T16:00:00Z"},
         ],
         "createdAt": "2026-03-05T11:30:00Z", "updatedAt": "2026-03-05T16:00:00Z", "completedAt": "2026-03-05T16:00:00Z"},
    ]
    await db.tasks.insert_many(tasks)

    # ─── Comments ───────────────────────────────
    comments = [
        {"_id": "comment-1", "caseId": "LOAN-001", "taskId": None, "userId": "user-1", "userName": "Alice Johnson",
         "userAvatar": None, "text": "Requested income verification from applicant.", "mentions": [],
         "createdAt": "2026-02-02T14:30:00Z", "updatedAt": "2026-02-02T14:30:00Z"},
        {"_id": "comment-2", "caseId": "LOAN-003", "taskId": None, "userId": "user-2", "userName": "Bob Smith",
         "userAvatar": None, "text": "Underwriting completed. @Alice please review for approval.",
         "mentions": [{"id": "user-1", "name": "Alice Johnson"}],
         "createdAt": "2026-01-15T09:15:00Z", "updatedAt": "2026-01-15T09:15:00Z"},
        {"_id": "comment-3", "caseId": "KYC-002", "taskId": None, "userId": "user-1", "userName": "Alice Johnson",
         "userAvatar": None, "text": "Enhanced due diligence required for this corporate entity. @Carol please run sanctions screening.",
         "mentions": [{"id": "user-3", "name": "Carol Davis"}],
         "createdAt": "2026-02-22T17:00:00Z", "updatedAt": "2026-02-22T17:00:00Z"},
        {"_id": "comment-4", "caseId": "CLM-002", "taskId": None, "userId": "user-3", "userName": "Carol Davis",
         "userAvatar": None, "text": "Structural engineer report received. Damage is extensive — recommending full coverage payout.",
         "mentions": [], "createdAt": "2026-02-21T10:30:00Z", "updatedAt": "2026-02-21T10:30:00Z"},
        {"_id": "comment-5", "caseId": "CLM-003", "taskId": None, "userId": "user-2", "userName": "Bob Smith",
         "userAvatar": None, "text": "Claim approved. Waiting for claimant to provide bank details for settlement.",
         "mentions": [], "createdAt": "2026-02-05T09:30:00Z", "updatedAt": "2026-02-05T09:30:00Z"},
    ]
    await db.comments.insert_many(comments)

    # ─── Notifications ──────────────────────────
    notifications = [
        {"_id": "notif-1", "userId": "user-1", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #LOAN-001 (Loan - John Doe)", "entityType": "case", "entityId": "LOAN-001",
         "isRead": True, "readAt": "2026-02-01T10:30:00Z", "createdAt": "2026-02-01T10:00:00Z"},
        {"_id": "notif-2", "userId": "user-1", "type": "sla_warning", "title": "SLA Warning - Case #LOAN-003",
         "message": "Case #LOAN-003 (Acme Corp) has only 5 days remaining before SLA breach",
         "entityType": "case", "entityId": "LOAN-003", "isRead": False, "readAt": None, "createdAt": "2026-03-05T08:00:00Z"},
        {"_id": "notif-3", "userId": "user-1", "type": "mention", "title": "You were mentioned",
         "message": "Bob Smith mentioned you in a comment on case #LOAN-003",
         "entityType": "case", "entityId": "LOAN-003", "isRead": False, "readAt": None, "createdAt": "2026-01-15T09:15:00Z"},
        {"_id": "notif-4", "userId": "user-3", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #KYC-001 (KYC - Michael Chen)",
         "entityType": "case", "entityId": "KYC-001", "isRead": True, "readAt": "2026-03-01T09:30:00Z", "createdAt": "2026-03-01T09:00:00Z"},
        {"_id": "notif-5", "userId": "user-3", "type": "mention", "title": "You were mentioned",
         "message": "Alice Johnson mentioned you in a comment on case #KYC-002",
         "entityType": "case", "entityId": "KYC-002", "isRead": False, "readAt": None, "createdAt": "2026-02-22T17:00:00Z"},
        {"_id": "notif-6", "userId": "user-2", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #CLM-001 (Claims - Robert Taylor)",
         "entityType": "case", "entityId": "CLM-001", "isRead": True, "readAt": "2026-03-05T10:30:00Z", "createdAt": "2026-03-05T10:00:00Z"},
        {"_id": "notif-7", "userId": "user-3", "type": "sla_warning", "title": "SLA Warning - Case #CLM-002",
         "message": "Case #CLM-002 (Maria Garcia property claim) has only 4 days remaining",
         "entityType": "case", "entityId": "CLM-002", "isRead": False, "readAt": None, "createdAt": "2026-03-10T08:00:00Z"},
    ]
    await db.notifications.insert_many(notifications)

    # ─── Workflows ──────────────────────────────
    workflows = [
        {
            "_id": "wf-loan", "name": "Loan Origination Workflow",
            "description": "Standard loan processing workflow from intake to disbursement",
            "case_type_id": "ct-loan",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}},
                    {"id": "n-intake", "type": "task", "label": "Intake Review", "position": {"x": 220, "y": 200}, "assigneeRole": "WORKER", "formId": "form-loan-intake"},
                    {"id": "n-docs", "type": "task", "label": "Document Collection", "position": {"x": 400, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-uw", "type": "task", "label": "Underwriting", "position": {"x": 580, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-decision", "type": "decision", "label": "Approval?", "position": {"x": 760, "y": 200}},
                    {"id": "n-approve", "type": "task", "label": "VP Approval", "position": {"x": 940, "y": 100}, "assigneeRole": "MANAGER"},
                    {"id": "n-disburse", "type": "task", "label": "Disbursement", "position": {"x": 1100, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1280, "y": 200}},
                ],
                "edges": [
                    {"id": "e-1", "source": "n-start", "target": "n-intake"},
                    {"id": "e-2", "source": "n-intake", "target": "n-docs"},
                    {"id": "e-3", "source": "n-docs", "target": "n-uw"},
                    {"id": "e-4", "source": "n-uw", "target": "n-decision"},
                    {"id": "e-5", "source": "n-decision", "target": "n-approve", "label": "High value"},
                    {"id": "e-6", "source": "n-decision", "target": "n-disburse", "label": "Standard"},
                    {"id": "e-7", "source": "n-approve", "target": "n-disburse"},
                    {"id": "e-8", "source": "n-disburse", "target": "n-end"},
                ],
            },
            "version": 1, "is_active": True, "created_by": "user-admin", "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "wf-kyc", "name": "Customer Onboarding Workflow",
            "description": "KYC verification and account setup workflow",
            "case_type_id": "ct-kyc",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}},
                    {"id": "n-app", "type": "task", "label": "Application Review", "position": {"x": 220, "y": 200}, "assigneeRole": "WORKER", "formId": "form-kyc-intake"},
                    {"id": "n-id", "type": "task", "label": "Identity Verification", "position": {"x": 420, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-risk", "type": "task", "label": "Risk Assessment", "position": {"x": 620, "y": 200}, "assigneeRole": "MANAGER"},
                    {"id": "n-decision", "type": "decision", "label": "Risk Level?", "position": {"x": 820, "y": 200}},
                    {"id": "n-setup", "type": "task", "label": "Account Setup", "position": {"x": 1020, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-welcome", "type": "task", "label": "Welcome", "position": {"x": 1200, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1380, "y": 200}},
                ],
                "edges": [
                    {"id": "e-1", "source": "n-start", "target": "n-app"},
                    {"id": "e-2", "source": "n-app", "target": "n-id"},
                    {"id": "e-3", "source": "n-id", "target": "n-risk"},
                    {"id": "e-4", "source": "n-risk", "target": "n-decision"},
                    {"id": "e-5", "source": "n-decision", "target": "n-setup", "label": "Approved"},
                    {"id": "e-6", "source": "n-decision", "target": "n-app", "label": "Rejected"},
                    {"id": "e-7", "source": "n-setup", "target": "n-welcome"},
                    {"id": "e-8", "source": "n-welcome", "target": "n-end"},
                ],
            },
            "version": 1, "is_active": True, "created_by": "user-admin", "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "wf-claims", "name": "Insurance Claims Workflow",
            "description": "End-to-end insurance claims processing",
            "case_type_id": "ct-claims",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}},
                    {"id": "n-intake", "type": "task", "label": "Claim Intake", "position": {"x": 220, "y": 200}, "assigneeRole": "WORKER", "formId": "form-claims-intake"},
                    {"id": "n-investigate", "type": "task", "label": "Investigation", "position": {"x": 420, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-adjudicate", "type": "task", "label": "Adjudication", "position": {"x": 620, "y": 200}, "assigneeRole": "MANAGER"},
                    {"id": "n-decision", "type": "decision", "label": "Covered?", "position": {"x": 820, "y": 200}},
                    {"id": "n-settle", "type": "task", "label": "Settlement", "position": {"x": 1020, "y": 100}, "assigneeRole": "WORKER"},
                    {"id": "n-close", "type": "task", "label": "Closure", "position": {"x": 1020, "y": 300}, "assigneeRole": "WORKER"},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1200, "y": 200}},
                ],
                "edges": [
                    {"id": "e-1", "source": "n-start", "target": "n-intake"},
                    {"id": "e-2", "source": "n-intake", "target": "n-investigate"},
                    {"id": "e-3", "source": "n-investigate", "target": "n-adjudicate"},
                    {"id": "e-4", "source": "n-adjudicate", "target": "n-decision"},
                    {"id": "e-5", "source": "n-decision", "target": "n-settle", "label": "Approved"},
                    {"id": "e-6", "source": "n-decision", "target": "n-close", "label": "Denied"},
                    {"id": "e-7", "source": "n-settle", "target": "n-close"},
                    {"id": "e-8", "source": "n-close", "target": "n-end"},
                ],
            },
            "version": 1, "is_active": True, "created_by": "user-admin", "created_at": "2025-01-15T00:00:00.000Z",
        },
    ]
    await db.workflows.insert_many(workflows)

    # ─── Approval Chains ────────────────────────
    approval_chains = [
        # LOAN-003: sequential, partially approved (pending VP approval)
        {"_id": "approval-1", "case_id": "LOAN-003", "workflow_id": "wf-loan", "mode": "sequential",
         "approvers": [
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 0, "status": "approved",
              "decision_at": "2026-01-16T10:00:00Z", "decision_notes": "Financials look strong — DTI ratio within limits"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-2", "created_at": "2026-01-15T09:30:00Z", "completed_at": None},

        # CLM-002: sequential, partially approved (pending final approval)
        {"_id": "approval-2", "case_id": "CLM-002", "workflow_id": "wf-claims", "mode": "sequential",
         "approvers": [
             {"user_id": "user-3", "user_name": "Carol Davis", "sequence": 0, "status": "approved",
              "decision_at": "2026-02-21T15:00:00Z", "decision_notes": "Engineer report confirms structural damage"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-3", "created_at": "2026-02-20T16:30:00Z", "completed_at": None},

        # LOAN-002: parallel, fully approved
        {"_id": "approval-3", "case_id": "LOAN-002", "workflow_id": "wf-loan", "mode": "parallel",
         "approvers": [
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 0, "status": "approved",
              "decision_at": "2026-02-01T14:30:00Z", "decision_notes": "Income verified, all clear"},
             {"user_id": "user-2", "user_name": "Bob Smith", "sequence": 1, "status": "approved",
              "decision_at": "2026-02-01T16:00:00Z", "decision_notes": "Document completeness confirmed"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 2, "status": "approved",
              "decision_at": "2026-02-02T09:00:00Z", "decision_notes": "Final sign-off granted"},
         ],
         "status": "approved", "created_by": "user-1", "created_at": "2026-02-01T10:00:00Z",
         "completed_at": "2026-02-02T09:00:00Z"},

        # KYC-002: sequential, rejected
        {"_id": "approval-4", "case_id": "KYC-002", "workflow_id": "wf-kyc", "mode": "sequential",
         "approvers": [
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 0, "status": "rejected",
              "decision_at": "2026-03-01T11:00:00Z",
              "decision_notes": "Insufficient identity documentation — additional proof of address required"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "rejected", "created_by": "user-3", "created_at": "2026-02-28T14:00:00Z",
         "completed_at": "2026-03-01T11:00:00Z"},

        # CLM-003: parallel, all pending
        {"_id": "approval-5", "case_id": "CLM-003", "workflow_id": "wf-claims", "mode": "parallel",
         "approvers": [
             {"user_id": "user-2", "user_name": "Bob Smith", "sequence": 0, "status": "pending",
              "decision_at": None, "decision_notes": None},
             {"user_id": "user-3", "user_name": "Carol Davis", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-admin", "created_at": "2026-03-10T08:00:00Z", "completed_at": None},

        # LOAN-001: sequential with delegation
        {"_id": "approval-6", "case_id": "LOAN-001", "workflow_id": "wf-loan", "mode": "sequential",
         "approvers": [
             {"user_id": "user-3", "user_name": "Carol Davis", "sequence": 0, "status": "approved",
              "decision_at": "2026-03-05T10:00:00Z", "decision_notes": "Initial review passed"},
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 1, "status": "delegated",
              "delegated_to": "user-2", "decision_at": "2026-03-05T14:00:00Z",
              "decision_notes": "Delegating to Bob — on leave this week"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 2, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-2", "created_at": "2026-03-04T09:00:00Z", "completed_at": None},
    ]
    await db.approval_chains.insert_many(approval_chains)

    # ─── SLA Definitions ────────────────────────
    sla_definitions = [
        {"_id": "sla-loan-intake", "case_type_id": "ct-loan", "stage_id": "stage-intake", "stage_label": "Intake Review",
         "hours_target": 24, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-loan-docs", "case_type_id": "ct-loan", "stage_id": "stage-docs", "stage_label": "Document Collection",
         "hours_target": 72, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-loan-uw", "case_type_id": "ct-loan", "stage_id": "stage-underwriting", "stage_label": "Underwriting",
         "hours_target": 120, "escalation_enabled": True, "escalate_to_role": "ADMIN", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-kyc-app", "case_type_id": "ct-kyc", "stage_id": "stage-app-review", "stage_label": "Application Review",
         "hours_target": 12, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-kyc-id", "case_type_id": "ct-kyc", "stage_id": "stage-id-verify", "stage_label": "Identity Verification",
         "hours_target": 48, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-claims-intake", "case_type_id": "ct-claims", "stage_id": "stage-intake", "stage_label": "Claim Intake",
         "hours_target": 8, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-claims-investigate", "case_type_id": "ct-claims", "stage_id": "stage-investigation", "stage_label": "Investigation",
         "hours_target": 96, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
    ]
    await db.sla_definitions.insert_many(sla_definitions)

    # ─── Form Definitions ───────────────────────
    form_definitions = [
        {
            "_id": "form-loan-intake", "name": "Loan Intake Form", "case_type_id": "ct-loan", "stage": "intake",
            "description": "Initial loan application intake form",
            "sections": [
                {"id": "sec-applicant", "title": "Applicant Information", "order": 0},
                {"id": "sec-loan", "title": "Loan Details", "order": 1},
            ],
            "fields": [
                {"id": "f-name", "type": "text", "label": "Applicant Name", "placeholder": "Full legal name", "order": 0, "section": "sec-applicant", "validation": {"required": True, "minLength": 2, "maxLength": 100}},
                {"id": "f-email", "type": "text", "label": "Email Address", "placeholder": "applicant@example.com", "order": 1, "section": "sec-applicant", "validation": {"required": True, "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"}},
                {"id": "f-income", "type": "number", "label": "Annual Income", "placeholder": "e.g. 85000", "order": 2, "section": "sec-applicant", "validation": {"required": True, "minValue": 0}},
                {"id": "f-loan-type", "type": "select", "label": "Loan Type", "order": 0, "section": "sec-loan", "validation": {"required": True, "options": ["Mortgage", "Personal", "Commercial", "Auto"]}},
                {"id": "f-amount", "type": "number", "label": "Loan Amount", "placeholder": "Requested amount", "order": 1, "section": "sec-loan", "validation": {"required": True, "minValue": 1000, "maxValue": 10000000}},
                {"id": "f-purpose", "type": "textarea", "label": "Loan Purpose", "placeholder": "Describe the purpose of the loan", "order": 2, "section": "sec-loan", "validation": {"required": False}},
                {"id": "f-commercial-entity", "type": "text", "label": "Business Entity Name", "order": 3, "section": "sec-loan", "validation": {"required": False}, "visibleWhen": {"f-loan-type": "Commercial"}},
                {"id": "f-terms", "type": "checkbox", "label": "I agree to the terms and conditions", "order": 4, "section": "sec-loan", "validation": {"required": True}},
            ],
            "version": 1, "is_active": True, "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "form-kyc-intake", "name": "Customer Onboarding Form", "case_type_id": "ct-kyc", "stage": "intake",
            "description": "New customer KYC application form",
            "sections": [
                {"id": "sec-personal", "title": "Personal Information", "order": 0},
                {"id": "sec-account", "title": "Account Preferences", "order": 1},
                {"id": "sec-identity", "title": "Identity Documents", "order": 2},
            ],
            "fields": [
                {"id": "f-fullname", "type": "text", "label": "Full Legal Name", "placeholder": "As it appears on ID", "order": 0, "section": "sec-personal", "validation": {"required": True, "minLength": 2, "maxLength": 100}},
                {"id": "f-dob", "type": "date", "label": "Date of Birth", "order": 1, "section": "sec-personal", "validation": {"required": True}},
                {"id": "f-ssn", "type": "text", "label": "SSN / Tax ID", "placeholder": "XXX-XX-XXXX", "order": 2, "section": "sec-personal", "validation": {"required": True, "pattern": "^\\d{3}-\\d{2}-\\d{4}$"}},
                {"id": "f-address", "type": "textarea", "label": "Residential Address", "placeholder": "Full address including city, state, zip", "order": 3, "section": "sec-personal", "validation": {"required": True}},
                {"id": "f-phone", "type": "text", "label": "Phone Number", "placeholder": "(555) 123-4567", "order": 4, "section": "sec-personal", "validation": {"required": True}},
                {"id": "f-email-kyc", "type": "text", "label": "Email Address", "placeholder": "email@example.com", "order": 5, "section": "sec-personal", "validation": {"required": True, "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"}},
                {"id": "f-acct-type", "type": "select", "label": "Account Type", "order": 0, "section": "sec-account", "validation": {"required": True, "options": ["Savings", "Premium Checking", "Business Account", "Investment"]}},
                {"id": "f-currency", "type": "select", "label": "Preferred Currency", "order": 1, "section": "sec-account", "validation": {"required": True, "options": ["USD", "EUR", "GBP"]}},
                {"id": "f-entity-name", "type": "text", "label": "Business Entity Name", "order": 2, "section": "sec-account", "validation": {"required": False}, "visibleWhen": {"f-acct-type": "Business Account"}},
                {"id": "f-id-type", "type": "select", "label": "ID Document Type", "order": 0, "section": "sec-identity", "validation": {"required": True, "options": ["Passport", "Drivers License", "National ID"]}},
                {"id": "f-id-number", "type": "text", "label": "ID Document Number", "order": 1, "section": "sec-identity", "validation": {"required": True}},
                {"id": "f-kyc-consent", "type": "checkbox", "label": "I consent to identity verification and background check", "order": 2, "section": "sec-identity", "validation": {"required": True}},
            ],
            "version": 1, "is_active": True, "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "form-claims-intake", "name": "Insurance Claim Form", "case_type_id": "ct-claims", "stage": "intake",
            "description": "Initial insurance claim submission form",
            "sections": [
                {"id": "sec-claimant", "title": "Claimant Information", "order": 0},
                {"id": "sec-policy", "title": "Policy Details", "order": 1},
                {"id": "sec-incident", "title": "Incident Details", "order": 2},
            ],
            "fields": [
                {"id": "f-claimant-name", "type": "text", "label": "Claimant Name", "placeholder": "Full legal name", "order": 0, "section": "sec-claimant", "validation": {"required": True, "minLength": 2}},
                {"id": "f-claimant-phone", "type": "text", "label": "Phone Number", "placeholder": "(555) 123-4567", "order": 1, "section": "sec-claimant", "validation": {"required": True}},
                {"id": "f-claimant-email", "type": "text", "label": "Email Address", "placeholder": "email@example.com", "order": 2, "section": "sec-claimant", "validation": {"required": True, "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"}},
                {"id": "f-policy-number", "type": "text", "label": "Policy Number", "placeholder": "POL-XXXX-XXXXX", "order": 0, "section": "sec-policy", "validation": {"required": True, "pattern": "^POL-\\d{4}-\\d{5}$"}},
                {"id": "f-claim-type", "type": "select", "label": "Claim Type", "order": 1, "section": "sec-policy", "validation": {"required": True, "options": ["Auto Collision", "Property Damage", "Medical", "Liability", "Theft"]}},
                {"id": "f-claim-amount", "type": "number", "label": "Estimated Claim Amount", "placeholder": "Estimated damages in USD", "order": 2, "section": "sec-policy", "validation": {"required": True, "minValue": 0}},
                {"id": "f-incident-date", "type": "date", "label": "Date of Incident", "order": 0, "section": "sec-incident", "validation": {"required": True}},
                {"id": "f-incident-location", "type": "text", "label": "Location of Incident", "placeholder": "Address or description", "order": 1, "section": "sec-incident", "validation": {"required": True}},
                {"id": "f-incident-desc", "type": "textarea", "label": "Description of Incident", "placeholder": "Provide a detailed description of what happened", "order": 2, "section": "sec-incident", "validation": {"required": True, "minLength": 20}},
                {"id": "f-police-report", "type": "checkbox", "label": "Police report filed", "order": 3, "section": "sec-incident", "validation": {"required": False}},
                {"id": "f-claim-consent", "type": "checkbox", "label": "I certify the information provided is accurate and complete", "order": 4, "section": "sec-incident", "validation": {"required": True}},
            ],
            "version": 1, "is_active": True, "created_at": "2025-01-15T00:00:00.000Z",
        },
    ]
    await db.case_forms.insert_many(form_definitions)

    # ─── Approval Routing Rules ─────────────────
    routing_rules = [
        {"_id": "rule-high-value-loan", "name": "High Value Loan VP Approval", "case_type_id": "ct-loan",
         "conditions": [{"field": "loanAmount", "operator": "gt", "value": 100000}],
         "approver_user_ids": ["user-1", "user-admin"], "mode": "sequential", "priority": 10,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "rule-commercial", "name": "Commercial Loan Extra Approval", "case_type_id": "ct-loan",
         "conditions": [{"field": "loanType", "operator": "eq", "value": "Commercial"}, {"field": "loanAmount", "operator": "gte", "value": 250000}],
         "approver_user_ids": ["user-admin"], "mode": "sequential", "priority": 20,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "rule-high-risk-kyc", "name": "High Risk Customer Escalation", "case_type_id": "ct-kyc",
         "conditions": [{"field": "riskLevel", "operator": "eq", "value": "high"}],
         "approver_user_ids": ["user-1", "user-admin"], "mode": "sequential", "priority": 10,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "rule-high-value-claim", "name": "High Value Claim Approval", "case_type_id": "ct-claims",
         "conditions": [{"field": "claimAmount", "operator": "gt", "value": 50000}],
         "approver_user_ids": ["user-admin"], "mode": "sequential", "priority": 10,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
    ]
    await db.approval_routing_rules.insert_many(routing_rules)

    # ─── Documents (metadata only) ──────────────
    documents = [
        {"_id": "doc-1", "case_id": "LOAN-001", "task_id": None, "file_name": "w2_john_doe_2024.pdf",
         "file_type": "application/pdf", "file_size": 245760, "version": 1, "uploaded_by": "user-2",
         "tags": ["w2", "income", "verification"], "storage_path": "uploads/doc-1.pdf",
         "current": True, "created_at": "2026-02-03T10:30:00Z"},
        {"_id": "doc-2", "case_id": "LOAN-003", "task_id": None, "file_name": "acme_corp_financials_2024.pdf",
         "file_type": "application/pdf", "file_size": 1048576, "version": 1, "uploaded_by": "user-1",
         "tags": ["financials", "commercial"], "storage_path": "uploads/doc-2.pdf",
         "current": True, "created_at": "2026-01-11T14:00:00Z"},
        {"_id": "doc-3", "case_id": "KYC-001", "task_id": None, "file_name": "michael_chen_passport.jpg",
         "file_type": "image/jpeg", "file_size": 524288, "version": 1, "uploaded_by": "user-3",
         "tags": ["passport", "identity", "kyc"], "storage_path": "uploads/doc-3.jpg",
         "current": True, "created_at": "2026-03-02T09:30:00Z"},
        {"_id": "doc-4", "case_id": "CLM-001", "task_id": None, "file_name": "police_report_taylor.pdf",
         "file_type": "application/pdf", "file_size": 389120, "version": 1, "uploaded_by": "user-2",
         "tags": ["police-report", "auto", "investigation"], "storage_path": "uploads/doc-4.pdf",
         "current": True, "created_at": "2026-03-05T14:00:00Z"},
        {"_id": "doc-5", "case_id": "CLM-002", "task_id": None, "file_name": "structural_engineer_report.pdf",
         "file_type": "application/pdf", "file_size": 2097152, "version": 1, "uploaded_by": "user-3",
         "tags": ["engineer-report", "property", "structural"], "storage_path": "uploads/doc-5.pdf",
         "current": True, "created_at": "2026-02-21T10:00:00Z"},
    ]
    await db.documents.insert_many(documents)

    # ─── Decision Tables ────────────────────────
    decision_tables = [
        {
            "_id": "dt-loan-routing",
            "name": "Loan Routing Decision Table",
            "description": "Routes loan applications to the appropriate approval tier based on amount, type, and income",
            "inputs": ["loan_amount", "loan_type", "applicant_income"],
            "output_field": "approval_tier",
            "rows": [
                {"conditions": {"loan_amount": "<=10000", "loan_type": "personal"}, "output": "auto_approve", "priority": 1},
                {"conditions": {"loan_amount": "10000-100000", "applicant_income": ">=50000"}, "output": "manager", "priority": 2},
                {"conditions": {"loan_amount": "10000-100000", "applicant_income": "<50000"}, "output": "senior_manager", "priority": 3},
                {"conditions": {"loan_amount": ">100000"}, "output": "vp_approval", "priority": 4},
                {"conditions": {"loan_type": "commercial"}, "output": "commercial_review", "priority": 5},
            ],
            "default_output": "manager",
            "created_by": "user-admin",
            "created_at": "2025-06-01T00:00:00Z",
            "updated_at": "2025-06-01T00:00:00Z",
            "version": 1,
        },
        {
            "_id": "dt-risk-scoring",
            "name": "Risk Scoring Decision Table",
            "description": "Calculates risk level for KYC onboarding based on country, amount, and PEP status",
            "inputs": ["country_risk", "transaction_volume", "pep_status"],
            "output_field": "risk_level",
            "rows": [
                {"conditions": {"country_risk": "high", "pep_status": "yes"}, "output": "critical", "priority": 1},
                {"conditions": {"country_risk": "high"}, "output": "high", "priority": 2},
                {"conditions": {"transaction_volume": ">500000"}, "output": "high", "priority": 3},
                {"conditions": {"pep_status": "yes"}, "output": "medium", "priority": 4},
                {"conditions": {"country_risk": "medium"}, "output": "medium", "priority": 5},
            ],
            "default_output": "low",
            "created_by": "user-admin",
            "created_at": "2025-06-15T00:00:00Z",
            "updated_at": "2025-06-15T00:00:00Z",
            "version": 1,
        },
        {
            "_id": "dt-claims-adjuster",
            "name": "Claims Adjuster Assignment",
            "description": "Assigns claims to adjusters based on claim type and estimated amount",
            "inputs": ["claim_type", "claim_amount"],
            "output_field": "adjuster_pool",
            "rows": [
                {"conditions": {"claim_type": "auto_collision", "claim_amount": ">25000"}, "output": "senior_auto", "priority": 1},
                {"conditions": {"claim_type": "auto_collision"}, "output": "auto_pool", "priority": 2},
                {"conditions": {"claim_type": "property_damage", "claim_amount": ">50000"}, "output": "senior_property", "priority": 3},
                {"conditions": {"claim_type": "property_damage"}, "output": "property_pool", "priority": 4},
                {"conditions": {"claim_type": "medical"}, "output": "medical_pool", "priority": 5},
                {"conditions": {"claim_amount": ">100000"}, "output": "executive_review", "priority": 6},
            ],
            "default_output": "general_pool",
            "created_by": "user-admin",
            "created_at": "2025-07-01T00:00:00Z",
            "updated_at": "2025-07-01T00:00:00Z",
            "version": 1,
        },
    ]
    await db.decision_tables.insert_many(decision_tables)


if __name__ == "__main__":
    import asyncio
    from database import connect_db, close_db

    async def main():
        await connect_db()
        await force_reseed()
        await close_db()
        print("Re-seed complete — all collections rebuilt.")

    asyncio.run(main())
