"""Approval chain models."""

from pydantic import BaseModel
from typing import Optional
from enum import Enum


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    delegated = "delegated"
    escalated = "escalated"


class ApprovalMode(str, Enum):
    sequential = "sequential"
    parallel = "parallel"


class Approver(BaseModel):
    user_id: str
    sequence: int = 0
    status: ApprovalStatus = ApprovalStatus.pending
    delegated_to: Optional[str] = None
    decision_at: Optional[str] = None
    decision_notes: Optional[str] = None


class ApprovalChainCreate(BaseModel):
    case_id: str
    workflow_id: Optional[str] = None
    mode: ApprovalMode = ApprovalMode.sequential
    approvers: list[Approver] = []


class ApprovalDecision(BaseModel):
    notes: Optional[str] = None


class ApprovalDelegation(BaseModel):
    delegate_to: str
    notes: Optional[str] = None


class ApprovalChainResponse(BaseModel):
    id: str
    case_id: str
    workflow_id: Optional[str] = None
    mode: ApprovalMode
    approvers: list[Approver] = []
    status: str = "pending"
    created_at: str
    completed_at: Optional[str] = None


class DocumentCreate(BaseModel):
    case_id: Optional[str] = None
    task_id: Optional[str] = None
    tags: list[str] = []


class DocumentResponse(BaseModel):
    id: str
    case_id: Optional[str] = None
    task_id: Optional[str] = None
    file_name: str
    file_type: str
    file_size: int
    version: int = 1
    uploaded_by: str
    tags: list[str] = []
    storage_path: str
    current: bool = True
    created_at: str


class DocumentVersionResponse(BaseModel):
    versions: list[DocumentResponse] = []


class SLADefinitionCreate(BaseModel):
    case_type_id: str
    stage: str
    hours_target: int
    escalation_enabled: bool = True
    escalate_to_role: str = "MANAGER"


class SLADefinitionResponse(BaseModel):
    id: str
    case_type_id: str
    stage: str
    hours_target: int
    escalation_enabled: bool
    escalate_to_role: str
    created_at: str


# ─── Approval Routing Rules ──────────────────────
class ApprovalRoutingOperator(str, Enum):
    eq = "eq"
    neq = "neq"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    contains = "contains"


class ApprovalRoutingCondition(BaseModel):
    field: str
    operator: ApprovalRoutingOperator
    value: str | int | float | bool


class ApprovalRoutingRule(BaseModel):
    name: str
    case_type_id: str
    conditions: list[ApprovalRoutingCondition]
    approver_user_ids: list[str]
    mode: ApprovalMode = ApprovalMode.sequential
    priority: int = 0
    is_active: bool = True


class ApprovalRoutingRuleResponse(ApprovalRoutingRule):
    id: str
    created_at: str
