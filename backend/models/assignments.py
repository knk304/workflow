"""
Assignment models — materialized view of active human steps.

When the lifecycle engine activates a human step (assignment, approval, attachment),
it writes a record here for fast querying ("My Work" list).
"""

from pydantic import BaseModel
from typing import Optional
from enum import Enum


class AssignmentStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    on_hold = "on_hold"


class AssignmentType(str, Enum):
    form = "form"
    approval = "approval"
    attachment = "attachment"
    action = "action"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Assignment(BaseModel):
    id: str
    case_id: str
    case_title: str
    case_type_id: str
    stage_id: str
    stage_name: str
    process_id: str
    process_name: str
    step_id: str
    step_name: str
    type: AssignmentType
    status: AssignmentStatus = AssignmentStatus.open
    priority: Priority
    assigned_to: Optional[str] = None
    assigned_role: Optional[str] = None
    form_id: Optional[str] = None
    instructions: Optional[str] = None
    sla_hours: Optional[int] = None
    due_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str


class AssignmentResponse(BaseModel):
    id: str
    case_id: str
    case_title: str
    case_type_id: str
    stage_name: str
    process_name: str
    step_name: str
    type: AssignmentType
    status: AssignmentStatus
    priority: Priority
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_role: Optional[str] = None
    form_id: Optional[str] = None
    instructions: Optional[str] = None
    due_at: Optional[str] = None
    is_overdue: bool = False
    sla_hours: Optional[int] = None
    created_at: str


class AssignmentCompleteRequest(BaseModel):
    form_data: Optional[dict] = None
    notes: Optional[str] = None
    decision: Optional[str] = None
    delegate_to: Optional[str] = None
