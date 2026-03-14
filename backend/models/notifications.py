from pydantic import BaseModel
from typing import Optional
from enum import Enum


class NotificationType(str, Enum):
    assignment = "assignment"
    mention = "mention"
    status_change = "status_change"
    sla_warning = "sla_warning"
    comment = "comment"


class EntityType(str, Enum):
    case = "case"
    task = "task"


class NotificationCreate(BaseModel):
    userId: str
    type: NotificationType
    title: str
    message: str
    entityType: EntityType
    entityId: str


class NotificationResponse(BaseModel):
    id: str
    userId: str
    type: NotificationType
    title: str
    message: str
    entityType: EntityType
    entityId: str
    isRead: bool = False
    readAt: Optional[str] = None
    createdAt: str
