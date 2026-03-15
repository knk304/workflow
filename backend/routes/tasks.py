"""Task CRUD + Kanban board routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from bson import ObjectId
from datetime import datetime, timezone

from auth_deps import get_current_user
from database import get_db
from id_utils import find_by_id, update_by_id
from models.tasks import (
    TaskCreate, TaskUpdate, TaskResponse,
    TaskStatus, KanbanBoardResponse, ChecklistItem,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _to_response(doc: dict) -> TaskResponse:
    return TaskResponse(
        id=str(doc["_id"]),
        caseId=doc["caseId"],
        title=doc["title"],
        description=doc.get("description", ""),
        assigneeId=doc.get("assigneeId"),
        teamId=doc.get("teamId"),
        status=doc["status"],
        priority=doc["priority"],
        dueDate=doc.get("dueDate"),
        dependsOn=doc.get("dependsOn", []),
        tags=doc.get("tags", []),
        checklist=[ChecklistItem(**c) for c in doc.get("checklist", [])],
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
        completedAt=doc.get("completedAt"),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TaskResponse)
async def create_task(body: TaskCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "caseId": body.caseId,
        "title": body.title,
        "description": body.description,
        "assigneeId": body.assigneeId,
        "teamId": body.teamId,
        "status": TaskStatus.pending.value,
        "priority": body.priority.value,
        "dueDate": body.dueDate,
        "dependsOn": body.dependsOn,
        "tags": body.tags,
        "checklist": [c.model_dump() for c in body.checklist],
        "createdAt": now,
        "updatedAt": now,
        "completedAt": None,
    }
    result = await db.tasks.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    caseId: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    assigneeId: str | None = None,
    priority: str | None = None,
    skip: int = 0,
    limit: int = 100,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if caseId:
        query["caseId"] = caseId
    if status_filter:
        query["status"] = status_filter
    if assigneeId:
        query["assigneeId"] = assigneeId
    if priority:
        query["priority"] = priority
    cursor = db.tasks.find(query).sort("updatedAt", -1).skip(skip).limit(limit)
    return [_to_response(doc) async for doc in cursor]


@router.get("/kanban", response_model=KanbanBoardResponse)
async def get_kanban_board(
    caseId: str | None = None,
    assigneeId: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if caseId:
        query["caseId"] = caseId
    if assigneeId:
        query["assigneeId"] = assigneeId

    cursor = db.tasks.find(query).sort("updatedAt", -1)
    board = KanbanBoardResponse()
    async for doc in cursor:
        resp = _to_response(doc)
        match doc["status"]:
            case "pending":
                board.pending.append(resp)
            case "in_progress":
                board.inProgress.append(resp)
            case "review":
                board.review.append(resp)
            case "completed":
                board.done.append(resp)
            case "blocked":
                board.blocked.append(resp)
            case _:
                board.pending.append(resp)
    return board


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.tasks, task_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return _to_response(doc)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, body: TaskUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    updates: dict = {}

    for field_name, value in body.model_dump(exclude_none=True).items():
        if field_name == "checklist" and value is not None:
            updates["checklist"] = value
        elif hasattr(value, "value"):
            updates[field_name] = value.value
        else:
            updates[field_name] = value

    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    now = datetime.now(timezone.utc).isoformat()
    updates["updatedAt"] = now

    if updates.get("status") == "completed":
        updates["completedAt"] = now
    elif updates.get("status") and updates["status"] != "completed":
        updates["completedAt"] = None

    await update_by_id(db.tasks, task_id, {"$set": updates})
    doc = await find_by_id(db.tasks, task_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return _to_response(doc)
