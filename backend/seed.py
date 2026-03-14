"""Consolidated seed data for all collections."""

from datetime import datetime, timezone, timedelta
from database import get_db
from security import hash_password


async def seed_all():
    """Seed all collections if the database is empty."""
    db = get_db()

    # Only seed if users collection is empty (first run)
    count = await db.users.count_documents({})
    if count > 0:
        return

    now = datetime.now(timezone.utc).isoformat()
    sla_target = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    # ─── Users ──────────────────────────────────
    users = [
        {
            "_id": "user-1",
            "email": "alice@example.com",
            "name": "Alice Johnson",
            "role": "MANAGER",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("demo123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-01-01T00:00:00.000Z",
        },
        {
            "_id": "user-2",
            "email": "bob@example.com",
            "name": "Bob Smith",
            "role": "WORKER",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("demo123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-02-15T00:00:00.000Z",
        },
        {
            "_id": "user-3",
            "email": "carol@example.com",
            "name": "Carol Davis",
            "role": "WORKER",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("demo123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-03-10T00:00:00.000Z",
        },
        {
            "_id": "user-admin",
            "email": "admin@example.com",
            "name": "Admin User",
            "role": "ADMIN",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("admin123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-01-01T00:00:00.000Z",
        },
    ]
    await db.users.insert_many(users)

    # ─── Teams ──────────────────────────────────
    teams = [
        {
            "_id": "team-1",
            "name": "Loan Processing",
            "description": "Handles all loan origination cases",
            "member_ids": ["user-1", "user-2", "user-3", "user-admin"],
            "created_at": "2025-01-01T00:00:00.000Z",
        },
    ]
    await db.teams.insert_many(teams)

    # ─── Case Types ────────────────────────────
    case_types = [
        {
            "_id": "ct-loan",
            "name": "Loan Origination",
            "description": "End-to-end loan processing workflow",
            "stages": ["intake", "documents", "underwriting", "approval", "disbursement"],
            "fieldsSchema": {
                "loanAmount": {"type": "number", "label": "Loan Amount"},
                "loanType": {"type": "string", "label": "Loan Type"},
                "applicantName": {"type": "string", "label": "Applicant Name"},
                "applicantIncome": {"type": "number", "label": "Annual Income"},
            },
        },
    ]
    await db.case_types.insert_many(case_types)

    # ─── Cases ──────────────────────────────────
    cases = [
        {
            "_id": "case-1",
            "type": "loan_origination",
            "status": "open",
            "stage": "documents",
            "priority": "high",
            "ownerId": "user-1",
            "teamId": "team-1",
            "fields": {
                "loanAmount": 250000,
                "loanType": "Mortgage",
                "applicantName": "John Doe",
                "applicantIncome": 85000,
            },
            "stages": [
                {"name": "intake", "status": "completed", "enteredAt": "2025-06-01T10:00:00Z", "completedAt": "2025-06-02T14:00:00Z", "completedBy": "user-1"},
                {"name": "documents", "status": "in_progress", "enteredAt": "2025-06-02T14:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_target, "targetResolutionDate": None, "daysRemaining": 25, "escalated": False, "escalationLevel": 0},
            "notes": "Awaiting income verification documents",
            "createdAt": "2025-06-01T10:00:00Z",
            "updatedAt": now,
            "createdBy": "user-1",
        },
        {
            "_id": "case-2",
            "type": "loan_origination",
            "status": "open",
            "stage": "underwriting",
            "priority": "medium",
            "ownerId": "user-2",
            "teamId": "team-1",
            "fields": {
                "loanAmount": 50000,
                "loanType": "Personal",
                "applicantName": "Jane Smith",
                "applicantIncome": 62000,
            },
            "stages": [
                {"name": "intake", "status": "completed", "enteredAt": "2025-05-20T09:00:00Z", "completedAt": "2025-05-20T11:00:00Z", "completedBy": "user-2"},
                {"name": "documents", "status": "completed", "enteredAt": "2025-05-20T11:00:00Z", "completedAt": "2025-05-22T16:00:00Z", "completedBy": "user-2"},
                {"name": "underwriting", "status": "in_progress", "enteredAt": "2025-05-22T16:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_target, "targetResolutionDate": None, "daysRemaining": 18, "escalated": False, "escalationLevel": 0},
            "notes": None,
            "createdAt": "2025-05-20T09:00:00Z",
            "updatedAt": now,
            "createdBy": "user-2",
        },
        {
            "_id": "case-3",
            "type": "loan_origination",
            "status": "pending",
            "stage": "approval",
            "priority": "critical",
            "ownerId": "user-1",
            "teamId": "team-1",
            "fields": {
                "loanAmount": 500000,
                "loanType": "Commercial",
                "applicantName": "Acme Corp",
                "applicantIncome": 2000000,
            },
            "stages": [
                {"name": "intake", "status": "completed", "enteredAt": "2025-05-10T08:00:00Z", "completedAt": "2025-05-10T10:00:00Z", "completedBy": "user-1"},
                {"name": "documents", "status": "completed", "enteredAt": "2025-05-10T10:00:00Z", "completedAt": "2025-05-12T14:00:00Z", "completedBy": "user-2"},
                {"name": "underwriting", "status": "completed", "enteredAt": "2025-05-12T14:00:00Z", "completedAt": "2025-05-15T09:00:00Z", "completedBy": "user-1"},
                {"name": "approval", "status": "in_progress", "enteredAt": "2025-05-15T09:00:00Z", "completedAt": None, "completedBy": None},
            ],
            "sla": {"targetDate": sla_target, "targetResolutionDate": None, "daysRemaining": 5, "escalated": True, "escalationLevel": 1},
            "notes": "Escalated — high-value commercial loan awaiting VP approval",
            "createdAt": "2025-05-10T08:00:00Z",
            "updatedAt": now,
            "createdBy": "user-1",
        },
    ]
    await db.cases.insert_many(cases)

    # ─── Tasks ──────────────────────────────────
    tasks = [
        {
            "_id": "task-1",
            "caseId": "case-1",
            "title": "Collect income verification",
            "description": "Request and verify applicant income documents (W-2, pay stubs)",
            "assigneeId": "user-2",
            "teamId": "team-1",
            "status": "in_progress",
            "priority": "high",
            "dueDate": "2025-06-15T00:00:00Z",
            "dependsOn": [],
            "tags": ["documents", "verification"],
            "checklist": [
                {"id": "cl-1", "item": "Request W-2 forms", "checked": True, "completedAt": "2025-06-03T10:00:00Z"},
                {"id": "cl-2", "item": "Request pay stubs (3 months)", "checked": True, "completedAt": "2025-06-03T10:00:00Z"},
                {"id": "cl-3", "item": "Verify income matches application", "checked": False, "completedAt": None},
            ],
            "createdAt": "2025-06-02T14:00:00Z",
            "updatedAt": "2025-06-05T09:00:00Z",
            "completedAt": None,
        },
        {
            "_id": "task-2",
            "caseId": "case-1",
            "title": "Property appraisal",
            "description": "Order and review property appraisal report",
            "assigneeId": "user-1",
            "teamId": "team-1",
            "status": "pending",
            "priority": "medium",
            "dueDate": "2025-06-20T00:00:00Z",
            "dependsOn": ["task-1"],
            "tags": ["appraisal"],
            "checklist": [
                {"id": "cl-4", "item": "Order appraisal", "checked": False, "completedAt": None},
                {"id": "cl-5", "item": "Review appraisal report", "checked": False, "completedAt": None},
            ],
            "createdAt": "2025-06-02T14:00:00Z",
            "updatedAt": "2025-06-02T14:00:00Z",
            "completedAt": None,
        },
        {
            "_id": "task-3",
            "caseId": "case-2",
            "title": "Credit check review",
            "description": "Review applicant credit report and score",
            "assigneeId": "user-2",
            "teamId": "team-1",
            "status": "completed",
            "priority": "high",
            "dueDate": "2025-05-25T00:00:00Z",
            "dependsOn": [],
            "tags": ["credit", "underwriting"],
            "checklist": [
                {"id": "cl-6", "item": "Pull credit report", "checked": True, "completedAt": "2025-05-21T11:00:00Z"},
                {"id": "cl-7", "item": "Verify score meets threshold", "checked": True, "completedAt": "2025-05-22T09:00:00Z"},
            ],
            "createdAt": "2025-05-20T11:00:00Z",
            "updatedAt": "2025-05-22T09:00:00Z",
            "completedAt": "2025-05-22T09:00:00Z",
        },
        {
            "_id": "task-4",
            "caseId": "case-3",
            "title": "Final approval review",
            "description": "VP review and sign-off for commercial loan",
            "assigneeId": "user-1",
            "teamId": "team-1",
            "status": "blocked",
            "priority": "critical",
            "dueDate": "2025-05-20T00:00:00Z",
            "dependsOn": [],
            "tags": ["approval", "commercial"],
            "checklist": [
                {"id": "cl-8", "item": "Prepare approval packet", "checked": True, "completedAt": "2025-05-16T10:00:00Z"},
                {"id": "cl-9", "item": "Schedule VP review meeting", "checked": False, "completedAt": None},
                {"id": "cl-10", "item": "Obtain VP signature", "checked": False, "completedAt": None},
            ],
            "createdAt": "2025-05-15T09:00:00Z",
            "updatedAt": "2025-05-18T14:00:00Z",
            "completedAt": None,
        },
        {
            "_id": "task-5",
            "caseId": "case-2",
            "title": "Risk assessment",
            "description": "Complete risk assessment for personal loan underwriting",
            "assigneeId": "user-3",
            "teamId": "team-1",
            "status": "in_progress",
            "priority": "medium",
            "dueDate": "2025-06-10T00:00:00Z",
            "dependsOn": ["task-3"],
            "tags": ["underwriting", "risk"],
            "checklist": [
                {"id": "cl-11", "item": "Calculate debt-to-income ratio", "checked": True, "completedAt": "2025-05-23T10:00:00Z"},
                {"id": "cl-12", "item": "Assess collateral value", "checked": False, "completedAt": None},
            ],
            "createdAt": "2025-05-22T16:00:00Z",
            "updatedAt": "2025-05-25T11:00:00Z",
            "completedAt": None,
        },
    ]
    await db.tasks.insert_many(tasks)

    # ─── Comments ───────────────────────────────
    comments = [
        {
            "_id": "comment-1",
            "caseId": "case-1",
            "taskId": None,
            "userId": "user-1",
            "userName": "Alice Johnson",
            "userAvatar": None,
            "text": "Requested income verification from applicant.",
            "mentions": [],
            "createdAt": "2025-06-02T14:30:00Z",
            "updatedAt": "2025-06-02T14:30:00Z",
        },
        {
            "_id": "comment-2",
            "caseId": "case-3",
            "taskId": None,
            "userId": "user-2",
            "userName": "Bob Smith",
            "userAvatar": None,
            "text": "Underwriting completed. @Alice please review for approval.",
            "mentions": [{"id": "user-1", "name": "Alice Johnson"}],
            "createdAt": "2025-05-15T09:15:00Z",
            "updatedAt": "2025-05-15T09:15:00Z",
        },
    ]
    await db.comments.insert_many(comments)

    # ─── Notifications ──────────────────────────
    notifications = [
        {
            "_id": "notif-1",
            "userId": "user-1",
            "type": "assignment",
            "title": "New Case Assigned",
            "message": "You have been assigned case #case-1 (Loan Origination - John Doe)",
            "entityType": "case",
            "entityId": "case-1",
            "isRead": True,
            "readAt": "2025-06-01T10:30:00Z",
            "createdAt": "2025-06-01T10:00:00Z",
        },
        {
            "_id": "notif-2",
            "userId": "user-1",
            "type": "sla_warning",
            "title": "SLA Warning - Case #case-3",
            "message": "Case #case-3 (Acme Corp) has only 5 days remaining before SLA breach",
            "entityType": "case",
            "entityId": "case-3",
            "isRead": False,
            "readAt": None,
            "createdAt": "2025-06-05T08:00:00Z",
        },
        {
            "_id": "notif-3",
            "userId": "user-1",
            "type": "mention",
            "title": "You were mentioned",
            "message": "Bob Smith mentioned you in a comment on case #case-3",
            "entityType": "case",
            "entityId": "case-3",
            "isRead": False,
            "readAt": None,
            "createdAt": "2025-05-15T09:15:00Z",
        },
        {
            "_id": "notif-4",
            "userId": "user-2",
            "type": "assignment",
            "title": "New Task Assigned",
            "message": "You have been assigned task: Collect income verification",
            "entityType": "task",
            "entityId": "task-1",
            "isRead": True,
            "readAt": "2025-06-02T15:00:00Z",
            "createdAt": "2025-06-02T14:00:00Z",
        },
        {
            "_id": "notif-5",
            "userId": "user-3",
            "type": "status_change",
            "title": "Task Status Changed",
            "message": "Task 'Credit check review' was marked as completed",
            "entityType": "task",
            "entityId": "task-3",
            "isRead": False,
            "readAt": None,
            "createdAt": "2025-05-22T09:00:00Z",
        },
    ]
    await db.notifications.insert_many(notifications)
