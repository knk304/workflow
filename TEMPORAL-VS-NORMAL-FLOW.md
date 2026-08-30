# Temporal vs Normal Non-Temporal Flow

This document explains the difference between the usual application flow and the Temporal-based durable workflow flow.

---

## 1) Normal non-Temporal flow

In a standard app flow, the API server handles the complete business process in one request/response cycle.

### Example

User clicks "Submit case".

1. FastAPI route receives request.
2. It validates input.
3. It updates MongoDB.
4. It calls the normal workflow/engine functions directly.
5. It runs automation code immediately.
6. It updates case state.
7. It returns response to the UI.

### Typical pattern

```text
UI -> API -> MongoDB -> Python business logic -> response
```

### What happens during a human step?

If the case is waiting for a human approval or assignment:

- the app usually stores a status like "waiting_for_approval"
- the API may keep polling or the frontend may reload data
- the backend does not have a durable workflow engine tracking the state machine
- if the server restarts, the flow may be lost or require custom recovery logic

### Strengths

- simpler for small processes
- easy to understand
- good for quick implementations

### Weaknesses

- no durable orchestration across restarts
- harder to resume after crash or downtime
- retry logic and long-running state management are manual
- harder to track workflow history, timeouts, and signals reliably

---

## 2) Temporal flow

Temporal adds a durable workflow engine between the app and the business logic.

### Example

User creates a case.

1. API creates the case in MongoDB.
2. API starts a Temporal workflow instance.
3. Temporal stores workflow state and execution history.
4. Workflow asks MongoDB: "What is the active step?"
5. Workflow decides which step to run next.
6. It schedules an activity.
7. Python worker receives the activity task from Temporal.
8. Worker executes the actual Python logic.
9. Worker returns result to Temporal.
10. Workflow continues.

### Typical pattern

```text
UI -> API -> MongoDB
           -> Temporal workflow
                 -> activity task -> Python worker
```

### Human step behavior

For a human approval or assignment:

- Workflow pauses and waits for a signal
- API sends signal when user approves/rejects
- Temporal wakes the workflow and continues from that point
- The workflow state is durable even if the app process restarts

### Strengths

- durable, restart-safe state machine
- automatic retry and timeout handling
- clear separation between orchestration and business logic
- better for long-running human-in-the-loop processes
- good audit/history and resumption model

### Weaknesses

- more complex architecture
- requires worker process and Temporal server
- more moving parts than a simple direct API flow

---

## 3) Direct comparison

### Normal app flow

```text
User action
  -> API
  -> direct Python logic
  -> MongoDB update
  -> immediate result
```

### Temporal flow

```text
User action
  -> API
  -> MongoDB + workflow start
  -> Temporal stores workflow state
  -> workflow schedules activity
  -> Python worker executes logic
  -> result sent back to workflow
  -> next step continues
```

---

## 4) Your project-specific view

In this project:

- MongoDB stores case and step state
- Python engine handles business rules and steps
- Temporal runs the orchestration/state machine
- API routes send signals for human approvals or resolution
- worker process executes actual activities

So the app is not using Temporal instead of MongoDB or Python business logic.
It is using Temporal as the durable workflow layer above the existing backend logic.

---

## 5) Simple real-world analogy

### Normal flow

Think of a manager doing every step personally:

- check task
- mark it done
- move to next task
- if the manager crashes, the process may be incomplete

### Temporal flow

Think of a project management system that tracks every stage and resumes when someone continues:

- the system remembers where the work stopped
- it waits for input
- it resumes after approval
- it retries failed automated tasks automatically

---

## 6) When to use which

### Use normal non-Temporal flow when:

- process is short and simple
- no long pause/wait for human input
- no need for durable workflow tracking
- process is not critical if server restarts mid-way

### Use Temporal when:

- workflow can take hours/days
- you need human-in-the-loop approvals
- you need durable state recovery after restart
- you need retries, timeouts, and workflow history
- the process must survive failures without manual recovery

---

## 7) In your app, the real answer

Your current app is effectively a hybrid model:

- normal case management still happens in MongoDB and Python
- Temporal is added to orchestrate long-running workflow execution
- human step waiting is handled by signals instead of ad hoc polling
- case resolution and activity completion are aligned with durable workflow status

This gives you the reliability of a workflow engine without rewriting the whole business layer.

---

## 8) Final takeaway

Normal flow = direct execution.

Temporal flow = durable orchestration with explicit workflow state, signals, activities, and retries.

The key difference is that Temporal remembers the workflow state and can resume safely across time, failures, and restarts.
