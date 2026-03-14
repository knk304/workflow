"""Comment routes — scoped to cases."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from bson import ObjectId
from datetime import datetime, timezone

from shared.auth_deps import get_current_user
from shared.database import get_db
from app.models.schemas import CommentCreate, CommentResponse

router = APIRouter(prefix="/comments", tags=["comments"])


def _to_response(doc: dict) -> CommentResponse:
    return CommentResponse(
        id=str(doc["_id"]),
        caseId=doc.get("caseId"),
        taskId=doc.get("taskId"),
        userId=doc["userId"],
        userName=doc["userName"],
        userAvatar=doc.get("userAvatar"),
        text=doc["text"],
        mentions=doc.get("mentions", []),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


@router.get("", response_model=list[CommentResponse])
async def list_comments(
    caseId: str | None = None,
    taskId: str | None = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if caseId:
        query["caseId"] = caseId
    if taskId:
        query["taskId"] = taskId
    cursor = db.comments.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    return [_to_response(doc) async for doc in cursor]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CommentResponse)
async def add_comment(body: CommentCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "caseId": body.caseId,
        "taskId": body.taskId,
        "userId": body.userId,
        "userName": body.userName,
        "userAvatar": body.userAvatar,
        "text": body.text,
        "mentions": [m for m in body.mentions],
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.comments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)
