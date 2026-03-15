"""Workflow definition models for the visual workflow designer."""

from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum


class NodeType(str, Enum):
    start = "start"
    end = "end"
    task = "task"
    decision = "decision"
    parallel = "parallel"
    subprocess = "subprocess"


class NodePosition(BaseModel):
    x: float = 0
    y: float = 0


class WorkflowNode(BaseModel):
    model_config = {"populate_by_name": True}
    id: str
    type: NodeType
    label: str
    position: NodePosition = NodePosition()
    assignee_role: Optional[str] = Field(default=None, alias="assigneeRole")
    form_id: Optional[str] = Field(default=None, alias="formId")
    config: dict[str, Any] = {}


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    condition: Optional[str] = None


class WorkflowDefinition(BaseModel):
    nodes: list[WorkflowNode] = []
    edges: list[WorkflowEdge] = []


class WorkflowCreate(BaseModel):
    model_config = {"populate_by_name": True}
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    case_type: Optional[str] = Field(default=None, alias="caseTypeId")
    definition: WorkflowDefinition = WorkflowDefinition()


class WorkflowUpdate(BaseModel):
    model_config = {"populate_by_name": True}
    name: Optional[str] = None
    description: Optional[str] = None
    case_type: Optional[str] = Field(default=None, alias="caseTypeId")
    definition: Optional[WorkflowDefinition] = None
    is_active: Optional[bool] = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: str
    case_type: Optional[str] = None
    definition: WorkflowDefinition
    version: int = 1
    is_active: bool = True
    created_by: str
    created_at: str
    updated_at: str


class ValidationError(BaseModel):
    type: str
    message: str
    node_id: Optional[str] = None


class WorkflowValidationResponse(BaseModel):
    valid: bool
    errors: list[ValidationError] = []
