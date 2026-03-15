from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone

from auth_deps import get_current_user
from database import get_db
from id_utils import find_by_id, update_by_id
from models.notifications import NotificationCreate, NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _to_response(doc: dict) -> NotificationResponse:
    return NotificationResponse(
        id=str(doc["_id"]),
        userId=doc["userId"],
        type=doc["type"],
        title=doc["title"],
        message=doc["message"],
        entityType=doc["entityType"],
        entityId=doc["entityId"],
        isRead=doc.get("isRead", False),
        readAt=doc.get("readAt"),
        createdAt=doc["createdAt"],
    )


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    userId: str | None = None,
    isRead: bool | None = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if userId:
        query["userId"] = userId
    else:
        query["userId"] = str(user["_id"])
    if isRead is not None:
        query["isRead"] = isRead
    cursor = db.notifications.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    return [_to_response(doc) async for doc in cursor]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=NotificationResponse)
async def create_notification(body: NotificationCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "userId": body.userId,
        "type": body.type.value,
        "title": body.title,
        "message": body.message,
        "entityType": body.entityType.value,
        "entityId": body.entityId,
        "isRead": False,
        "readAt": None,
        "createdAt": now,
    }
    result = await db.notifications.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(notification_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await update_by_id(db.notifications, notification_id,
        {"$set": {"isRead": True, "readAt": now}},
    )
    doc = await find_by_id(db.notifications, notification_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return _to_response(doc)
