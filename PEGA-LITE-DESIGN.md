# Pega-Lite Case Management — Complete Design Document

> **Version:** 1.0  
> **Date:** March 20, 2026  
> **Status:** Approved for Development  
> **Reference:** Pega Case Management (Stages → Processes → Steps model)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Concept: Case Hierarchy](#2-core-concept-case-hierarchy)
3. [Data Models](#3-data-models)
4. [Rule Engine](#4-rule-engine)
5. [Decision Tables](#5-decision-tables)
6. [Case Lifecycle Engine](#6-case-lifecycle-engine)
7. [Step Types](#7-step-types)
8. [API Endpoints](#8-api-endpoints)
9. [Admin UI — Case Type Designer (App Studio)](#9-admin-ui--case-type-designer-app-studio)
10. [User UI — Case Worker Portal](#10-user-ui--case-worker-portal)
11. [Frontend State Management](#11-frontend-state-management)
12. [Seed Data](#12-seed-data)
13. [Migration from Current System](#13-migration-from-current-system)
14. [Sprint Plan](#14-sprint-plan)
15. [File Impact Summary](#15-file-impact-summary)

---

## 1. Architecture Overview

### Current vs Pega-Lite

```
CURRENT (Flat)                          PEGA-LITE (Hierarchical)
─────────────────                       ──────────────────────────
Case                                    Case Type (Blueprint)
 ├─ stages[] (string array)              └─ Stage
 ├─ transitions[] (flat rules)               ├─ on_complete: auto_advance | wait | resolve
 └─ tasks[] (standalone)                     ├─ skip_when: {condition}
                                             ├─ entry_criteria: {condition}
Workflow (visual graph, disconnected)        └─ Process (sequential or parallel)
Approval (separate chain)                        ├─ start_when: {condition}
Form (standalone)                                └─ Step
SLA (stage-level only)                               ├─ type: assignment | approval | attachment
                                                     │        | decision | automation | subprocess
                                                     ├─ form_id, sla, assignee
                                                     └─ config per type
```

### Two Distinct UIs

| UI | URL Prefix | Users | Purpose |
|---|---|---|---|
| **Admin Portal** (App Studio) | `/admin/*` | Admins, Managers | Configure case types, design stages/processes/steps, build forms, manage rules & decision tables |
| **Case Worker Portal** | `/portal/*` | All users | Create cases, complete assignments, view case progress, approve/reject, upload documents |

### Tech Stack (Unchanged)

- **Backend:** FastAPI + MongoDB (Motor async) + Python 3.11+
- **Frontend:** Angular 19 (standalone) + Material + Tailwind + NgRx
- **Real-time:** WebSocket
- **AI:** Phase 3 (untouched)

---

## 2. Core Concept: Case Hierarchy

### Pega's Model (What We Replicate)

```
Case Type Definition (Blueprint — admin configures this)
│
├─ Stage: "Create" (Primary)
│   └─ Process: "Collect Information" (sequential)
│       ├─ Step: "Fill Application Form" (assignment + form)
│       └─ Step: "Upload Documents" (attachment)
│
├─ Stage: "Investigation" (Primary)
│   ├─ Process: "Verify Documents" (sequential)
│   │   ├─ Step: "Credit Check" (automation)
│   │   └─ Step: "Review Results" (assignment)
│   └─ Process: "Risk Assessment" (parallel)
│       └─ Step: "Evaluate Risk" (assignment)
│
├─ Stage: "Approval" (Primary)
│   └─ Process: "Approval Flow" (sequential)
│       ├─ Step: "Route by Amount" (decision)
│       ├─ Step: "Manager Approval" (approval — branch A)
│       └─ Step: "VP Approval" (approval — branch B)
│
├─ Stage: "Resolution" (Primary)
│   └─ Process: "Settlement" (sequential)
│       └─ Step: "Process Payment" (assignment)
│
├─ Stage: "Rejection" (Alternate)
│   └─ Process: "Reject Flow" (sequential)
│       └─ Step: "Send Rejection Notice" (automation)
│
└─ Stage: "Withdrawal" (Alternate)
    └─ Process: "Withdraw Flow" (sequential)
        └─ Step: "Record Withdrawal" (automation)
```

### Key Rules (from Pega)

1. **Every case type has a mandatory "Create" stage** — first stage, collects initial info
2. **Primary stages** = happy path (auto-advance left to right)
3. **Alternate stages** = exceptions (rejection, withdrawal, escalation) — jumped to via `change_stage` action
4. **Stage completion options:**
   - `auto_advance` — move to next stage when all processes complete (default)
   - `wait_for_user` — stay, require manual advance
   - `resolve_case` — end the case with a resolution status
5. **Processes within a stage** can run sequentially (one after another) or in parallel
6. **Steps within a process** always run sequentially
7. **When a step completes → engine checks if process is done → checks if stage is done → auto-advances**

---

## 3. Data Models

### 3.1 Case Type Definition (Blueprint)

**Collection:** `case_type_definitions`

```python
# models/case_types.py

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
    auto_advance = "auto_advance"     # move to next primary stage
    wait_for_user = "wait_for_user"   # require manual advance
    resolve_case = "resolve_case"     # end the case

class ProcessType(str, Enum):
    sequential = "sequential"
    parallel = "parallel"

# --- Step Configuration Models (per step type) ---

class AssignmentStepConfig(BaseModel):
    assignee_role: str                          # e.g. "WORKER", "ANALYST"
    assignee_user_id: Optional[str] = None      # specific user (overrides role)
    form_id: Optional[str] = None               # linked form definition
    instructions: Optional[str] = None
    set_case_status: Optional[str] = None       # set case status on entry

class ApprovalStepConfig(BaseModel):
    mode: str = "sequential"                    # sequential | parallel
    approver_roles: list[str] = []              # e.g. ["MANAGER", "VP"]
    approver_user_ids: list[str] = []           # specific users
    allow_delegation: bool = True
    rejection_stage_id: Optional[str] = None    # jump to alternate stage on reject

class AttachmentStepConfig(BaseModel):
    categories: list[str] = []                  # required document categories
    min_files: int = 1
    allowed_types: list[str] = []               # e.g. ["pdf", "jpg", "png"]
    max_file_size_mb: int = 25
    instructions: Optional[str] = None

class DecisionStepConfig(BaseModel):
    mode: str = "first_match"                   # first_match | decision_table
    branches: list[DecisionBranch] = []
    decision_table_id: Optional[str] = None
    default_step_id: Optional[str] = None       # fallback if no match

class DecisionBranch(BaseModel):
    id: str
    label: str
    condition: dict                             # rule engine expression
    next_step_id: str                           # jump to this step

class AutomationAction(BaseModel):
    type: str                                   # set_field | call_webhook | send_notification
                                                # | evaluate_rules | change_stage | create_assignment
    config: dict = {}                           # type-specific config

class AutomationStepConfig(BaseModel):
    actions: list[AutomationAction] = []
    rules: list[AutomationRule] = []            # condition → actions
    webhook: Optional[WebhookConfig] = None

class AutomationRule(BaseModel):
    condition: dict                             # rule engine expression
    actions: list[AutomationAction] = []

class WebhookConfig(BaseModel):
    url: str
    method: str = "POST"
    headers: dict = {}
    body_template: dict = {}
    response_map: dict = {}                     # response field → case field

class SubprocessStepConfig(BaseModel):
    child_case_type_id: str
    field_mapping: dict = {}                    # parent field → child field
    wait_for_resolution: bool = True
    propagate_fields: dict = {}                 # child field → parent field on resolve

# --- Step Definition ---

class StepDefinition(BaseModel):
    id: str
    name: str
    type: StepType
    order: int
    required: bool = True
    skip_when: Optional[dict] = None            # rule engine condition
    visible_when: Optional[dict] = None
    sla_hours: Optional[int] = None
    config: dict = {}                           # AssignmentStepConfig | ApprovalStepConfig | etc.

# --- Process Definition ---

class ProcessDefinition(BaseModel):
    id: str
    name: str
    type: ProcessType = ProcessType.sequential
    order: int
    is_parallel: bool = False                   # true = starts in parallel with previous process
    start_when: Optional[dict] = None           # condition to start (default: always)
    sla_hours: Optional[int] = None
    steps: list[StepDefinition] = []

# --- Stage Definition ---

class StageDefinition(BaseModel):
    id: str
    name: str
    stage_type: StageType = StageType.primary
    order: int
    on_complete: StageCompletionAction = StageCompletionAction.auto_advance
    resolution_status: Optional[str] = None     # used when on_complete = resolve_case
    skip_when: Optional[dict] = None            # skip stage if condition true
    entry_criteria: Optional[dict] = None       # validate before entering
    required_attachments: list[str] = []        # attachment categories required for entry
    delete_open_assignments: bool = True        # on resolution, clean up
    resolve_child_cases: bool = True
    sla_hours: Optional[int] = None
    processes: list[ProcessDefinition] = []

# --- Case Type Definition ---

class CaseTypeDefinition(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: str = "folder"
    prefix: str = "CASE"                        # case ID prefix e.g. "LOAN", "CLM"
    field_schema: dict = {}                     # custom case fields definition
    stages: list[StageDefinition] = []
    attachment_categories: list[AttachmentCategory] = []
    case_wide_actions: list[str] = []           # actions available throughout case lifecycle
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    version: int = 1
    is_active: bool = True

class AttachmentCategory(BaseModel):
    id: str
    name: str
    required_for_resolution: bool = False
    allowed_types: list[str] = []
```

### 3.2 Case Runtime Instance

**Collection:** `cases`

```python
# models/cases.py

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
    waiting = "waiting"                 # subprocess waiting for child

class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

# --- Runtime state mirrors the blueprint hierarchy ---

class StepInstance(BaseModel):
    definition_id: str                          # links to StepDefinition.id
    name: str
    type: StepType
    status: ItemStatus = ItemStatus.pending
    order: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    assigned_to: Optional[str] = None           # user ID
    form_submission_id: Optional[str] = None
    approval_chain_id: Optional[str] = None
    child_case_id: Optional[str] = None         # for subprocess
    decision_branch_taken: Optional[str] = None # which branch was selected
    skipped_reason: Optional[str] = None
    notes: Optional[str] = None
    sla_target: Optional[str] = None            # deadline datetime

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

# --- Case Instance ---

class CaseInstance(BaseModel):
    id: str                                     # e.g. "LOAN-001"
    case_type_id: str                           # links to CaseTypeDefinition.id
    case_type_name: str
    title: str
    status: CaseStatus = CaseStatus.open
    priority: Priority = Priority.medium
    owner_id: str
    team_id: Optional[str] = None
    custom_fields: dict = {}                    # case-specific data
    
    # Current position pointers
    current_stage_id: Optional[str] = None
    current_process_id: Optional[str] = None
    current_step_id: Optional[str] = None
    
    # Full nested runtime state
    stages: list[StageInstance] = []
    
    # Metadata
    created_by: str
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None
    resolution_status: Optional[str] = None
    parent_case_id: Optional[str] = None        # if this is a child case
    parent_step_id: Optional[str] = None        # which subprocess step spawned this
    
    # SLA
    sla_target_date: Optional[str] = None
    sla_days_remaining: Optional[int] = None
    escalation_level: int = 0

# --- Request/Response Models ---

class CaseCreateRequest(BaseModel):
    case_type_id: str
    title: str
    priority: Priority = Priority.medium
    owner_id: Optional[str] = None
    team_id: Optional[str] = None
    custom_fields: dict = {}

class CaseResponse(BaseModel):
    # Full case with nested stages/processes/steps
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
    form_data: Optional[dict] = None            # inline form submission
    decision: Optional[str] = None              # for approval: "approved" | "rejected"
    delegate_to: Optional[str] = None           # for approval delegation

class AdvanceStageRequest(BaseModel):
    notes: Optional[str] = None                 # for manual stage advance

class ChangeStageRequest(BaseModel):
    target_stage_id: str                        # jump to alternate stage
    reason: str
```

### 3.3 Assignments (Materialized View)

**Collection:** `assignments`

```python
# models/assignments.py

class AssignmentStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    on_hold = "on_hold"

class AssignmentType(str, Enum):
    form = "form"                   # fill a form
    approval = "approval"           # approve/reject
    attachment = "attachment"       # upload documents
    action = "action"               # generic user action

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
    priority: Priority                          # inherited from case
    assigned_to: Optional[str] = None           # user ID
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
    decision: Optional[str] = None              # approved | rejected (for approval type)
    delegate_to: Optional[str] = None
```

### 3.4 Rules & Decision Tables

**Collection:** `decision_tables`

```python
# models/rules.py

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

# Simple condition
class Condition(BaseModel):
    field: str
    operator: Operator
    value: Any = None                           # not needed for is_empty/is_not_empty

# Compound condition (recursive)
class CompoundCondition(BaseModel):
    all: Optional[list] = None                  # AND — all must be true
    any: Optional[list] = None                  # OR — at least one
    # Each item is either a Condition or another CompoundCondition

# Rule Action
class RuleAction(BaseModel):
    type: str                                   # set_field | send_notification | change_stage
                                                # | create_assignment | call_webhook
    field: Optional[str] = None
    value: Any = None
    config: dict = {}

# Decision Table
class DecisionTableRow(BaseModel):
    conditions: dict                            # CompoundCondition as dict
    output: Any                                 # result value
    priority: int = 0                           # higher = evaluated first

class DecisionTableCreate(BaseModel):
    name: str
    description: Optional[str] = None
    inputs: list[str] = []                      # field names used
    output_field: str                           # result field name
    rows: list[DecisionTableRow] = []
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
    condition: dict                             # Condition or CompoundCondition
    data: dict                                  # field values to test against

class RuleEvaluateResponse(BaseModel):
    result: bool
    matched_conditions: list[str] = []          # which conditions matched
    evaluation_path: list[str] = []             # trace of evaluation
```

---

## 4. Rule Engine

### Location: `engine/rule_engine.py`

### Expression Evaluation

```python
class RuleEngine:
    """
    Evaluates conditions against a data context (case fields).
    Supports: simple conditions, AND (all), OR (any), nested compounds.
    """
    
    def evaluate(self, condition: dict, data: dict) -> bool:
        """
        Entry point. Accepts:
        - Simple: {"field": "amount", "operator": "gt", "value": 100}
        - Compound: {"all": [...]} or {"any": [...]}
        - Nested: {"all": [{"any": [...]}, {"field": ...}]}
        """
    
    def _evaluate_simple(self, condition: dict, data: dict) -> bool:
        """Evaluates a single field/operator/value condition."""
    
    def _evaluate_compound(self, compound: dict, data: dict) -> bool:
        """Evaluates all/any compound with recursion."""
    
    def _get_field_value(self, data: dict, field_path: str) -> Any:
        """
        Supports dot-notation: "customer.address.city"
        Supports array indexing: "items[0].price"
        """
    
    def _compare(self, field_value, operator: str, target_value) -> bool:
        """
        All operator implementations with type coercion.
        """
```

### Operator Implementations

| Operator | Logic | Type Handling |
|---|---|---|
| `eq` | `field == value` | String comparison case-insensitive, number exact |
| `neq` | `field != value` | Same as eq, negated |
| `gt/gte/lt/lte` | Numeric/date comparison | Auto-coerce string→number, parse ISO dates |
| `contains` | `value in field` | String substring check |
| `not_contains` | `value not in field` | Negated contains |
| `in` | `field in [values]` | Value must be a list |
| `not_in` | `field not in [values]` | Negated in |
| `is_empty` | `field is None or ""` | No value needed |
| `is_not_empty` | `field is not None and != ""` | No value needed |
| `starts_with` | `field.startswith(value)` | String only |
| `ends_with` | `field.endswith(value)` | String only |
| `between` | `value[0] <= field <= value[1]` | Value must be [min, max] |
| `matches` | `re.match(value, field)` | Regex pattern match |

### Example Usage

```python
engine = RuleEngine()

# Simple
engine.evaluate(
    {"field": "loan_amount", "operator": "gt", "value": 100000},
    {"loan_amount": 150000}
)  # → True

# Compound AND
engine.evaluate(
    {"all": [
        {"field": "loan_amount", "operator": "gt", "value": 100000},
        {"field": "loan_type", "operator": "eq", "value": "commercial"}
    ]},
    {"loan_amount": 150000, "loan_type": "commercial"}
)  # → True

# Nested
engine.evaluate(
    {"all": [
        {"field": "status", "operator": "eq", "value": "verified"},
        {"any": [
            {"field": "amount", "operator": "gt", "value": 50000},
            {"field": "priority", "operator": "eq", "value": "critical"}
        ]}
    ]},
    {"status": "verified", "amount": 30000, "priority": "critical"}
)  # → True (status matches AND priority matches)
```

---

## 5. Decision Tables

### Location: `engine/decision_tables.py`

```python
class DecisionTableEngine:
    """
    Evaluates decision tables — ordered rows of conditions → output.
    """
    
    def evaluate(self, table: dict, data: dict) -> Any:
        """
        Iterate rows in priority order.
        Return output of first matching row.
        If no match, return default_output.
        """
    
    def evaluate_all(self, table: dict, data: dict) -> list:
        """Return ALL matching rows (for scoring/weighted decisions)."""
```

### Example Decision Table

**Loan Approval Routing:**

| # | loan_amount | loan_type | applicant_income | → approval_tier |
|---|---|---|---|---|
| 1 | ≤ 10,000 | personal | any | `auto_approve` |
| 2 | 10,001 – 100,000 | any | ≥ 50,000 | `manager_approval` |
| 3 | 10,001 – 100,000 | any | < 50,000 | `senior_manager_approval` |
| 4 | > 100,000 | any | any | `vp_approval` |
| 5 | any | commercial | any | `commercial_review` |
| default | — | — | — | `manager_approval` |

---

## 6. Case Lifecycle Engine

### Location: `engine/lifecycle.py`, `engine/step_engine.py`, `engine/process_engine.py`

### 6.1 Case Instantiation

```python
# engine/lifecycle.py

async def instantiate_case(case_type: dict, create_request: dict, user: dict) -> dict:
    """
    1. Load CaseTypeDefinition
    2. Generate case ID with prefix (e.g. LOAN-001)
    3. Deep-copy stages → processes → steps into runtime instances
    4. Set first primary stage to in_progress
    5. Start first process in that stage
    6. Activate first step in that process (create assignment if human step)
    7. Insert case document + assignment document
    8. Return case instance
    """

async def advance_case(case_id: str) -> dict:
    """
    Called after any step/process/stage completion.
    Walks up the hierarchy:
    1. Check if current process is complete → start next process or complete stage
    2. Check if current stage is complete → evaluate on_complete action
    3. If auto_advance → evaluate next stage's skip_when + entry_criteria → enter or skip
    4. If resolve_case → resolve case with status
    5. If wait_for_user → park (manual advance needed)
    """

async def change_stage(case_id: str, target_stage_id: str, reason: str, user: dict) -> dict:
    """
    Jump to an alternate stage (or any stage).
    1. Cancel all open assignments in current stage
    2. Mark current stage as cancelled
    3. Enter target stage
    4. Start first process + step
    """

async def resolve_case(case_id: str, resolution_status: str, user: dict) -> dict:
    """
    1. Cancel all open assignments
    2. Resolve open child cases (if configured)
    3. Set case status to resolved_*
    4. Notify parent case if this is a child (complete subprocess step)
    """
```

### 6.2 Step Engine

```python
# engine/step_engine.py

async def activate_step(case: dict, stage_id: str, process_id: str, step: dict) -> dict:
    """
    1. Evaluate skip_when → if true, mark skipped, move to next step
    2. Based on step type:
       - assignment: create Assignment record, set SLA
       - approval: create ApprovalChain + Assignment
       - attachment: create Assignment with attachment requirements
       - decision: evaluate conditions immediately, branch to next_step_id
       - automation: execute actions immediately
       - subprocess: create child case, mark step as waiting
    3. Update case.current_step_id
    4. Send notifications
    """

async def complete_step(case_id: str, step_id: str, completion_data: dict, user: dict) -> dict:
    """
    1. Validate step can be completed (status check)
    2. Process completion data (form submission, approval decision, etc.)
    3. Mark step as completed
    4. Update corresponding assignment to completed
    5. Call process_engine.check_process_completion()
    """

async def handle_decision_step(case: dict, step: dict) -> str:
    """
    1. Load decision_config from step
    2. If mode = first_match: evaluate branches in order, return first match
    3. If mode = decision_table: delegate to DecisionTableEngine
    4. Return next_step_id (or default_step_id)
    5. Skip all steps between current and target step
    """

async def handle_automation_step(case: dict, step: dict) -> dict:
    """
    1. Load automation_config
    2. Execute each action:
       - set_field: update case.custom_fields
       - evaluate_rules: run condition → action rules
       - call_webhook: HTTP request, map response to case fields
       - send_notification: create notification
       - change_stage: trigger lifecycle.change_stage()
       - create_assignment: create ad-hoc assignment
    3. Auto-complete step
    """

async def handle_subprocess_step(case: dict, step: dict) -> dict:
    """
    1. Load subprocess_config
    2. Map parent fields to child fields
    3. Call lifecycle.instantiate_case() for child case type
    4. Set parent step status to 'waiting'
    5. Register callback: when child resolves, complete this step
    """
```

### 6.3 Process Engine

```python
# engine/process_engine.py

async def start_process(case: dict, stage_id: str, process: dict) -> dict:
    """
    1. Evaluate start_when → if false, mark skipped
    2. Set process status to in_progress
    3. Activate first step
    """

async def check_process_completion(case: dict, stage_id: str, process_id: str) -> bool:
    """
    1. Check all steps: if all completed/skipped → process is complete
    2. If not complete, find next pending step → activate it
    3. If complete, call check_stage_completion()
    """

async def start_next_process(case: dict, stage_id: str) -> dict:
    """
    1. Find next process by order
    2. If is_parallel, start it alongside current
    3. If sequential, start only after current completes
    """

async def check_stage_completion(case: dict, stage_id: str) -> bool:
    """
    1. Check all processes: if all completed/skipped → stage is complete
    2. Apply on_complete action:
       - auto_advance: call lifecycle.advance_case()
       - wait_for_user: set stage to 'completed', wait for manual advance
       - resolve_case: call lifecycle.resolve_case()
    """
```

### 6.4 Flow Diagram

```
User completes assignment
         │
         ▼
 ┌─ complete_step() ─┐
 │  - validate        │
 │  - save form data  │
 │  - mark step done  │
 └────────┬───────────┘
          │
          ▼
 ┌─ check_process_completion() ─┐
 │  All steps done?              │
 │  ├─ NO → activate_next_step()│
 │  └─ YES ──────────────────── │─┐
 └───────────────────────────────┘ │
                                   ▼
                    ┌─ check_stage_completion() ─┐
                    │  All processes done?         │
                    │  ├─ NO → start_next_process()│
                    │  └─ YES ─────────────────── │─┐
                    └──────────────────────────────┘ │
                                                     ▼
                                      ┌─ on_complete action ────────┐
                                      │  auto_advance:               │
                                      │    → evaluate next stage     │
                                      │    → skip_when? entry check  │
                                      │    → enter next stage        │
                                      │  wait_for_user:              │
                                      │    → park, show "Advance"    │
                                      │  resolve_case:               │
                                      │    → resolve with status     │
                                      └────────────────────────────┘
```

---

## 7. Step Types — Detailed Behavior

### 7.1 Assignment Step

**What happens when activated:**
1. Create an `Assignment` record in assignments collection
2. Route to specific user (if `assignee_user_id` set) or to role-based worklist
3. Set SLA deadline if configured
4. Send notification to assignee

**Worker experience:**
- Assignment appears in "My Work" list
- Click → opens case with form (if form_id set)
- Fill form, click "Submit" → step completes
- If no form, generic "Complete" action

**What happens on completion:**
1. Save form submission (if form data provided)
2. Mark step completed, mark assignment completed
3. Engine checks next step

### 7.2 Approval Step

**What happens when activated:**
1. Create `ApprovalChain` in approvals collection (reuse existing model)
2. Create `Assignment` of type `approval` for first approver (sequential) or all (parallel)
3. Notify approvers

**Worker experience:**
- Assignment appears with "Approve / Reject" actions
- Can add notes/comments
- Can delegate to another user

**What happens on completion:**
- If approved (all required): mark step completed, engine advances
- If rejected: jump to `rejection_stage_id` (alternate stage) if configured, otherwise mark step as completed with rejection note

### 7.3 Attachment Step

**What happens when activated:**
1. Create `Assignment` of type `attachment`
2. Specify required categories, min files, allowed types

**Worker experience:**
- Assignment shows upload zone with requirements
- "Required: Upload at least 1 document of type 'Claims Proof' (PDF, JPG)"
- Cannot submit until requirements met

**What happens on completion:**
1. Validate min_files per category
2. Link uploaded documents to case + step
3. Mark step completed

### 7.4 Decision Step

**Fully automatic — no human interaction.**

**What happens when activated:**
1. Engine evaluates case fields against branch conditions
2. First matching branch → set `next_step_id`
3. All steps between current position and `next_step_id` are skipped
4. Step auto-completes, records which branch was taken
5. Engine activates the target step

### 7.5 Automation Step

**Fully automatic — no human interaction.**

**What happens when activated:**
1. Execute actions in order:
   - `set_field`: update case custom_fields
   - `evaluate_rules`: run each rule's condition, execute matching actions
   - `call_webhook`: make HTTP request, map response fields back to case
   - `send_notification`: create notification for user/role
   - `change_stage`: jump to another stage (triggers stage change flow)
   - `create_assignment`: dynamically create an ad-hoc assignment
2. Step auto-completes

### 7.6 Subprocess Step

**What happens when activated:**
1. Create a child case from `child_case_type_id`
2. Copy fields from parent to child per `field_mapping`
3. Set parent step status to `waiting`

**What happens when child resolves:**
1. Copy fields from child to parent per `propagate_fields`
2. Mark parent step as completed
3. Engine advances parent case

---

## 8. API Endpoints

### 8.1 Case Types (Admin)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/case-types` | Create case type definition |
| `GET` | `/api/case-types` | List all case types |
| `GET` | `/api/case-types/{id}` | Get case type with full hierarchy |
| `PATCH` | `/api/case-types/{id}` | Update case type (increments version) |
| `DELETE` | `/api/case-types/{id}` | Soft delete case type |
| `POST` | `/api/case-types/{id}/stages` | Add stage to case type |
| `PATCH` | `/api/case-types/{id}/stages/{stage_id}` | Update stage |
| `DELETE` | `/api/case-types/{id}/stages/{stage_id}` | Remove stage |
| `POST` | `/api/case-types/{id}/stages/{stage_id}/processes` | Add process |
| `PATCH` | `/api/case-types/{id}/stages/{sid}/processes/{pid}` | Update process |
| `DELETE` | `/api/case-types/{id}/stages/{sid}/processes/{pid}` | Remove process |
| `POST` | `/api/case-types/{id}/stages/{sid}/processes/{pid}/steps` | Add step |
| `PATCH` | `/api/case-types/{id}/stages/{sid}/processes/{pid}/steps/{step_id}` | Update step |
| `DELETE` | `/api/case-types/{id}/stages/{sid}/processes/{pid}/steps/{step_id}` | Remove step |
| `POST` | `/api/case-types/{id}/validate` | Validate case type definition |
| `POST` | `/api/case-types/{id}/duplicate` | Clone case type |

### 8.2 Cases (Worker Portal)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/cases` | Create case (instantiates from case type) |
| `GET` | `/api/cases` | List cases (filters: status, priority, owner, team, case_type) |
| `GET` | `/api/cases/{id}` | Get case with full nested state |
| `PATCH` | `/api/cases/{id}` | Update case fields |
| `POST` | `/api/cases/{id}/steps/{step_id}/complete` | Complete a step |
| `POST` | `/api/cases/{id}/advance` | Manually advance stage (for wait_for_user) |
| `POST` | `/api/cases/{id}/change-stage` | Jump to alternate stage |
| `POST` | `/api/cases/{id}/resolve` | Resolve case |
| `POST` | `/api/cases/{id}/withdraw` | Withdraw case |
| `GET` | `/api/cases/{id}/history` | Full audit trail |
| `GET` | `/api/cases/{id}/assignments` | List assignments for this case |

### 8.3 Assignments (Worker Portal)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/assignments` | List assignments (filters: assigned_to, role, status, case_type, priority) |
| `GET` | `/api/assignments/my` | My open assignments |
| `GET` | `/api/assignments/{id}` | Get assignment detail |
| `POST` | `/api/assignments/{id}/complete` | Complete assignment |
| `POST` | `/api/assignments/{id}/reassign` | Reassign to another user |
| `POST` | `/api/assignments/{id}/hold` | Put on hold |
| `POST` | `/api/assignments/{id}/resume` | Resume from hold |

### 8.4 Decision Tables (Admin)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/decision-tables` | Create decision table |
| `GET` | `/api/decision-tables` | List decision tables |
| `GET` | `/api/decision-tables/{id}` | Get decision table |
| `PATCH` | `/api/decision-tables/{id}` | Update decision table |
| `DELETE` | `/api/decision-tables/{id}` | Delete decision table |
| `POST` | `/api/decision-tables/{id}/evaluate` | Test evaluation with sample data |

### 8.5 Rules (Admin)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rules/evaluate` | Evaluate a condition against data |
| `POST` | `/api/rules/validate` | Validate condition syntax |

### 8.6 Existing Endpoints (Kept/Enhanced)

| Endpoint Group | Changes |
|---|---|
| `/api/auth/*` | Unchanged |
| `/api/users/*` | Unchanged |
| `/api/teams/*` | Unchanged |
| `/api/comments/*` | Unchanged |
| `/api/audit-logs/*` | Unchanged |
| `/api/notifications/*` | Enhanced — step/process/stage-level triggers |
| `/api/approvals/*` | Refactored — approval decisions trigger step completion |
| `/api/documents/*` | Enhanced — step-level linking, attachment step satisfaction |
| `/api/sla/*` | Enhanced — SLA at stage/process/step levels |
| `/api/forms/*` | Enhanced — form submission triggers step completion |
| `/api/workflows/*` | Repurposed — process-level visual designer |
| `/api/ai/*` | Unchanged (Phase 3) |
| `/api/config/*` | Unchanged (Phase 3) |
| WebSocket | Enhanced — step/stage/process status events |

---

## 9. Admin UI — Case Type Designer (App Studio)

### 9.1 Route Structure

```
/admin/case-types                     → Case type list
/admin/case-types/new                 → Create new case type
/admin/case-types/:id/designer        → Case Type Designer (main config screen)
/admin/case-types/:id/data-model      → Field schema editor
/admin/case-types/:id/views           → Form definitions for this type
/admin/case-types/:id/settings        → Case type settings (prefix, SLA, attachments)
/admin/decision-tables                → Decision table list
/admin/decision-tables/:id            → Decision table editor
/admin/forms                          → Form builder (existing, enhanced)
/admin/workflows                      → Process designer (repurposed)
/admin/users                          → User management (existing)
/admin/teams                          → Team management (existing)
```

### 9.2 Case Type Designer — Main Screen

**Layout (mirrors Pega Case Designer):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Case Types    Loan Origination           💾 Save  ▶ Run │
├──────────────────────────────────────────────────────────────────────┤
│  [Workflow]  [Data Model]  [Views]  [Settings]                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐       │
│  │ Create  │→ │ Investigation│→ │ Approval │→ │ Resolution │       │
│  │ ★       │  │              │  │          │  │            │       │
│  └────┬────┘  └──────┬───────┘  └────┬─────┘  └─────┬──────┘       │
│       │              │               │               │              │
│  ┌────┴──────────────┴───────────────┴───────────────┘              │
│  │                                                                   │
│  │  ┌─────────────────────────────┐    ┌──────────────────────┐     │
│  │  │ 📋 Collect Information      │    │  ⚙ Stage Config      │     │
│  │  │ (sequential process)        │    │                      │     │
│  │  │                             │    │  On complete:        │     │
│  │  │  ① Fill Application Form   │    │  ● Auto advance      │     │
│  │  │     📝 assignment + form    │    │  ○ Wait for user     │     │
│  │  │                             │    │  ○ Resolve case      │     │
│  │  │  ② Upload Documents        │    │                      │     │
│  │  │     📎 attachment           │    │  Skip when:          │     │
│  │  │                             │    │  [condition builder] │     │
│  │  │  [+ Add Step]              │    │                      │     │
│  │  └─────────────────────────────┘    │  Entry criteria:     │     │
│  │                                      │  [condition builder] │     │
│  │  [+ Add Process]                    │                      │     │
│  │  [+ Add Parallel Process]           │  SLA (hours): [48]   │     │
│  │                                      └──────────────────────┘     │
│  └───────────────────────────────────────────────────────────────    │
│                                                                      │
│  ALTERNATE STAGES                                                    │
│  ┌─────────────┐  ┌─────────────┐                                   │
│  │ Rejection   │  │ Withdrawal  │  [+ Alternate Stage]              │
│  └─────────────┘  └─────────────┘                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.3 Stage Configuration Panel (Right Side)

When admin clicks a stage, the right panel shows:

**General Tab:**
- Stage name (editable)
- Stage type (Primary / Alternate) — read-only for Create stage
- On complete: radio buttons (Auto advance / Wait for user / Resolve case)
- If resolve: Resolution status dropdown
- [x] Delete open assignments upon resolution
- [x] Resolve open child cases

**Validation Tab:**
- Skip stage when: [Rule Builder component]
- Entry validation: [Rule Builder component]
- Required attachments: multi-select of attachment categories

**Goal & Deadline Tab:**
- SLA hours target
- Escalation enabled toggle
- Escalate to role

### 9.4 Process Configuration Panel

When admin clicks a process:
- Process name
- Type: Sequential / Parallel
- Start when: condition builder (default: Always)
- SLA hours

### 9.5 Step Configuration Panel

When admin clicks a step:

**Common:**
- Step name
- Step type dropdown: Assignment / Approval / Attachment / Decision / Automation / Subprocess
- Required toggle
- Skip when: condition builder
- SLA hours

**Assignment-specific:**
- Route to: Role dropdown / Specific user picker
- Form: dropdown of form definitions
- Instructions textarea
- Set case status on entry

**Approval-specific:**
- Mode: Sequential / Parallel
- Approver roles: multi-select
- Specific approvers: user picker
- Allow delegation toggle
- On rejection: stage picker (alternate stages)

**Attachment-specific:**
- Required categories: multi-select
- Min files: number
- Allowed file types: chip input
- Max file size (MB)
- Instructions

**Decision-specific:**
- Mode: First match / Decision table
- Branches: list of { label, condition (rule builder), next step (dropdown) }
- Default step: dropdown
- Or: Decision table picker

**Automation-specific:**
- Actions list: each with type selector + config
- Rules list: each with condition (rule builder) + actions
- Webhook config (URL, method, headers, body template, response mapping)

**Subprocess-specific:**
- Child case type: dropdown
- Field mapping: parent field → child field (key-value pairs)
- Wait for resolution toggle
- Propagate fields on resolve: child field → parent field

### 9.6 Add Step Menu (mirrors Pega)

```
[+ Add Step]
├── 📝 Collect Information (assignment)
├── ✅ Approve / Reject (approval)
├── 📎 Upload Documents (attachment)
├── 🔀 Decision (decision)
├── ⚡ Automation (automation)
└── 📦 Subprocess (subprocess)
```

### 9.7 Rule Builder Component (Reusable)

Visual condition editor used throughout the admin UI:

```
┌────────────────────────────────────────────────────────────────┐
│  ALL of the following ▼                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ [loan_amount ▼]  [is greater than ▼]  [100000    ]  │ ✕    │
│  └──────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ [loan_type   ▼]  [equals          ▼]  [commercial]  │ ✕    │
│  └──────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ ANY of the following ▼                                │      │
│  │  ┌────────────────────────────────────────────────┐  │      │
│  │  │ [risk_level ▼]  [equals ▼]  [high      ]      │  │ ✕    │
│  │  └────────────────────────────────────────────────┘  │      │
│  │  ┌────────────────────────────────────────────────┐  │      │
│  │  │ [amount     ▼]  [≥       ▼]  [50000     ]     │  │ ✕    │
│  │  └────────────────────────────────────────────────┘  │      │
│  │  [+ Add condition]                                    │      │
│  └──────────────────────────────────────────────────────┘      │
│  [+ Add condition]  [+ Add group]                              │
└────────────────────────────────────────────────────────────────┘
```

### 9.8 Decision Table Editor

Spreadsheet-style UI:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Loan Routing Decision Table                                   💾 Save    │
├────────────────────────────────────────────────────────────────────────────┤
│  Inputs: loan_amount, loan_type, applicant_income                         │
│  Output: approval_tier                                                    │
├────────┬────────────┬──────────────────┬────────────────┬─────────────────┤
│  #     │ loan_amount│ loan_type        │ applicant_inc. │ → approval_tier │
├────────┼────────────┼──────────────────┼────────────────┼─────────────────┤
│  1     │ ≤ 10,000   │ personal         │ —              │ auto_approve    │
│  2     │ 10K – 100K │ —                │ ≥ 50,000       │ manager         │
│  3     │ 10K – 100K │ —                │ < 50,000       │ senior_manager  │
│  4     │ > 100,000  │ —                │ —              │ vp_approval     │
│  5     │ —          │ commercial       │ —              │ commercial_rev  │
├────────┼────────────┼──────────────────┼────────────────┼─────────────────┤
│ Default│ —          │ —                │ —              │ manager         │
├────────┴────────────┴──────────────────┴────────────────┴─────────────────┤
│  [+ Add Row]                                                              │
│                                                                           │
│  🧪 Test: loan_amount: [150000] loan_type: [personal] income: [80000]    │
│  Result: vp_approval ✅                                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. User UI — Case Worker Portal

### 10.1 Route Structure

```
/portal/dashboard                     → Worker dashboard (my stats, open cases)
/portal/cases                         → Case list (all cases I can see)
/portal/cases/new                     → Create new case (pick type, fill create form)
/portal/cases/:id                     → Case View (★ main screen — run case here)
/portal/assignments                   → My Assignments (worklist)
/portal/approvals                     → Pending approvals
/portal/documents                     → Documents (existing)
/portal/sla                           → SLA dashboard (existing)
```

### 10.2 Case List Page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Cases                                              [+ Create Case]     │
├──────────────────────────────────────────────────────────────────────────┤
│  🔍 Search cases...     [Type ▼]  [Status ▼]  [Priority ▼]  [Team ▼]  │
├──────┬────────────────────┬────────────────┬────────┬──────┬────────────┤
│  ID  │ Title              │ Type           │ Stage  │ Pri  │ Assigned   │
├──────┼────────────────────┼────────────────┼────────┼──────┼────────────┤
│LOAN-1│ Loan App - J. Doe  │ Loan Origin.   │ Review │ 🔴   │ Alice M.   │
│CLM-3 │ Roof Damage Claim  │ Insurance Clm  │ Invest │ 🟡   │ Bob W.     │
│KYC-7 │ Acme Corp Onboard  │ KYC Onboard    │ Create │ 🟢   │ Carol W.   │
├──────┴────────────────────┴────────────────┴────────┴──────┴────────────┤
│  Showing 1-10 of 45                              ◀ 1 2 3 4 5 ▶         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Case Create Page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back    Create New Case                                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Select Case Type:                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ 🏦               │  │ 🛡️              │  │ 👤               │       │
│  │ Loan Origination │  │ Insurance Claims │  │ KYC Onboarding   │       │
│  │                  │  │                  │  │                  │       │
│  │ 5 stages         │  │ 4 stages         │  │ 5 stages         │       │
│  │ Loan processing  │  │ Claims handling  │  │ Customer verify  │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                          │
│  ─── After selecting type ───                                            │
│                                                                          │
│  Case Title:  [Loan Application - ________________]                      │
│  Priority:    [Medium ▼]                                                 │
│  Team:        [Loan Processing ▼]                                        │
│                                                                          │
│  Lifecycle Preview:                                                      │
│  ┌────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐            │
│  │ Create │→ │Investigation │→ │ Approval │→ │ Resolution │            │
│  └────────┘  └──────────────┘  └──────────┘  └────────────┘            │
│                                                                          │
│                                              [Cancel]  [Create Case →]   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Case View Page (★ Main Case Run Screen)

This is the **primary screen** where users interact with a running case. It mirrors Pega's User Portal case view.

**Layout:**

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ← Cases    LOAN-001: Loan Application - John Doe          🔴 High  🏦 Loan  │
│             Status: In Progress    Owner: Alice M.    Team: Loan Processing    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────────── STAGE PROGRESS BAR (Chevrons) ─────────────────────┐       │
│  │                                                                     │       │
│  │  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐  │       │
│  │  │✓ Create │ ▶  │● Investigate │ ▶  │  Approve │ ▶  │ Resolve  │  │       │
│  │  │ (done)  │    │  (current)   │    │ (pending)│    │(pending) │  │       │
│  │  └─────────┘    └──────────────┘    └──────────┘    └──────────┘  │       │
│  │                                                                     │       │
│  │  Alternate: [Rejection] [Withdrawal]                                │       │
│  └─────────────────────────────────────────────────────────────────────┘       │
│                                                                                │
├───────────────────────────────────────────┬────────────────────────────────────┤
│                                           │                                    │
│  CURRENT STAGE: Investigation             │  CASE DETAILS (Right Panel)        │
│  ─────────────────────────────            │  ──────────────────────────        │
│                                           │                                    │
│  📋 Process: Verify Documents             │  Case Fields:                      │
│  ─────────────────────────────            │  ┌─────────────────────────┐      │
│                                           │  │ Loan Amount:  $150,000  │      │
│  ┌─────────────────────────────────┐     │  │ Loan Type:    Personal  │      │
│  │ ① Credit Check          ✅ Done │     │  │ Applicant:    John Doe  │      │
│  │    Automation • Completed 3/19  │     │  │ Income:       $85,000   │      │
│  └─────────────────────────────────┘     │  │ Credit Score: 720       │      │
│                                           │  └─────────────────────────┘      │
│  ┌─────────────────────────────────┐     │                                    │
│  │ ② Review Results   🔵 Active   │     │  Attachments:                      │
│  │    Assignment • Bob W.          │     │  📄 W2_2025.pdf                    │
│  │    ┌─────────────────────────┐  │     │  📄 Bank_Statement.pdf             │
│  │    │                         │  │     │  [+ Upload]                        │
│  │    │   📝 REVIEW FORM        │  │     │                                    │
│  │    │                         │  │     │  Comments:                         │
│  │    │   Findings: [________]  │  │     │  💬 Alice: Docs look good          │
│  │    │   Rating:   [Good  ▼]   │  │     │  💬 Bob: Credit score verified     │
│  │    │   Notes:    [________]  │  │     │  [+ Add comment]                   │
│  │    │                         │  │     │                                    │
│  │    │   [Submit & Complete →] │  │     │  Activity Timeline:                │
│  │    │                         │  │     │  ● Stage "Create" completed        │
│  │    └─────────────────────────┘  │     │  ● Assignment completed by Alice   │
│  └─────────────────────────────────┘     │  ● Credit check: score 720         │
│                                           │  ● Review assigned to Bob          │
│  📋 Process: Risk Assessment (Parallel)  │                                    │
│  ─────────────────────────────            │  SLA:                              │
│                                           │  ⏱ 18h remaining (of 48h)         │
│  ┌─────────────────────────────────┐     │  ████████████░░░░ 62%              │
│  │ ① Evaluate Risk    ⏳ Pending   │     │                                    │
│  │    Assignment • Unassigned      │     │                                    │
│  └─────────────────────────────────┘     │                                    │
│                                           │                                    │
├───────────────────────────────────────────┴────────────────────────────────────┤
│  Actions: [Withdraw Case]  [Change Stage ▼]  [Reassign]          [AI Copilot] │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 10.5 Stage Progress Bar Component

Visual chevron-style stage indicator (like Pega):

```
Completed stages:  green background, checkmark icon
Current stage:     indigo/blue background, filled dot, bold text
Pending stages:    gray/light background, empty circle
Skipped stages:    gray with strikethrough
Alternate stages:  shown below as small pills/chips, click to view
```

**CSS/Tailwind approach:**
```
Each chevron is a div with:
- clip-path for the arrow shape
- Background color per status
- Transition animation on stage change
- Responsive: collapses to vertical on mobile
```

### 10.6 Step Card States

| State | Visual | Icon | Colors |
|---|---|---|---|
| Pending | Grayed out, no interaction | ○ | `bg-slate-50 border-slate-200 text-slate-400` |
| Active (mine) | Highlighted, form visible, action buttons | 🔵 | `bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200` |
| Active (others) | Highlighted, shows assignee | 🔵 | `bg-blue-50 border-blue-200` |
| Completed | Green checkmark, timestamp shown | ✅ | `bg-emerald-50 border-emerald-200 text-emerald-700` |
| Skipped | Dimmed with skip reason | ⏭ | `bg-slate-50 border-dashed text-slate-400 line-through` |
| Waiting | Pulse animation (subprocess) | ⏳ | `bg-amber-50 border-amber-200 animate-pulse` |
| Decision (taken) | Shows branch label | 🔀 | `bg-purple-50 border-purple-200` |
| Automation (done) | System icon, auto-completed | ⚡ | `bg-cyan-50 border-cyan-200` |

### 10.7 Assignment Work Panel

When a step is active AND assigned to the current user, the step card **expands** to show the work panel:

**For Assignment steps:**
```
┌─────────────────────────────────────────────────┐
│ ② Fill Application Form               🔵 Active │
│    📝 Assignment • Assigned to: You              │
│    Instructions: Complete the loan application   │
│    SLA: 22h remaining                            │
│  ┌─────────────────────────────────────────────┐ │
│  │           EMBEDDED FORM                      │ │
│  │                                              │ │
│  │  Applicant Name: [John Doe          ]        │ │
│  │  Loan Amount:    [$150,000          ]        │ │
│  │  Loan Type:      [Personal         ▼]       │ │
│  │  Employment:     [Employed         ▼]        │ │
│  │  Annual Income:  [$85,000           ]        │ │
│  │                                              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Notes: [Optional notes...              ]        │
│                                                   │
│              [Save Draft]  [Submit & Complete →]  │
└───────────────────────────────────────────────────┘
```

**For Approval steps:**
```
┌─────────────────────────────────────────────────┐
│ ① Manager Approval                    🔵 Active │
│    ✅ Approval • Assigned to: You                │
│    SLA: 4h remaining                             │
│                                                   │
│  Case Summary:                                    │
│  Loan of $150,000 for John Doe (credit: 720)     │
│                                                   │
│  Decision Notes: [________________________]      │
│                                                   │
│  [Delegate ▼]    [❌ Reject]    [✅ Approve]     │
└───────────────────────────────────────────────────┘
```

**For Attachment steps:**
```
┌─────────────────────────────────────────────────┐
│ ② Upload Claims Proof                 🔵 Active │
│    📎 Attachment • Assigned to: You              │
│                                                   │
│  Required: Claims Proof (min 1 file)             │
│  Accepted: PDF, JPG, PNG (max 25MB)             │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │         ┌─────────────┐                      │ │
│  │         │  📁 Drop    │                      │ │
│  │         │  files here │                      │ │
│  │         └─────────────┘                      │ │
│  │  📄 claim_photo.jpg  (2.1 MB)  ✓  [✕]       │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│                           [Submit & Complete →]   │
└───────────────────────────────────────────────────┘
```

### 10.8 My Assignments Page (Worklist)

Replaces the old Tasks / Kanban board:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  My Assignments (5 open)                          [All ▼] [Priority ▼]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🔴 OVERDUE                                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ 📝 Review Credit Report                      LOAN-001         │     │
│  │    Loan Origination → Investigation → Verify Documents         │     │
│  │    🔴 High  •  ⏰ 2h overdue  •  Assigned: You                │     │
│  │                                              [Open Case →]     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  🟡 DUE SOON                                                            │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ ✅ Approve Claim                              CLM-003          │     │
│  │    Insurance Claims → Approval → Approval Flow                 │     │
│  │    🟡 Medium  •  ⏰ 4h left  •  Assigned: You                 │     │
│  │                                              [Open Case →]     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  🟢 ON TRACK                                                            │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ 📎 Upload KYC Documents                       KYC-007          │     │
│  │    KYC Onboarding → Create → Collect Information               │     │
│  │    🟢 Low  •  ⏰ 46h left  •  Assigned: You                   │     │
│  │                                              [Open Case →]     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 10.9 Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                          Welcome, Alice!      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │     12       │  │      5       │  │      2       │  │     89%    │  │
│  │ My Open      │  │  Due Today   │  │  Overdue     │  │  Resolved  │  │
│  │ Assignments  │  │              │  │              │  │  This Week │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                          │
│  ┌─── Active Cases by Stage ─────────────────────────────────────────┐  │
│  │  Create ████████ 8                                                 │  │
│  │  Review ████████████ 12                                            │  │
│  │  Approve ████ 4                                                    │  │
│  │  Resolve ██ 2                                                      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── Recent Assignments ────────────────────┐  ┌── SLA At Risk ─────┐  │
│  │  📝 Review Credit Report    LOAN-001 🔴   │  │ LOAN-003  ⚠ 75%   │  │
│  │  ✅ Approve Claim           CLM-003  🟡   │  │ CLM-005   🔴 120%  │  │
│  │  📎 Upload Documents        KYC-007  🟢   │  │ KYC-009   ⚠ 80%   │  │
│  └────────────────────────────────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Frontend State Management

### 11.1 Updated NgRx Stores

| Store | Changes | New/Modified |
|---|---|---|
| `auth/` | Unchanged | — |
| `cases/` | Remodeled for nested stages/processes/steps | Modified |
| `assignments/` | New — replaces `tasks/` | **New** |
| `case-types/` | New — admin CRUD for case type definitions | **New** |
| `decision-tables/` | New — admin CRUD for decision tables | **New** |
| `comments/` | Unchanged | — |
| `documents/` | Unchanged | — |
| `notifications/` | Unchanged | — |
| `approvals/` | Minor refactor — links to step completion | Modified |
| `workflows/` | Repurposed as process designer state | Modified |

### 11.2 Key Actions (Cases)

```typescript
// state/cases/cases.actions.ts
export const CasesActions = createActionGroup({
  source: 'Cases',
  events: {
    // List
    'Load Cases': props<{ filters?: CaseFilters }>(),
    'Load Cases Success': props<{ cases: CaseResponse[] }>(),
    'Load Cases Failure': props<{ error: string }>(),

    // Single
    'Load Case': props<{ id: string }>(),
    'Load Case Success': props<{ case: CaseResponse }>(),
    
    // Create
    'Create Case': props<{ request: CaseCreateRequest }>(),
    'Create Case Success': props<{ case: CaseResponse }>(),
    
    // Step actions
    'Complete Step': props<{ caseId: string; stepId: string; data: StepCompleteRequest }>(),
    'Complete Step Success': props<{ case: CaseResponse }>(),
    
    // Stage actions
    'Advance Stage': props<{ caseId: string; notes?: string }>(),
    'Change Stage': props<{ caseId: string; targetStageId: string; reason: string }>(),
    
    // Resolve
    'Resolve Case': props<{ caseId: string; status: string }>(),
    'Withdraw Case': props<{ caseId: string }>(),
  }
});
```

### 11.3 Key Actions (Assignments)

```typescript
// state/assignments/assignments.actions.ts
export const AssignmentActions = createActionGroup({
  source: 'Assignments',
  events: {
    'Load My Assignments': emptyProps(),
    'Load My Assignments Success': props<{ assignments: AssignmentResponse[] }>(),
    'Complete Assignment': props<{ id: string; data: AssignmentCompleteRequest }>(),
    'Complete Assignment Success': props<{ assignment: AssignmentResponse }>(),
    'Reassign Assignment': props<{ id: string; userId: string }>(),
    'Hold Assignment': props<{ id: string }>(),
    'Resume Assignment': props<{ id: string }>(),
  }
});
```

### 11.4 TypeScript Interfaces

```typescript
// core/models/index.ts — NEW interfaces

// --- Case Type Definition ---
interface StepDefinition {
  id: string;
  name: string;
  type: 'assignment' | 'approval' | 'attachment' | 'decision' | 'automation' | 'subprocess';
  order: number;
  required: boolean;
  skip_when?: Condition;
  sla_hours?: number;
  config: AssignmentConfig | ApprovalConfig | AttachmentConfig | DecisionConfig | AutomationConfig | SubprocessConfig;
}

interface ProcessDefinition {
  id: string;
  name: string;
  type: 'sequential' | 'parallel';
  order: number;
  is_parallel: boolean;
  start_when?: Condition;
  sla_hours?: number;
  steps: StepDefinition[];
}

interface StageDefinition {
  id: string;
  name: string;
  stage_type: 'primary' | 'alternate';
  order: number;
  on_complete: 'auto_advance' | 'wait_for_user' | 'resolve_case';
  skip_when?: Condition;
  entry_criteria?: Condition;
  sla_hours?: number;
  processes: ProcessDefinition[];
}

interface CaseTypeDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  prefix: string;
  field_schema: Record<string, any>;
  stages: StageDefinition[];
  attachment_categories: AttachmentCategory[];
  version: number;
  is_active: boolean;
}

// --- Case Runtime ---
interface StepInstance {
  definition_id: string;
  name: string;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled' | 'waiting';
  order: number;
  started_at?: string;
  completed_at?: string;
  assigned_to?: string;
  form_submission_id?: string;
  decision_branch_taken?: string;
}

interface ProcessInstance {
  definition_id: string;
  name: string;
  type: string;
  status: string;
  order: number;
  is_parallel: boolean;
  steps: StepInstance[];
}

interface StageInstance {
  definition_id: string;
  name: string;
  stage_type: string;
  status: string;
  order: number;
  on_complete: string;
  entered_at?: string;
  completed_at?: string;
  processes: ProcessInstance[];
}

interface CaseResponse {
  id: string;
  case_type_id: string;
  case_type_name: string;
  title: string;
  status: string;
  priority: string;
  owner_id: string;
  team_id?: string;
  custom_fields: Record<string, any>;
  current_stage_id?: string;
  current_process_id?: string;
  current_step_id?: string;
  stages: StageInstance[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// --- Rules ---
interface SimpleCondition {
  field: string;
  operator: string;
  value?: any;
}

interface CompoundCondition {
  all?: (SimpleCondition | CompoundCondition)[];
  any?: (SimpleCondition | CompoundCondition)[];
}

type Condition = SimpleCondition | CompoundCondition;
```

---

## 12. Seed Data

### 3 Case Types with Full Hierarchy

#### Case Type 1: Loan Origination

```
LOAN ORIGINATION (prefix: LOAN)
├─ Stage: Create (primary, order 1, auto_advance)
│   └─ Process: Collect Loan Details (sequential)
│       ├─ Step: Fill Loan Application (assignment, form: loan-intake)
│       └─ Step: Upload Income Proof (attachment, category: income_proof)
│
├─ Stage: Investigation (primary, order 2, auto_advance)
│   ├─ Process: Credit Verification (sequential)
│   │   ├─ Step: Run Credit Check (automation, webhook: credit API)
│   │   └─ Step: Review Credit Report (assignment, role: ANALYST)
│   └─ Process: Document Verification (parallel)
│       └─ Step: Verify Documents (assignment, role: WORKER)
│
├─ Stage: Approval (primary, order 3, auto_advance)
│   │ skip_when: {loan_amount <= 10000}
│   └─ Process: Approval Routing (sequential)
│       ├─ Step: Route by Amount (decision, branches: auto/mgr/vp)
│       ├─ Step: Manager Approval (approval, role: MANAGER) — branch A
│       └─ Step: VP Approval (approval, role: VP) — branch B
│
├─ Stage: Disbursement (primary, order 4, resolve_case)
│   └─ Process: Fund Transfer (sequential)
│       ├─ Step: Calculate Disbursement (automation, set_field)
│       └─ Step: Process Payment (assignment, role: WORKER)
│
├─ Stage: Rejection (alternate)
│   └─ Process: Rejection Flow (sequential)
│       └─ Step: Send Rejection Notice (automation, send_notification)
│
└─ Stage: Withdrawal (alternate)
    └─ Process: Withdrawal Flow (sequential)
        └─ Step: Record Withdrawal Reason (assignment, form: withdrawal-reason)
```

#### Case Type 2: Insurance Claims

```
INSURANCE CLAIMS (prefix: CLM)
├─ Stage: Create (primary, order 1, auto_advance)
│   └─ Process: Claim Intake (sequential)
│       ├─ Step: Fill Claim Form (assignment, form: claims-intake)
│       └─ Step: Attach Claims Proof (attachment, category: claims_proof)
│
├─ Stage: Investigation (primary, order 2, auto_advance)
│   │ entry_criteria: {claims_proof attached}
│   ├─ Process: Initial Investigation (sequential)
│   │   ├─ Step: Verify Claim Details (assignment, role: ANALYST)
│   │   └─ Step: Assess Validity (decision, branches: valid/invalid)
│   └─ Process: Extended Investigation (sequential)
│       │ start_when: {claim_amount > 50000}
│       └─ Step: On-Site Investigation (assignment, role: INVESTIGATOR)
│
├─ Stage: Approval (primary, order 3, auto_advance)
│   │ skip_when: {claim_amount < 100}
│   └─ Process: Claim Approval (sequential)
│       └─ Step: Manager Approval (approval, role: MANAGER)
│
├─ Stage: Settlement (primary, order 4, resolve_case)
│   └─ Process: Payment Processing (sequential)
│       ├─ Step: Calculate Settlement (automation)
│       └─ Step: Process Settlement (assignment, role: WORKER)
│
├─ Stage: Rejection (alternate)
│   └─ Process: Claim Rejection (sequential)
│       └─ Step: Send Rejection Notice (automation)
│
└─ Stage: Fraud Review (alternate)
    └─ Process: Fraud Investigation (sequential)
        ├─ Step: Escalate to Fraud Team (automation, send_notification)
        └─ Step: Detailed Fraud Review (assignment, role: FRAUD_ANALYST)
```

#### Case Type 3: Customer Onboarding (KYC)

```
CUSTOMER ONBOARDING (prefix: KYC)
├─ Stage: Create (primary, order 1, auto_advance)
│   └─ Process: Application (sequential)
│       ├─ Step: Fill KYC Application (assignment, form: kyc-intake)
│       └─ Step: Upload ID Documents (attachment, categories: [id_proof, address_proof])
│
├─ Stage: Verification (primary, order 2, auto_advance)
│   ├─ Process: Identity Check (sequential)
│   │   ├─ Step: Verify ID Documents (assignment, role: ANALYST)
│   │   └─ Step: Run Background Check (automation, webhook)
│   └─ Process: Risk Assessment (parallel)
│       └─ Step: Evaluate Risk Level (assignment, role: RISK_ANALYST)
│
├─ Stage: Review (primary, order 3, auto_advance)
│   │ skip_when: {risk_level == "low"}
│   └─ Process: Enhanced Review (sequential)
│       ├─ Step: Route by Risk (decision, branches: medium/high)
│       ├─ Step: Manager Review (assignment, role: MANAGER) — medium
│       └─ Step: Compliance Review (assignment, role: COMPLIANCE) — high
│
├─ Stage: Account Setup (primary, order 4, resolve_case)
│   └─ Process: Provisioning (sequential)
│       ├─ Step: Create Account (automation)
│       ├─ Step: Send Welcome Kit (automation, send_notification)
│       └─ Step: Schedule Onboarding Call (assignment, role: WORKER)
│
└─ Stage: Rejection (alternate)
    └─ Process: KYC Rejection (sequential)
        └─ Step: Send Rejection (automation)
```

### Sample Data

- **9 cases** (3 per type) at various stages/steps
- **12+ assignments** in various states
- **6 approval chains** linked to steps
- **3 decision tables** (loan routing, claim routing, risk routing)
- **5 documents** linked to attachment steps
- **3 form definitions** (loan intake, claim intake, KYC intake)
- **7 SLA definitions** per stage/process
- **Users/Teams/Comments/Notifications** — same as current

---

## 13. Migration from Current System

### Strategy: Clean Break + Reseed

The hierarchical model is fundamentally different from the current flat model. Rather than complex migration logic:

1. **Drop existing collections:** cases, tasks, approval_chains, sla_definitions
2. **Keep unchanged:** users, teams, comments (detach case references), notifications, documents
3. **Reseed:** New case_type_definitions, sample cases with nested state, assignments, decision_tables
4. **Old files:** Keep as `_deprecated/` for reference, then remove

### Files Removed/Replaced

| Current File | Fate |
|---|---|
| `models/tasks.py` | → Replaced by `models/assignments.py` |
| `routes/tasks.py` | → Replaced by `routes/assignments.py` |
| `state/tasks/` | → Replaced by `state/assignments/` |
| `features/tasks/task-kanban.component.ts` | → Replaced by `features/portal/assignments/` |
| Flat case model in `models/cases.py` | → Rewritten with nested hierarchy |
| Flat lifecycle in `engine/lifecycle.py` | → Rewritten + new engine modules |

---

## 14. Sprint Plan

### Sprint A: Rule Engine + Core Models (Week 1–2)

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1 | Rule engine | `engine/rule_engine.py` | P0 |
| 2 | Decision table engine | `engine/decision_tables.py` | P0 |
| 3 | Rule models | `models/rules.py` | P0 |
| 4 | Case type model (hierarchical) | `models/case_types.py` | P0 |
| 5 | Case runtime model | `models/cases.py` (rewrite) | P0 |
| 6 | Assignment model | `models/assignments.py` | P0 |
| 7 | Decision table CRUD routes | `routes/decision_tables.py` | P1 |
| 8 | Rule evaluation route | `routes/rules.py` | P1 |
| 9 | Unit tests: rule engine | `tests/test_rule_engine.py` | P0 |
| 10 | Unit tests: decision tables | `tests/test_decision_tables.py` | P0 |

### Sprint B: Hierarchical Engine + Step Types + Routes (Week 3–4)

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1 | Case lifecycle engine (rewrite) | `engine/lifecycle.py` | P0 |
| 2 | Step execution engine | `engine/step_engine.py` | P0 |
| 3 | Process orchestrator | `engine/process_engine.py` | P0 |
| 4 | Assignment step handler | `engine/steps/assignment_step.py` | P0 |
| 5 | Approval step handler | `engine/steps/approval_step.py` | P0 |
| 6 | Attachment step handler | `engine/steps/attachment_step.py` | P0 |
| 7 | Decision step handler | `engine/steps/decision_step.py` | P0 |
| 8 | Automation step handler | `engine/steps/automation_step.py` | P0 |
| 9 | Subprocess step handler | `engine/steps/subprocess_step.py` | P1 |
| 10 | Case Type CRUD routes (admin) | `routes/case_types.py` | P0 |
| 11 | Case routes (rewrite) | `routes/cases.py` | P0 |
| 12 | Assignment routes | `routes/assignments.py` | P0 |
| 13 | Merge approvals into engine | `routes/approvals.py` (refactor) | P1 |
| 14 | Form → step linking | `routes/forms.py` (enhance) | P1 |
| 15 | Documents → step linking | `routes/documents.py` (enhance) | P1 |
| 16 | Multi-level SLA | `routes/sla.py` (enhance) | P1 |
| 17 | Seed data | `seed.py` (rewrite) | P0 |
| 18 | Router registration | `main.py` (update) | P0 |
| 19 | Integration tests | `tests/` | P0 |

### Sprint C: Frontend — Worker Portal + Case View (Week 5–6)

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1 | TypeScript models | `core/models/index.ts` | P0 |
| 2 | Updated API service | `core/services/api-data.service.ts` | P0 |
| 3 | Cases state remodel | `state/cases/` | P0 |
| 4 | Assignments state | `state/assignments/` | P0 |
| 5 | Portal routes setup | `app.routes.ts` | P0 |
| 6 | Stage Progress Bar component | `shared/stage-progress/` | P0 |
| 7 | Case View page (run screen) | `features/portal/case-view/` | P0 |
| 8 | Step cards + work panels | `features/portal/case-view/` | P0 |
| 9 | Assignment Board page | `features/portal/assignments/` | P0 |
| 10 | Case Create page | `features/portal/case-create/` | P0 |
| 11 | Case List page | `features/portal/case-list/` | P0 |
| 12 | Portal Dashboard | `features/portal/dashboard/` | P1 |
| 13 | Shell / Navigation update | `layout/shell.component.ts` | P0 |

### Sprint D: Frontend — Admin Portal + Designers (Week 7–8)

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1 | Case Type Designer page | `features/admin/case-type-designer/` | P0 |
| 2 | Stage config panel | `features/admin/case-type-designer/` | P0 |
| 3 | Process config panel | `features/admin/case-type-designer/` | P0 |
| 4 | Step config panels (all 6 types) | `features/admin/step-config/` | P0 |
| 5 | Rule Builder component (reusable) | `shared/rule-builder/` | P0 |
| 6 | Decision Table Editor | `features/admin/decision-table-editor/` | P0 |
| 7 | Case-types state (admin CRUD) | `state/case-types/` | P0 |
| 8 | Decision-tables state | `state/decision-tables/` | P0 |
| 9 | Admin case types list page | `features/admin/admin-case-types/` | P0 |
| 10 | Process designer (repurposed) | `features/admin/process-designer/` | P1 |
| 11 | Admin routes + nav | `app.routes.ts`, `layout/` | P0 |
| 12 | E2E lifecycle tests | `tests/` | P0 |

---

## 15. File Impact Summary

### New Backend Files (~18)

```
backend/
├── models/
│   ├── case_types.py          (NEW — hierarchy definitions)
│   ├── assignments.py         (NEW — replaces tasks.py)
│   └── rules.py               (NEW — conditions, decision tables)
├── engine/
│   ├── lifecycle.py           (REWRITE — hierarchical engine)
│   ├── rule_engine.py         (NEW — expression evaluator)
│   ├── decision_tables.py     (NEW — decision table evaluator)
│   ├── step_engine.py         (NEW — step activation/completion)
│   ├── process_engine.py      (NEW — process orchestration)
│   └── steps/
│       ├── __init__.py        (NEW)
│       ├── assignment_step.py (NEW)
│       ├── approval_step.py   (NEW)
│       ├── attachment_step.py (NEW)
│       ├── decision_step.py   (NEW)
│       ├── automation_step.py (NEW)
│       └── subprocess_step.py (NEW)
├── routes/
│   ├── case_types.py          (REWRITE — full hierarchy CRUD)
│   ├── cases.py               (REWRITE — nested state)
│   ├── assignments.py         (NEW — replaces tasks.py)
│   ├── decision_tables.py     (NEW — CRUD + evaluate)
│   └── rules.py               (NEW — evaluate + validate)
├── seed.py                    (REWRITE — hierarchical seed data)
├── main.py                    (UPDATE — new router registrations)
└── tests/
    ├── test_rule_engine.py       (NEW)
    ├── test_decision_tables.py   (NEW)
    ├── test_lifecycle.py         (NEW)
    ├── test_step_engine.py       (NEW)
    └── test_assignments.py       (NEW)
```

### New Frontend Files (~20)

```
frontend/src/app/
├── core/models/index.ts                    (REWRITE — new interfaces)
├── core/services/api-data.service.ts       (UPDATE — new endpoints)
├── state/
│   ├── cases/                              (REWRITE — nested model)
│   ├── assignments/                        (NEW — replaces tasks/)
│   ├── case-types/                         (NEW — admin CRUD)
│   └── decision-tables/                    (NEW — admin CRUD)
├── shared/
│   ├── stage-progress/
│   │   └── stage-progress.component.ts     (NEW — chevron bar)
│   └── rule-builder/
│       └── rule-builder.component.ts       (NEW — visual condition editor)
├── features/
│   ├── portal/
│   │   ├── case-list/
│   │   │   └── case-list.component.ts      (NEW — worker case list)
│   │   ├── case-create/
│   │   │   └── case-create.component.ts    (NEW — create from type)
│   │   ├── case-view/
│   │   │   ├── case-view.component.ts      (NEW ★ — main run screen)
│   │   │   ├── step-card.component.ts      (NEW — step rendering)
│   │   │   └── assignment-panel.component.ts (NEW — work panel)
│   │   ├── assignments/
│   │   │   └── assignment-board.component.ts (NEW — my worklist)
│   │   └── dashboard/
│   │       └── dashboard.component.ts      (NEW — worker dashboard)
│   └── admin/
│       ├── case-type-designer/
│       │   └── case-type-designer.component.ts (NEW ★ — main design screen)
│       ├── step-config/
│       │   └── step-config.component.ts    (NEW — per-type config panels)
│       ├── decision-table-editor/
│       │   └── decision-table-editor.component.ts (NEW)
│       └── process-designer/
│           └── process-designer.component.ts (REFACTORED from workflow-designer)
├── layout/shell.component.ts               (UPDATE — portal/admin nav split)
└── app.routes.ts                           (UPDATE — portal + admin routes)
```

### Removed/Deprecated

```
backend/models/tasks.py             → REMOVED (replaced by assignments.py)
backend/routes/tasks.py             → REMOVED (replaced by assignments.py)
frontend/state/tasks/               → REMOVED (replaced by assignments/)
frontend/features/tasks/            → REMOVED (replaced by portal/assignments/)
```

### Unchanged (~30+ files)

```
All auth files, teams, users, comments, audit_logs, notifications,
documents, AI features (Phase 3), WebSocket, config API,
guards, interceptors, environment files, styles
```
