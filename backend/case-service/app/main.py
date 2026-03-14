from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from shared.config import get_settings
from shared.database import connect_db, close_db
from app.routes.cases import router as cases_router
from app.routes.comments import router as comments_router
from app.routes.audit_logs import router as audit_logs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await _seed_default_data()
    yield
    await close_db()


app = FastAPI(
    title="Workflow Case Service",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases_router)
app.include_router(comments_router)
app.include_router(audit_logs_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "case"}


async def _seed_default_data():
    """Seed case types and sample cases if the database is empty."""
    from shared.database import get_db
    from datetime import datetime, timezone, timedelta

    db = get_db()
    count = await db.case_types.count_documents({})
    if count > 0:
        return

    now = datetime.now(timezone.utc).isoformat()
    sla_target = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

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
