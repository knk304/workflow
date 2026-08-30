# Temporal vs Normal Flow Diagrams

## Important terminology

There are two different things in this project:

1. The application-level case workflow
   - this is the business process for a case
   - example: onboarding, approval, resolution, assignment, escalation
   - this is not a Temporal concept by itself; it is the case lifecycle logic in the application

2. The Temporal workflow
   - this is the durable orchestration engine provided by Temporal
   - it tracks execution state, waits on signals, schedules activities, and resumes after delays or restarts

When we say "workflow" in this project, we should be precise:

- "case workflow" or "business workflow" = the process of the case moving through stages/steps
- "Temporal workflow" = the runtime engine that coordinates that process

---

## 1) Normal non-Temporal flow diagram

```mermaid
flowchart TD
    A[User action in UI] --> B[API request]
    B --> C[Validate request]
    C --> D[Update MongoDB]
    D --> E[Run application business logic directly]
    E --> F[Update case status]
    F --> G[Return response to UI]

    H[If app restarts mid-process] --> I[Case flow state may be lost unless custom recovery logic exists]
```

### Explanation

This is the simplest flow:

- request enters API
- application logic executes immediately
- DB is updated directly
- response is returned immediately
- if the server restarts, the in-progress case state is not automatically recovered by a workflow engine

This is a normal application flow, not a Temporal workflow.

---

## 2) Temporal flow diagram

```mermaid
flowchart TD
    A[User action in UI] --> B[API request]
    B --> C[Create / update MongoDB case]
    C --> D[Start Temporal workflow instance]
    D --> E[Temporal workflow stores durable state]
    E --> F{Next step type?}

    F -->|Automation step| G[Workflow schedules an activity]
    G --> H[Python worker receives task from Temporal task queue]
    H --> I[Run application automation logic]
    I --> J[Update MongoDB]
    J --> K[Temporal workflow continues]

    F -->|Human step| L[Workflow pauses and waits for a signal]
    L --> M[User approves / rejects / resolves case]
    M --> N[API sends signal to the Temporal workflow]
    N --> O[Temporal wakes the workflow]
    O --> K

    K --> P{Case complete?}
    P -->|No| E
    P -->|Yes| Q[Temporal workflow completes and closes]
```

### Explanation

This is the durable orchestration flow driven by Temporal:

- the Temporal workflow persists the process state
- the worker executes the actual Python logic via activities
- human decisions arrive as signals
- the workflow resumes when the signal arrives
- timeout, retry, and restart behavior are handled by Temporal

This is not the same as the app's own case business flow; it is the Temporal engine running the orchestration for that flow.

---

## 3) Side-by-side visual comparison

```mermaid
flowchart LR
    subgraph Normal app flow
        A1[UI] --> A2[API]
        A2 --> A3[Direct application logic]
        A3 --> A4[MongoDB update]
        A4 --> A5[Response]
    end

    subgraph Temporal workflow flow
        B1[UI] --> B2[API]
        B2 --> B3[MongoDB + start Temporal workflow]
        B3 --> B4[Temporal stores workflow state]
        B4 --> B5[Activity scheduled]
        B5 --> B6[Python worker executes logic]
        B6 --> B7[MongoDB update]
        B7 --> B8[Workflow continues]
        B8 --> B9{Waiting for signal?}
        B9 -->|Yes| B10[Signal from API]
        B10 --> B8
        B9 -->|No| B11[Workflow ends]
    end
```

---

## 4) Example use case: onboarding approval

### Normal app flow

```mermaid
flowchart TD
    A[Create onboarding case] --> B[Run application create logic]
    B --> C[Set case status = waiting_for_manager_approval]
    C --> D[Frontend reloads or polls]
    D --> E[Manager approves]
    E --> F[API updates case directly]
    F --> G[Run next application logic immediately]
    G --> H[Case continues]
```

### Temporal workflow flow

```mermaid
flowchart TD
    A[Create onboarding case] --> B[Start Temporal workflow instance]
    B --> C[Temporal workflow checks active step]
    C --> D[Workflow schedules automation activity]
    D --> E[Python worker runs automation logic]
    E --> F[Case waits for manager approval]
    F --> G[Manager approves in UI]
    G --> H[API sends step_completed signal to Temporal workflow]
    H --> I[Temporal resumes the workflow]
    I --> J[Workflow schedules next automation activity]
    J --> K[Case completes]
```

---

## 5) Key difference in plain English

### Normal app flow

The application itself performs the steps in sequence.

### Temporal workflow

The Temporal engine persists the workflow state and coordinates execution, while the Python worker runs the actual logic for each activity.

---

## Final takeaway

- Normal app flow = direct execution in the application
- Temporal workflow = durable orchestration engine that coordinates execution and waits for signals
- Case workflow = the business process itself
- Temporal workflow = the runtime mechanism that runs and manages that process

When we refer to a workflow in this app, the clearest terms are:

- "case workflow" for the business process
- "Temporal workflow" for the runtime workflow engine
