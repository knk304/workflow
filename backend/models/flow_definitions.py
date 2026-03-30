"""Flow Definition models — independent questionnaire/flow config system.

Separate from WorkflowDefinition (visual workflow designer).
A FlowDefinition describes a questionnaire or guided flow with:
  - question nodes (with field definitions)
  - decision nodes (with condition routing)
  - start/end nodes
  - edges connecting them
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum


class FlowNodeType(str, Enum):
    start = "start"
    end = "end"
    question = "question"
    decision = "decision"
    display = "display"        # read-only info node
    subprocess = "subprocess"  # link to another flow
    task = "task"              # process task (assignable work item)
    parallel = "parallel"      # parallel gateway
    approval = "approval"      # approval step
    notification = "notification"  # send notification step
    timer = "timer"            # wait / delay step
    api_call = "api_call"      # external API call node


class FlowFieldType(str, Enum):
    text = "text"
    textarea = "textarea"
    number = "number"
    date = "date"
    select = "select"
    radio = "radio"
    checkbox = "checkbox"
    multi_select = "multi_select"
    file = "file"
    alert = "alert"


class FlowFieldValidation(BaseModel):
    required: bool = False
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    pattern: Optional[str] = None


class FlowFieldOption(BaseModel):
    label: str
    value: str


class FlowField(BaseModel):
    """A single field within a question node."""
    model_config = {"populate_by_name": True}
    id: str
    type: FlowFieldType
    label: str
    placeholder: str = ""
    help_text: str = Field(default="", alias="helpText")
    default_value: Optional[str] = Field(default=None, alias="defaultValue")
    options: list[FlowFieldOption] = []
    validation: FlowFieldValidation = FlowFieldValidation()
    order: int = 0


class DecisionCondition(BaseModel):
    """A branch in a decision node that routes based on field values."""
    model_config = {"populate_by_name": True}
    id: str
    label: str
    field_id: str = Field(..., alias="fieldId")
    operator: str = "equals"   # equals, not_equals, contains, gt, lt, gte, lte, in
    value: Any = None
    target_node_id: str = Field(..., alias="targetNodeId")


class FlowNodePosition(BaseModel):
    x: float = 0
    y: float = 0


class FlowNode(BaseModel):
    """A node in the flow definition graph."""
    model_config = {"populate_by_name": True}
    id: str
    type: FlowNodeType
    label: str
    position: FlowNodePosition = FlowNodePosition()
    # Question nodes: fields to display
    fields: list[FlowField] = []
    # Decision nodes: conditions for routing
    conditions: list[DecisionCondition] = []
    # Decision default route (if no condition matches)
    default_target: Optional[str] = Field(default=None, alias="defaultTarget")
    # Display nodes: rich text / markdown content
    content: Optional[str] = None
    # Subprocess: link to another flow definition
    linked_flow_id: Optional[str] = Field(default=None, alias="linkedFlowId")
    config: dict[str, Any] = {}


class FlowEdge(BaseModel):
    """An edge connecting two flow nodes."""
    model_config = {"populate_by_name": True}
    id: str
    source: str
    target: str
    label: Optional[str] = None
    condition_id: Optional[str] = Field(default=None, alias="conditionId")


class FlowDefinitionBody(BaseModel):
    nodes: list[FlowNode] = []
    edges: list[FlowEdge] = []


# ─── CRUD Schemas ──────────────────────────────────

class FlowDefinitionCreate(BaseModel):
    model_config = {"populate_by_name": True}
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    category: str = ""  # e.g. "health", "finance", "onboarding"
    definition: FlowDefinitionBody = FlowDefinitionBody()


class FlowDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    definition: Optional[FlowDefinitionBody] = None
    is_active: Optional[bool] = None


class FlowDefinitionResponse(BaseModel):
    model_config = {"populate_by_name": True}
    id: str
    name: str
    description: str
    category: str
    definition: FlowDefinitionBody
    version: int = 1
    is_active: bool = Field(default=True, alias="isActive")
    created_by: str = Field(default="", alias="createdBy")
    created_at: str = Field(default="", alias="createdAt")
    updated_at: str = Field(default="", alias="updatedAt")


# ─── Execution / Submission Models ─────────────────

class FlowExecutionStatus(str, Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"


class FlowAnswer(BaseModel):
    """An answer to a single field in a question node."""
    model_config = {"populate_by_name": True}
    node_id: str = Field(..., alias="nodeId")
    field_id: str = Field(..., alias="fieldId")
    value: Any = None


class FlowExecutionCreate(BaseModel):
    model_config = {"populate_by_name": True}
    flow_definition_id: str = Field(..., alias="flowDefinitionId")


class FlowExecutionUpdate(BaseModel):
    model_config = {"populate_by_name": True}
    current_node_id: Optional[str] = Field(default=None, alias="currentNodeId")
    answers: Optional[list[FlowAnswer]] = None
    status: Optional[FlowExecutionStatus] = None


class FlowExecutionResponse(BaseModel):
    model_config = {"populate_by_name": True}
    id: str
    request_number: str = Field(default="", alias="requestNumber")
    flow_definition_id: str = Field(..., alias="flowDefinitionId")
    flow_name: str = Field(default="", alias="flowName")
    current_node_id: str = Field(default="", alias="currentNodeId")
    visited_nodes: list[str] = Field(default_factory=list, alias="visitedNodes")
    answers: list[FlowAnswer] = []
    status: FlowExecutionStatus = FlowExecutionStatus.in_progress
    started_by: str = Field(default="", alias="startedBy")
    started_at: str = Field(default="", alias="startedAt")
    completed_at: Optional[str] = Field(default=None, alias="completedAt")
