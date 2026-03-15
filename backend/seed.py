"""Consolidated seed data for all collections."""

from datetime import datetime, timezone, timedelta
from database import get_db
from security import hash_password


async def force_reseed():
    """Drop all collections and re-seed from scratch."""
    db = get_db()
    collections = [
        "users", "teams", "case_types", "cases", "tasks", "comments",
        "notifications", "workflows", "approval_chains", "sla_definitions",
        "case_forms", "approval_routing_rules", "documents", "audit_logs",
        "form_submissions",
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

    # ═══════════════════════════════════════════════
    # 1) LOAN ORIGINATION
    # ═══════════════════════════════════════════════
    case_types = [
        {
            "_id": "ct-loan", "name": "Loan Origination", "slug": "loan_origination",
            "description": "End-to-end loan processing workflow", "workflowId": "wf-loan",
            "stages": ["Intake Review", "Document Collection", "Underwriting", "VP Approval", "Disbursement"],
            "transitions": [
                {"from": "Intake Review", "action": "submit", "to": "Document Collection", "roles": ["WORKER", "MANAGER"]},
                {"from": "Document Collection", "action": "verify", "to": "Underwriting", "roles": ["WORKER", "MANAGER"]},
                {"from": "Underwriting", "action": "approve", "to": "VP Approval", "roles": ["MANAGER"]},
                {"from": "Underwriting", "action": "reject", "to": "Intake Review", "roles": ["MANAGER"]},
                {"from": "VP Approval", "action": "approve", "to": "Disbursement", "roles": ["MANAGER", "ADMIN"]},
                {"from": "VP Approval", "action": "reject", "to": "Underwriting", "roles": ["MANAGER", "ADMIN"]},
            ],
            "fieldsSchema": {
                "loanAmount": {"type": "number", "label": "Loan Amount"},
                "loanType": {"type": "string", "label": "Loan Type"},
                "applicantName": {"type": "string", "label": "Applicant Name"},
                "applicantIncome": {"type": "number", "label": "Annual Income"},
            },
        },
        # ═══════════════════════════════════════════
        # 2) CUSTOMER ONBOARDING (KYC)
        # ═══════════════════════════════════════════
        {
            "_id": "ct-kyc", "name": "Customer Onboarding", "slug": "customer_onboarding",
            "description": "KYC verification and new customer account setup", "workflowId": "wf-kyc",
            "stages": ["Application Review", "Identity Verification", "Risk Assessment", "Account Setup", "Welcome"],
            "transitions": [
                {"from": "Application Review", "action": "submit", "to": "Identity Verification", "roles": ["WORKER", "MANAGER"]},
                {"from": "Identity Verification", "action": "verify", "to": "Risk Assessment", "roles": ["WORKER", "MANAGER"]},
                {"from": "Identity Verification", "action": "reject", "to": "Application Review", "roles": ["WORKER", "MANAGER"]},
                {"from": "Risk Assessment", "action": "approve", "to": "Account Setup", "roles": ["MANAGER"]},
                {"from": "Risk Assessment", "action": "escalate", "to": "Application Review", "roles": ["MANAGER"]},
                {"from": "Account Setup", "action": "complete", "to": "Welcome", "roles": ["WORKER", "MANAGER"]},
            ],
            "fieldsSchema": {
                "customerName": {"type": "string", "label": "Customer Name"},
                "accountType": {"type": "string", "label": "Account Type"},
                "riskLevel": {"type": "string", "label": "Risk Level"},
            },
        },
        # ═══════════════════════════════════════════
        # 3) INSURANCE CLAIMS
        # ═══════════════════════════════════════════
        {
            "_id": "ct-claims", "name": "Insurance Claims", "slug": "insurance_claims",
            "description": "Process and adjudicate insurance claims", "workflowId": "wf-claims",
            "stages": ["Claim Intake", "Investigation", "Adjudication", "Settlement", "Closure"],
            "transitions": [
                {"from": "Claim Intake", "action": "submit", "to": "Investigation", "roles": ["WORKER", "MANAGER"]},
                {"from": "Investigation", "action": "complete", "to": "Adjudication", "roles": ["WORKER", "MANAGER"]},
                {"from": "Investigation", "action": "deny", "to": "Closure", "roles": ["MANAGER"]},
                {"from": "Adjudication", "action": "approve", "to": "Settlement", "roles": ["MANAGER"]},
                {"from": "Adjudication", "action": "deny", "to": "Closure", "roles": ["MANAGER"]},
                {"from": "Settlement", "action": "complete", "to": "Closure", "roles": ["WORKER", "MANAGER"]},
            ],
            "fieldsSchema": {
                "claimantName": {"type": "string", "label": "Claimant Name"},
                "claimType": {"type": "string", "label": "Claim Type"},
                "claimAmount": {"type": "number", "label": "Claim Amount"},
                "policyNumber": {"type": "string", "label": "Policy Number"},
            },
        },
    ]
    await db.case_types.insert_many(case_types)

    # ─── Cases ──────────────────────────────────
    cases = [
        # --- Loan cases ---
        {
            "_id": "case-1", "type": "loan_origination", "status": "open", "stage": "Document Collection",
            "priority": "high", "ownerId": "user-1", "teamId": "team-1",
            "fields": {"loanAmount": 250000, "loanType": "Mortgage", "applicantName": "John Doe", "applicantIncome": 85000},
            "stages": [
                {"name": "Intake Review", "status": "completed", "enteredAt": "2026-02-01T10:00:00Z", "completedAt": "2026-02-02T14:00:00Z", "completedBy": "user-1"},
                {"name": "Document Collection", "status": "in_progress", "enteredAt": "2026-02-02T14:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_30, "targetResolutionDate": None, "daysRemaining": 25, "escalated": False, "escalationLevel": 0},
            "notes": "Awaiting income verification documents", "createdAt": "2026-02-01T10:00:00Z", "updatedAt": now, "createdBy": "user-1",
        },
        {
            "_id": "case-2", "type": "loan_origination", "status": "open", "stage": "Underwriting",
            "priority": "medium", "ownerId": "user-2", "teamId": "team-1",
            "fields": {"loanAmount": 50000, "loanType": "Personal", "applicantName": "Jane Smith", "applicantIncome": 62000},
            "stages": [
                {"name": "Intake Review", "status": "completed", "enteredAt": "2026-01-20T09:00:00Z", "completedAt": "2026-01-20T11:00:00Z", "completedBy": "user-2"},
                {"name": "Document Collection", "status": "completed", "enteredAt": "2026-01-20T11:00:00Z", "completedAt": "2026-01-22T16:00:00Z", "completedBy": "user-2"},
                {"name": "Underwriting", "status": "in_progress", "enteredAt": "2026-01-22T16:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_30, "targetResolutionDate": None, "daysRemaining": 18, "escalated": False, "escalationLevel": 0},
            "notes": None, "createdAt": "2026-01-20T09:00:00Z", "updatedAt": now, "createdBy": "user-2",
        },
        {
            "_id": "case-3", "type": "loan_origination", "status": "pending", "stage": "VP Approval",
            "priority": "critical", "ownerId": "user-1", "teamId": "team-1",
            "fields": {"loanAmount": 500000, "loanType": "Commercial", "applicantName": "Acme Corp", "applicantIncome": 2000000},
            "stages": [
                {"name": "Intake Review", "status": "completed", "enteredAt": "2026-01-10T08:00:00Z", "completedAt": "2026-01-10T10:00:00Z", "completedBy": "user-1"},
                {"name": "Document Collection", "status": "completed", "enteredAt": "2026-01-10T10:00:00Z", "completedAt": "2026-01-12T14:00:00Z", "completedBy": "user-2"},
                {"name": "Underwriting", "status": "completed", "enteredAt": "2026-01-12T14:00:00Z", "completedAt": "2026-01-15T09:00:00Z", "completedBy": "user-1"},
                {"name": "VP Approval", "status": "in_progress", "enteredAt": "2026-01-15T09:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_30, "targetResolutionDate": None, "daysRemaining": 5, "escalated": True, "escalationLevel": 1},
            "notes": "Escalated — high-value commercial loan awaiting VP approval",
            "createdAt": "2026-01-10T08:00:00Z", "updatedAt": now, "createdBy": "user-1",
        },
        # --- KYC cases ---
        {
            "_id": "case-4", "type": "customer_onboarding", "status": "open", "stage": "Identity Verification",
            "priority": "high", "ownerId": "user-3", "teamId": "team-2",
            "fields": {"customerName": "Michael Chen", "accountType": "Premium Checking", "riskLevel": "medium"},
            "stages": [
                {"name": "Application Review", "status": "completed", "enteredAt": "2026-03-01T09:00:00Z", "completedAt": "2026-03-01T11:00:00Z", "completedBy": "user-3"},
                {"name": "Identity Verification", "status": "in_progress", "enteredAt": "2026-03-01T11:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_20, "targetResolutionDate": None, "daysRemaining": 15, "escalated": False, "escalationLevel": 0},
            "notes": "Awaiting government ID scan", "createdAt": "2026-03-01T09:00:00Z", "updatedAt": now, "createdBy": "user-3",
        },
        {
            "_id": "case-5", "type": "customer_onboarding", "status": "open", "stage": "Risk Assessment",
            "priority": "critical", "ownerId": "user-1", "teamId": "team-2",
            "fields": {"customerName": "Global Trading LLC", "accountType": "Business Account", "riskLevel": "high"},
            "stages": [
                {"name": "Application Review", "status": "completed", "enteredAt": "2026-02-20T08:00:00Z", "completedAt": "2026-02-20T10:00:00Z", "completedBy": "user-1"},
                {"name": "Identity Verification", "status": "completed", "enteredAt": "2026-02-20T10:00:00Z", "completedAt": "2026-02-22T16:00:00Z", "completedBy": "user-3"},
                {"name": "Risk Assessment", "status": "in_progress", "enteredAt": "2026-02-22T16:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_15, "targetResolutionDate": None, "daysRemaining": 8, "escalated": True, "escalationLevel": 1},
            "notes": "High-risk corporate entity — enhanced due diligence required",
            "createdAt": "2026-02-20T08:00:00Z", "updatedAt": now, "createdBy": "user-1",
        },
        {
            "_id": "case-6", "type": "customer_onboarding", "status": "open", "stage": "Account Setup",
            "priority": "low", "ownerId": "user-3", "teamId": "team-2",
            "fields": {"customerName": "Sarah Williams", "accountType": "Savings", "riskLevel": "low"},
            "stages": [
                {"name": "Application Review", "status": "completed", "enteredAt": "2026-02-10T09:00:00Z", "completedAt": "2026-02-10T10:00:00Z", "completedBy": "user-3"},
                {"name": "Identity Verification", "status": "completed", "enteredAt": "2026-02-10T10:00:00Z", "completedAt": "2026-02-11T09:00:00Z", "completedBy": "user-3"},
                {"name": "Risk Assessment", "status": "completed", "enteredAt": "2026-02-11T09:00:00Z", "completedAt": "2026-02-11T14:00:00Z", "completedBy": "user-1"},
                {"name": "Account Setup", "status": "in_progress", "enteredAt": "2026-02-11T14:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_20, "targetResolutionDate": None, "daysRemaining": 12, "escalated": False, "escalationLevel": 0},
            "notes": None, "createdAt": "2026-02-10T09:00:00Z", "updatedAt": now, "createdBy": "user-3",
        },
        # --- Insurance Claims cases ---
        {
            "_id": "case-7", "type": "insurance_claims", "status": "open", "stage": "Investigation",
            "priority": "high", "ownerId": "user-2", "teamId": "team-3",
            "fields": {"claimantName": "Robert Taylor", "claimType": "Auto Collision", "claimAmount": 18500, "policyNumber": "POL-2025-44821"},
            "stages": [
                {"name": "Claim Intake", "status": "completed", "enteredAt": "2026-03-05T10:00:00Z", "completedAt": "2026-03-05T11:30:00Z", "completedBy": "user-2"},
                {"name": "Investigation", "status": "in_progress", "enteredAt": "2026-03-05T11:30:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_20, "targetResolutionDate": None, "daysRemaining": 14, "escalated": False, "escalationLevel": 0},
            "notes": "Police report obtained, awaiting repair estimate",
            "createdAt": "2026-03-05T10:00:00Z", "updatedAt": now, "createdBy": "user-2",
        },
        {
            "_id": "case-8", "type": "insurance_claims", "status": "pending", "stage": "Adjudication",
            "priority": "critical", "ownerId": "user-3", "teamId": "team-3",
            "fields": {"claimantName": "Maria Garcia", "claimType": "Property Damage", "claimAmount": 125000, "policyNumber": "POL-2024-31056"},
            "stages": [
                {"name": "Claim Intake", "status": "completed", "enteredAt": "2026-02-15T08:00:00Z", "completedAt": "2026-02-15T10:00:00Z", "completedBy": "user-3"},
                {"name": "Investigation", "status": "completed", "enteredAt": "2026-02-15T10:00:00Z", "completedAt": "2026-02-20T16:00:00Z", "completedBy": "user-2"},
                {"name": "Adjudication", "status": "in_progress", "enteredAt": "2026-02-20T16:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_15, "targetResolutionDate": None, "daysRemaining": 4, "escalated": True, "escalationLevel": 1},
            "notes": "High-value property claim — structural engineer report attached",
            "createdAt": "2026-02-15T08:00:00Z", "updatedAt": now, "createdBy": "user-3",
        },
        {
            "_id": "case-9", "type": "insurance_claims", "status": "open", "stage": "Settlement",
            "priority": "medium", "ownerId": "user-2", "teamId": "team-3",
            "fields": {"claimantName": "David Kim", "claimType": "Medical", "claimAmount": 8200, "policyNumber": "POL-2025-17893"},
            "stages": [
                {"name": "Claim Intake", "status": "completed", "enteredAt": "2026-01-28T09:00:00Z", "completedAt": "2026-01-28T10:00:00Z", "completedBy": "user-2"},
                {"name": "Investigation", "status": "completed", "enteredAt": "2026-01-28T10:00:00Z", "completedAt": "2026-02-01T14:00:00Z", "completedBy": "user-3"},
                {"name": "Adjudication", "status": "completed", "enteredAt": "2026-02-01T14:00:00Z", "completedAt": "2026-02-05T09:00:00Z", "completedBy": "user-admin"},
                {"name": "Settlement", "status": "in_progress", "enteredAt": "2026-02-05T09:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_20, "targetResolutionDate": None, "daysRemaining": 10, "escalated": False, "escalationLevel": 0},
            "notes": "Approved for settlement — awaiting claimant bank details",
            "createdAt": "2026-01-28T09:00:00Z", "updatedAt": now, "createdBy": "user-2",
        },
    ]
    await db.cases.insert_many(cases)

    # ─── Tasks ──────────────────────────────────
    tasks = [
        # Loan tasks
        {"_id": "task-1", "caseId": "case-1", "title": "Collect income verification",
         "description": "Request and verify applicant income documents (W-2, pay stubs)",
         "assigneeId": "user-2", "teamId": "team-1", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["documents", "verification"],
         "checklist": [
             {"id": "cl-1", "item": "Request W-2 forms", "checked": True, "completedAt": "2026-02-03T10:00:00Z"},
             {"id": "cl-2", "item": "Request pay stubs (3 months)", "checked": True, "completedAt": "2026-02-03T10:00:00Z"},
             {"id": "cl-3", "item": "Verify income matches application", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-02T14:00:00Z", "updatedAt": "2026-02-05T09:00:00Z", "completedAt": None},
        {"_id": "task-2", "caseId": "case-1", "title": "Property appraisal",
         "description": "Order and review property appraisal report",
         "assigneeId": "user-1", "teamId": "team-1", "status": "pending", "priority": "medium",
         "dueDate": "2026-03-25T00:00:00Z", "dependsOn": ["task-1"], "tags": ["appraisal"],
         "checklist": [
             {"id": "cl-4", "item": "Order appraisal", "checked": False, "completedAt": None},
             {"id": "cl-5", "item": "Review appraisal report", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-02T14:00:00Z", "updatedAt": "2026-02-02T14:00:00Z", "completedAt": None},
        {"_id": "task-3", "caseId": "case-2", "title": "Credit check review",
         "description": "Review applicant credit report and score",
         "assigneeId": "user-2", "teamId": "team-1", "status": "completed", "priority": "high",
         "dueDate": "2026-02-01T00:00:00Z", "dependsOn": [], "tags": ["credit", "underwriting"],
         "checklist": [
             {"id": "cl-6", "item": "Pull credit report", "checked": True, "completedAt": "2026-01-21T11:00:00Z"},
             {"id": "cl-7", "item": "Verify score meets threshold", "checked": True, "completedAt": "2026-01-22T09:00:00Z"},
         ],
         "createdAt": "2026-01-20T11:00:00Z", "updatedAt": "2026-01-22T09:00:00Z", "completedAt": "2026-01-22T09:00:00Z"},
        {"_id": "task-4", "caseId": "case-3", "title": "Final approval review",
         "description": "VP review and sign-off for commercial loan",
         "assigneeId": "user-1", "teamId": "team-1", "status": "blocked", "priority": "critical",
         "dueDate": "2026-02-01T00:00:00Z", "dependsOn": [], "tags": ["approval", "commercial"],
         "checklist": [
             {"id": "cl-8", "item": "Prepare approval packet", "checked": True, "completedAt": "2026-01-16T10:00:00Z"},
             {"id": "cl-9", "item": "Schedule VP review meeting", "checked": False, "completedAt": None},
             {"id": "cl-10", "item": "Obtain VP signature", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-01-15T09:00:00Z", "updatedAt": "2026-01-18T14:00:00Z", "completedAt": None},
        {"_id": "task-5", "caseId": "case-2", "title": "Risk assessment",
         "description": "Complete risk assessment for personal loan underwriting",
         "assigneeId": "user-2", "teamId": "team-1", "status": "in_progress", "priority": "medium",
         "dueDate": "2026-03-10T00:00:00Z", "dependsOn": ["task-3"], "tags": ["underwriting", "risk"],
         "checklist": [
             {"id": "cl-11", "item": "Calculate debt-to-income ratio", "checked": True, "completedAt": "2026-01-23T10:00:00Z"},
             {"id": "cl-12", "item": "Assess collateral value", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-01-22T16:00:00Z", "updatedAt": "2026-01-25T11:00:00Z", "completedAt": None},
        # KYC tasks
        {"_id": "task-6", "caseId": "case-4", "title": "Verify government ID",
         "description": "Scan and validate government-issued photo ID",
         "assigneeId": "user-3", "teamId": "team-2", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-18T00:00:00Z", "dependsOn": [], "tags": ["kyc", "identity"],
         "checklist": [
             {"id": "cl-13", "item": "Scan passport or drivers license", "checked": True, "completedAt": "2026-03-02T09:00:00Z"},
             {"id": "cl-14", "item": "Run facial recognition match", "checked": False, "completedAt": None},
             {"id": "cl-15", "item": "Verify document authenticity", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-03-01T11:00:00Z", "updatedAt": "2026-03-02T09:00:00Z", "completedAt": None},
        {"_id": "task-7", "caseId": "case-5", "title": "Enhanced due diligence",
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
        {"_id": "task-8", "caseId": "case-6", "title": "Configure account",
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
        {"_id": "task-9", "caseId": "case-7", "title": "Obtain repair estimate",
         "description": "Get certified repair estimate from approved body shop",
         "assigneeId": "user-2", "teamId": "team-3", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["investigation", "auto"],
         "checklist": [
             {"id": "cl-23", "item": "Contact approved body shop", "checked": True, "completedAt": "2026-03-06T09:00:00Z"},
             {"id": "cl-24", "item": "Schedule vehicle inspection", "checked": True, "completedAt": "2026-03-06T14:00:00Z"},
             {"id": "cl-25", "item": "Collect written estimate", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-03-05T11:30:00Z", "updatedAt": "2026-03-06T14:00:00Z", "completedAt": None},
        {"_id": "task-10", "caseId": "case-8", "title": "Review structural engineer report",
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
        {"_id": "task-11", "caseId": "case-9", "title": "Process settlement payment",
         "description": "Issue settlement payment to claimant bank account",
         "assigneeId": "user-2", "teamId": "team-3", "status": "pending", "priority": "medium",
         "dueDate": "2026-03-15T00:00:00Z", "dependsOn": [], "tags": ["settlement", "payment"],
         "checklist": [
             {"id": "cl-30", "item": "Verify claimant bank details", "checked": False, "completedAt": None},
             {"id": "cl-31", "item": "Initiate wire transfer", "checked": False, "completedAt": None},
             {"id": "cl-32", "item": "Send payment confirmation", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-05T09:00:00Z", "updatedAt": "2026-02-05T09:00:00Z", "completedAt": None},
        {"_id": "task-12", "caseId": "case-7", "title": "Review police report",
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
        {"_id": "comment-1", "caseId": "case-1", "taskId": None, "userId": "user-1", "userName": "Alice Johnson",
         "userAvatar": None, "text": "Requested income verification from applicant.", "mentions": [],
         "createdAt": "2026-02-02T14:30:00Z", "updatedAt": "2026-02-02T14:30:00Z"},
        {"_id": "comment-2", "caseId": "case-3", "taskId": None, "userId": "user-2", "userName": "Bob Smith",
         "userAvatar": None, "text": "Underwriting completed. @Alice please review for approval.",
         "mentions": [{"id": "user-1", "name": "Alice Johnson"}],
         "createdAt": "2026-01-15T09:15:00Z", "updatedAt": "2026-01-15T09:15:00Z"},
        {"_id": "comment-3", "caseId": "case-5", "taskId": None, "userId": "user-1", "userName": "Alice Johnson",
         "userAvatar": None, "text": "Enhanced due diligence required for this corporate entity. @Carol please run sanctions screening.",
         "mentions": [{"id": "user-3", "name": "Carol Davis"}],
         "createdAt": "2026-02-22T17:00:00Z", "updatedAt": "2026-02-22T17:00:00Z"},
        {"_id": "comment-4", "caseId": "case-8", "taskId": None, "userId": "user-3", "userName": "Carol Davis",
         "userAvatar": None, "text": "Structural engineer report received. Damage is extensive — recommending full coverage payout.",
         "mentions": [], "createdAt": "2026-02-21T10:30:00Z", "updatedAt": "2026-02-21T10:30:00Z"},
        {"_id": "comment-5", "caseId": "case-9", "taskId": None, "userId": "user-2", "userName": "Bob Smith",
         "userAvatar": None, "text": "Claim approved. Waiting for claimant to provide bank details for settlement.",
         "mentions": [], "createdAt": "2026-02-05T09:30:00Z", "updatedAt": "2026-02-05T09:30:00Z"},
    ]
    await db.comments.insert_many(comments)

    # ─── Notifications ──────────────────────────
    notifications = [
        {"_id": "notif-1", "userId": "user-1", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #case-1 (Loan - John Doe)", "entityType": "case", "entityId": "case-1",
         "isRead": True, "readAt": "2026-02-01T10:30:00Z", "createdAt": "2026-02-01T10:00:00Z"},
        {"_id": "notif-2", "userId": "user-1", "type": "sla_warning", "title": "SLA Warning - Case #case-3",
         "message": "Case #case-3 (Acme Corp) has only 5 days remaining before SLA breach",
         "entityType": "case", "entityId": "case-3", "isRead": False, "readAt": None, "createdAt": "2026-03-05T08:00:00Z"},
        {"_id": "notif-3", "userId": "user-1", "type": "mention", "title": "You were mentioned",
         "message": "Bob Smith mentioned you in a comment on case #case-3",
         "entityType": "case", "entityId": "case-3", "isRead": False, "readAt": None, "createdAt": "2026-01-15T09:15:00Z"},
        {"_id": "notif-4", "userId": "user-3", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #case-4 (KYC - Michael Chen)",
         "entityType": "case", "entityId": "case-4", "isRead": True, "readAt": "2026-03-01T09:30:00Z", "createdAt": "2026-03-01T09:00:00Z"},
        {"_id": "notif-5", "userId": "user-3", "type": "mention", "title": "You were mentioned",
         "message": "Alice Johnson mentioned you in a comment on case #case-5",
         "entityType": "case", "entityId": "case-5", "isRead": False, "readAt": None, "createdAt": "2026-02-22T17:00:00Z"},
        {"_id": "notif-6", "userId": "user-2", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #case-7 (Claims - Robert Taylor)",
         "entityType": "case", "entityId": "case-7", "isRead": True, "readAt": "2026-03-05T10:30:00Z", "createdAt": "2026-03-05T10:00:00Z"},
        {"_id": "notif-7", "userId": "user-3", "type": "sla_warning", "title": "SLA Warning - Case #case-8",
         "message": "Case #case-8 (Maria Garcia property claim) has only 4 days remaining",
         "entityType": "case", "entityId": "case-8", "isRead": False, "readAt": None, "createdAt": "2026-03-10T08:00:00Z"},
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
        {"_id": "approval-1", "case_id": "case-3", "workflow_id": "wf-loan", "mode": "sequential",
         "approvers": [
             {"user_id": "user-1", "sequence": 0, "status": "approved", "decision_at": "2026-01-16T10:00:00Z", "decision_notes": "Financials look strong"},
             {"user_id": "user-admin", "sequence": 1, "status": "pending", "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_at": "2026-01-15T09:30:00Z", "completed_at": None},
        {"_id": "approval-2", "case_id": "case-8", "workflow_id": "wf-claims", "mode": "sequential",
         "approvers": [
             {"user_id": "user-3", "sequence": 0, "status": "approved", "decision_at": "2026-02-21T15:00:00Z", "decision_notes": "Engineer report confirms structural damage"},
             {"user_id": "user-admin", "sequence": 1, "status": "pending", "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_at": "2026-02-20T16:30:00Z", "completed_at": None},
    ]
    await db.approval_chains.insert_many(approval_chains)

    # ─── SLA Definitions ────────────────────────
    sla_definitions = [
        {"_id": "sla-loan-intake", "case_type_id": "ct-loan", "stage": "Intake Review", "hours_target": 24,
         "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-loan-docs", "case_type_id": "ct-loan", "stage": "Document Collection", "hours_target": 72,
         "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-loan-uw", "case_type_id": "ct-loan", "stage": "Underwriting", "hours_target": 120,
         "escalation_enabled": True, "escalate_to_role": "ADMIN", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-kyc-app", "case_type_id": "ct-kyc", "stage": "Application Review", "hours_target": 12,
         "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-kyc-id", "case_type_id": "ct-kyc", "stage": "Identity Verification", "hours_target": 48,
         "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-claims-intake", "case_type_id": "ct-claims", "stage": "Claim Intake", "hours_target": 8,
         "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-claims-investigate", "case_type_id": "ct-claims", "stage": "Investigation", "hours_target": 96,
         "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
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
        {"_id": "doc-1", "case_id": "case-1", "task_id": None, "file_name": "w2_john_doe_2024.pdf",
         "file_type": "application/pdf", "file_size": 245760, "version": 1, "uploaded_by": "user-2",
         "tags": ["w2", "income", "verification"], "storage_path": "uploads/doc-1.pdf",
         "current": True, "created_at": "2026-02-03T10:30:00Z"},
        {"_id": "doc-2", "case_id": "case-3", "task_id": None, "file_name": "acme_corp_financials_2024.pdf",
         "file_type": "application/pdf", "file_size": 1048576, "version": 1, "uploaded_by": "user-1",
         "tags": ["financials", "commercial"], "storage_path": "uploads/doc-2.pdf",
         "current": True, "created_at": "2026-01-11T14:00:00Z"},
        {"_id": "doc-3", "case_id": "case-4", "task_id": None, "file_name": "michael_chen_passport.jpg",
         "file_type": "image/jpeg", "file_size": 524288, "version": 1, "uploaded_by": "user-3",
         "tags": ["passport", "identity", "kyc"], "storage_path": "uploads/doc-3.jpg",
         "current": True, "created_at": "2026-03-02T09:30:00Z"},
        {"_id": "doc-4", "case_id": "case-7", "task_id": None, "file_name": "police_report_taylor.pdf",
         "file_type": "application/pdf", "file_size": 389120, "version": 1, "uploaded_by": "user-2",
         "tags": ["police-report", "auto", "investigation"], "storage_path": "uploads/doc-4.pdf",
         "current": True, "created_at": "2026-03-05T14:00:00Z"},
        {"_id": "doc-5", "case_id": "case-8", "task_id": None, "file_name": "structural_engineer_report.pdf",
         "file_type": "application/pdf", "file_size": 2097152, "version": 1, "uploaded_by": "user-3",
         "tags": ["engineer-report", "property", "structural"], "storage_path": "uploads/doc-5.pdf",
         "current": True, "created_at": "2026-02-21T10:00:00Z"},
    ]
    await db.documents.insert_many(documents)


if __name__ == "__main__":
    import asyncio
    from database import connect_db, close_db

    async def main():
        await connect_db()
        await force_reseed()
        await close_db()
        print("Re-seed complete — all collections rebuilt.")

    asyncio.run(main())
