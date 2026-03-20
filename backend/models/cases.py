"""
Pega-Lite Case runtime instance models.

A CaseInstance mirrors the CaseTypeDefinition blueprint at runtime,
with nested StageInstance → ProcessInstance → StepInstance tracking execution state.
"""

from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum

from models.case_types import StepType, StageType, StageCompletionAction, ProcessType


# ── Enums ──────────────────────────────────────────────────

class CaseStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    pending = "pending"
    resolved_completed = "resolved_completed"
    resolved_cancelled = "resolved_cancelled"
    resolved_rejected = "resolved_rejected"
    withdrawn = "withdrawn"


class ItemStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"
    cancelled = "cancelled"
    waiting = "waiting"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# ── Runtime Hierarchy ──────────────────────────────────────

class StepInstance(BaseModel):
    definition_id: str
    name: str
    type: StepType
    status: ItemStatus = ItemStatus.pending
    order: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    assigned_to: Optional[str] = None
    form_submission_id: Optional[str] = None
    approval_chain_id: Optional[str] = None
    child_case_id: Optional[str] = None
    decision_branch_taken: Optional[str] = None
    skipped_reason: Optional[str] = None
    notes: Optional[str] = None
    sla_target: Optional[str] = None


class ProcessInstance(BaseModel):
    definition_id: str
    name: str
    type: ProcessType
    status: ItemStatus = ItemStatus.pending
    order: int
    is_parallel: bool = False
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    steps: list[StepInstance] = []


class StageInstance(BaseModel):
    definition_id: str
    name: str
    stage_type: StageType
    status: ItemStatus = ItemStatus.pending
    order: int
    on_complete: StageCompletionAction
    entered_at: Optional[str] = None
    completed_at: Optional[str] = None
    completed_by: Optional[str] = None
    processes: list[ProcessInstance] = []


# ── Case Instance ──────────────────────────────────────────

class CaseInstance(BaseModel):
    id: str
    case_type_id: str
    case_type_name: str
    title: str
    status: CaseStatus = CaseStatus.open
    priority: Priority = Priority.medium
    owner_id: str
    team_id: Optional[str] = None
    custom_fields: dict = {}

    current_stage_id: Optional[str] = None
    current_process_id: Optional[str] = None
    current_step_id: Optional[str] = None

    stages: list[StageInstance] = []

    created_by: str
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None
    resolution_status: Optional[str] = None
    parent_case_id: Optional[str] = None
    parent_step_id: Optional[str] = None

    sla_target_date: Optional[str] = None
    sla_days_remaining: Optional[int] = None
    escalation_level: int = 0


# ── Request / Response Models ──────────────────────────────

class CaseCreateRequest(BaseModel):
    case_type_id: str
    title: str
    priority: Priority = Priority.medium
    owner_id: Optional[str] = None
    team_id: Optional[str] = None
    custom_fields: dict = {}


class CaseUpdateRequest(BaseModel):
    title: Optional[str] = None
    priority: Optional[Priority] = None
    owner_id: Optional[str] = None
    team_id: Optional[str] = None
    custom_fields: Optional[dict] = None


class CaseResponse(BaseModel):
    id: str
    case_type_id: str
    case_type_name: str
    title: str
    status: CaseStatus
    priority: Priority
    owner_id: str
    team_id: Optional[str] = None
    custom_fields: dict = {}
    current_stage_id: Optional[str] = None
    current_process_id: Optional[str] = None
    current_step_id: Optional[str] = None
    stages: list[StageInstance] = []
    created_by: str
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None
    resolution_status: Optional[str] = None
    parent_case_id: Optional[str] = None
    sla_target_date: Optional[str] = None
    sla_days_remaining: Optional[int] = None
    escalation_level: int = 0


class StepCompleteRequest(BaseModel):
    notes: Optional[str] = None
    form_data: Optional[dict] = None
    decision: Optional[str] = None
    delegate_to: Optional[str] = None


class AdvanceStageRequest(BaseModel):
    notes: Optional[str] = None


class ChangeStageRequest(BaseModel):
    target_stage_id: str
    reason: str


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


# ── Legacy compatibility (Sprint B will rewrite routes/cases.py & routes/case_types.py) ──

class StageStatus(str, Enum):
    """Legacy enum used by old routes — maps to ItemStatus."""
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"


class StageHistory(BaseModel):
    """Legacy model used by old routes/cases.py."""
    name: str
    status: StageStatus
    enteredAt: str
    completedAt: Optional[str] = None
    completedBy: Optional[str] = None


class SLAInfo(BaseModel):
    """Legacy SLA model used by old routes/cases.py."""
    targetDate: str
    targetResolutionDate: Optional[str] = None
    daysRemaining: Optional[int] = None
    escalated: bool = False
    escalationLevel: int = 0


class AssignedUser(BaseModel):
    """Legacy assigned-user model."""
    id: str
    name: str
    email: str
    role: str = ""


class CaseCreate(BaseModel):
    """Legacy create model used by old routes/cases.py."""
    type: str
    priority: Priority = Priority.medium
    ownerId: Optional[str] = None
    teamId: Optional[str] = None
    fields: dict[str, Any] = {}
    notes: Optional[str] = None


class CaseUpdate(BaseModel):
    """Legacy update model."""
    status: Optional[CaseStatus] = None
    priority: Optional[Priority] = None
    ownerId: Optional[str] = None
    teamId: Optional[str] = None
    fields: Optional[dict[str, Any]] = None
    notes: Optional[str] = None


class TransitionRequest(BaseModel):
    """Legacy stage transition model."""
    action: str
    notes: Optional[str] = None


class LegacyCaseResponse(BaseModel):
    """Legacy response model used by old routes/cases.py before Sprint B rewrite."""
    id: str
    type: str
    status: str
    stage: str
    priority: str
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


class CaseTypeResponse(BaseModel):
    """Legacy case type response used by old routes/case_types.py."""
    id: str
    name: str
    slug: str = ""
    description: str = ""
    stages: list[str] = []
    transitions: list[dict[str, Any]] = []
    fieldsSchema: dict[str, Any] = {}
    workflowId: Optional[str] = None
    stageFormMap: dict[str, str] = {}


class CaseTypeCreate(BaseModel):
    """Legacy case type create."""
    name: str
    slug: str
    description: str = ""
    workflowId: Optional[str] = None
    fieldsSchema: dict[str, Any] = {}


class CaseTypeUpdate(BaseModel):
    """Legacy case type update."""
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    workflowId: Optional[str] = None
    fieldsSchema: Optional[dict[str, Any]] = None
