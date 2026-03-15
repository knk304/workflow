from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum


class CaseStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    pending = "pending"
    resolved = "resolved"
    withdrawn = "withdrawn"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class StageStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"


class StageHistory(BaseModel):
    name: str
    status: StageStatus
    enteredAt: str
    completedAt: Optional[str] = None
    completedBy: Optional[str] = None


class SLAInfo(BaseModel):
    targetDate: str
    targetResolutionDate: Optional[str] = None
    daysRemaining: Optional[int] = None
    escalated: bool = False
    escalationLevel: int = 0


class CaseCreate(BaseModel):
    type: str
    priority: Priority = Priority.medium
    ownerId: Optional[str] = None
    teamId: Optional[str] = None
    fields: dict[str, Any] = {}
    notes: Optional[str] = None


class CaseUpdate(BaseModel):
    status: Optional[CaseStatus] = None
    priority: Optional[Priority] = None
    ownerId: Optional[str] = None
    teamId: Optional[str] = None
    fields: Optional[dict[str, Any]] = None
    notes: Optional[str] = None


class AssignedUser(BaseModel):
    id: str
    name: str
    email: str
    role: str = ""


class CaseResponse(BaseModel):
    id: str
    type: str
    status: CaseStatus
    stage: str
    priority: Priority
    ownerId: str
    teamId: str
    assignedTo: Optional[AssignedUser] = None
    fields: dict[str, Any] = {}
    stages: list[StageHistory] = []
    sla: SLAInfo
    notes: Optional[str] = None
    createdAt: str
    updatedAt: str
    createdBy: str


class TransitionRequest(BaseModel):
    action: str
    notes: Optional[str] = None


class TransitionOption(BaseModel):
    model_config = {"populate_by_name": True}
    action: str
    to: str
    from_stage: Optional[str] = Field(default=None, alias="from")


class CaseTypeResponse(BaseModel):
    id: str
    name: str
    slug: str = ""
    description: str
    stages: list[str]
    transitions: list[dict[str, Any]] = []
    fieldsSchema: dict[str, Any] = {}
    workflowId: Optional[str] = None


class CaseTypeCreate(BaseModel):
    name: str
    slug: str
    description: str = ""
    workflowId: Optional[str] = None
    fieldsSchema: dict[str, Any] = {}


class CaseTypeUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    workflowId: Optional[str] = None
    fieldsSchema: Optional[dict[str, Any]] = None


class CommentCreate(BaseModel):
    caseId: Optional[str] = None
    taskId: Optional[str] = None
    userId: str
    userName: str
    userAvatar: Optional[str] = None
    text: str
    mentions: list[dict[str, str]] = []


class CommentResponse(BaseModel):
    id: str
    caseId: Optional[str] = None
    taskId: Optional[str] = None
    userId: str
    userName: str
    userAvatar: Optional[str] = None
    text: str
    mentions: list[dict[str, str]] = []
    createdAt: str
    updatedAt: str


class AuditLogResponse(BaseModel):
    id: str
    entityType: str
    entityId: str
    action: str
    actorId: str
    actorName: str
    changes: dict[str, Any] = {}
    timestamp: str
