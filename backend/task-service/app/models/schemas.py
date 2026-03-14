from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"
    cancelled = "cancelled"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ChecklistItem(BaseModel):
    id: str
    item: str
    checked: bool = False
    completedAt: Optional[str] = None


class TaskCreate(BaseModel):
    caseId: str
    title: str
    description: str = ""
    assigneeId: Optional[str] = None
    teamId: Optional[str] = None
    priority: Priority = Priority.medium
    dueDate: Optional[str] = None
    dependsOn: list[str] = []
    tags: list[str] = []
    checklist: list[ChecklistItem] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigneeId: Optional[str] = None
    teamId: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[Priority] = None
    dueDate: Optional[str] = None
    dependsOn: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    checklist: Optional[list[ChecklistItem]] = None


class TaskResponse(BaseModel):
    id: str
    caseId: str
    title: str
    description: str
    assigneeId: Optional[str] = None
    teamId: Optional[str] = None
    status: TaskStatus
    priority: Priority
    dueDate: Optional[str] = None
    dependsOn: list[str] = []
    tags: list[str] = []
    checklist: list[ChecklistItem] = []
    createdAt: str
    updatedAt: str
    completedAt: Optional[str] = None


class KanbanBoardResponse(BaseModel):
    pending: list[TaskResponse] = []
    inProgress: list[TaskResponse] = []
    review: list[TaskResponse] = []
    done: list[TaskResponse] = []
    blocked: list[TaskResponse] = []
