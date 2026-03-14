from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from shared.config import get_settings
from shared.database import connect_db, close_db
from app.routes.notifications import router as notifications_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await _seed_default_data()
    yield
    await close_db()


app = FastAPI(
    title="Workflow Notification Service",
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

app.include_router(notifications_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "notify"}


async def _seed_default_data():
    """Seed sample notifications if the database is empty."""
    from shared.database import get_db

    db = get_db()
    count = await db.notifications.count_documents({})
    if count > 0:
        return

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
