"""Rule engine and decision table models."""

from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum


class Operator(str, Enum):
    eq = "eq"
    neq = "neq"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    contains = "contains"
    not_contains = "not_contains"
    in_list = "in"
    not_in = "not_in"
    is_empty = "is_empty"
    is_not_empty = "is_not_empty"
    starts_with = "starts_with"
    ends_with = "ends_with"
    between = "between"
    matches = "matches"


# --- Conditions ---
# Simple:    {"field": "amount", "operator": "gt", "value": 100}
# Compound:  {"all": [...]} or {"any": [...]}
# Nested:    {"all": [{"any": [...]}, {"field": ...}]}
#
# Represented as plain dicts at the API/storage level.
# The RuleEngine parses them dynamically.


class ConditionSchema(BaseModel):
    """Schema for a simple condition (used for validation only)."""
    field: str
    operator: str
    value: Any = None


class RuleAction(BaseModel):
    """An action to execute when a rule's condition is met."""
    type: str  # set_field | send_notification | change_stage | create_assignment | call_webhook
    field: Optional[str] = None
    value: Any = None
    config: dict = {}


class AutomationRule(BaseModel):
    """A condition-action pair used in automation steps."""
    condition: dict
    actions: list[RuleAction] = []


class WebhookConfig(BaseModel):
    """Configuration for an external HTTP call."""
    url: str
    method: str = "POST"
    headers: dict = {}
    body_template: dict = {}
    response_map: dict = {}  # response field -> case field


# --- Decision Tables ---

class DecisionTableRow(BaseModel):
    """A single row: conditions -> output."""
    conditions: dict  # CompoundCondition as dict
    output: Any
    priority: int = 0


class DecisionTableCreate(BaseModel):
    name: str
    description: Optional[str] = None
    inputs: list[str] = []
    output_field: str
    rows: list[DecisionTableRow] = []
    default_output: Any = None


class DecisionTableUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    inputs: Optional[list[str]] = None
    output_field: Optional[str] = None
    rows: Optional[list[DecisionTableRow]] = None
    default_output: Any = None


class DecisionTableResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    inputs: list[str] = []
    output_field: str
    rows: list[DecisionTableRow] = []
    default_output: Any = None
    created_by: Optional[str] = None
    created_at: str
    updated_at: str
    version: int = 1


class RuleEvaluateRequest(BaseModel):
    """Test a condition against sample data."""
    condition: dict
    data: dict


class RuleEvaluateResponse(BaseModel):
    result: bool
    matched_conditions: list[str] = []
    evaluation_path: list[str] = []


class DecisionTableEvaluateRequest(BaseModel):
    """Test a decision table against sample data."""
    data: dict


class DecisionTableEvaluateResponse(BaseModel):
    output: Any
    matched_row: Optional[int] = None
    all_matches: list[dict] = []
