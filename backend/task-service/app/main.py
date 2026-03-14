from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from shared.config import get_settings
from shared.database import connect_db, close_db
from app.routes.tasks import router as tasks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await _seed_default_data()
    yield
    await close_db()


app = FastAPI(
    title="Workflow Task Service",
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

app.include_router(tasks_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "task"}


async def _seed_default_data():
    """Seed sample tasks if the database is empty."""
    from shared.database import get_db

    db = get_db()
    count = await db.tasks.count_documents({})
    if count > 0:
        return

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
