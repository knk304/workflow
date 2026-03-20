"""
Pega-Lite Case Type Definition models (Blueprint).

A CaseTypeDefinition is the admin-configured blueprint.
Runtime instances are in models/cases.py.
"""

from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


# ── Enums ──────────────────────────────────────────────────

class StepType(str, Enum):
    assignment = "assignment"
    approval = "approval"
    attachment = "attachment"
    decision = "decision"
    automation = "automation"
    subprocess = "subprocess"


class StageType(str, Enum):
    primary = "primary"
    alternate = "alternate"


class StageCompletionAction(str, Enum):
    auto_advance = "auto_advance"
    wait_for_user = "wait_for_user"
    resolve_case = "resolve_case"


class ProcessType(str, Enum):
    sequential = "sequential"
    parallel = "parallel"


# ── Step Configuration Models ──────────────────────────────

class AssignmentStepConfig(BaseModel):
    assignee_role: str = ""
    assignee_user_id: Optional[str] = None
    form_id: Optional[str] = None
    instructions: Optional[str] = None
    set_case_status: Optional[str] = None


class ApprovalStepConfig(BaseModel):
    mode: str = "sequential"
    approver_roles: list[str] = []
    approver_user_ids: list[str] = []
    allow_delegation: bool = True
    rejection_stage_id: Optional[str] = None


class AttachmentStepConfig(BaseModel):
    categories: list[str] = []
    min_files: int = 1
    allowed_types: list[str] = []
    max_file_size_mb: int = 25
    instructions: Optional[str] = None


class DecisionBranch(BaseModel):
    id: str
    label: str
    condition: dict
    next_step_id: str


class DecisionStepConfig(BaseModel):
    mode: str = "first_match"
    branches: list[DecisionBranch] = []
    decision_table_id: Optional[str] = None
    default_step_id: Optional[str] = None


class AutomationAction(BaseModel):
    type: str  # set_field | call_webhook | send_notification | evaluate_rules | change_stage | create_assignment
    config: dict = {}


class WebhookConfig(BaseModel):
    url: str
    method: str = "POST"
    headers: dict = {}
    body_template: dict = {}
    response_map: dict = {}


class AutomationRuleConfig(BaseModel):
    condition: dict
    actions: list[AutomationAction] = []


class AutomationStepConfig(BaseModel):
    actions: list[AutomationAction] = []
    rules: list[AutomationRuleConfig] = []
    webhook: Optional[WebhookConfig] = None


class SubprocessStepConfig(BaseModel):
    child_case_type_id: str
    field_mapping: dict = {}
    wait_for_resolution: bool = True
    propagate_fields: dict = {}


# ── Step / Process / Stage Definitions ─────────────────────

class StepDefinition(BaseModel):
    id: str
    name: str
    type: StepType
    order: int
    required: bool = True
    skip_when: Optional[dict] = None
    visible_when: Optional[dict] = None
    sla_hours: Optional[int] = None
    config: dict = {}


class ProcessDefinition(BaseModel):
    id: str
    name: str
    type: ProcessType = ProcessType.sequential
    order: int
    is_parallel: bool = False
    start_when: Optional[dict] = None
    sla_hours: Optional[int] = None
    steps: list[StepDefinition] = []


class StageDefinition(BaseModel):
    id: str
    name: str
    stage_type: StageType = StageType.primary
    order: int
    on_complete: StageCompletionAction = StageCompletionAction.auto_advance
    resolution_status: Optional[str] = None
    skip_when: Optional[dict] = None
    entry_criteria: Optional[dict] = None
    required_attachments: list[str] = []
    delete_open_assignments: bool = True
    resolve_child_cases: bool = True
    sla_hours: Optional[int] = None
    processes: list[ProcessDefinition] = []


# ── Attachment Category ────────────────────────────────────

class AttachmentCategory(BaseModel):
    id: str
    name: str
    required_for_resolution: bool = False
    allowed_types: list[str] = []


# ── Case Type Definition ───────────────────────────────────

class CaseTypeDefinitionCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    icon: str = "folder"
    prefix: str = "CASE"
    field_schema: dict = {}
    stages: list[StageDefinition] = []
    attachment_categories: list[AttachmentCategory] = []
    case_wide_actions: list[str] = []


class CaseTypeDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    prefix: Optional[str] = None
    field_schema: Optional[dict] = None
    stages: Optional[list[StageDefinition]] = None
    attachment_categories: Optional[list[AttachmentCategory]] = None
    case_wide_actions: Optional[list[str]] = None
    is_active: Optional[bool] = None


class CaseTypeDefinitionResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: str = "folder"
    prefix: str = "CASE"
    field_schema: dict = {}
    stages: list[StageDefinition] = []
    attachment_categories: list[AttachmentCategory] = []
    case_wide_actions: list[str] = []
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    version: int = 1
    is_active: bool = True
