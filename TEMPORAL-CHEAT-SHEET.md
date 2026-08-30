# Temporal cheat sheet for this project

## 1) What is Temporal?

Temporal is a durable workflow engine.

It is used to run long-running business processes reliably.

It helps when a process:

- waits for a human action
- must survive server restarts
- has retryable automation work
- needs SLA timing or escalation

---

## 2) Why this project uses it

This project already models business workflows using:

- case
- stage
- process
- step
- assignment
- approval
- automation

That is exactly the kind of work Temporal is built for.

---

## 3) Key idea

MongoDB stores the case data.

Temporal stores the workflow execution state.

So the project is combining:

- data persistence in MongoDB
- durable process orchestration in Temporal

---

## 4) When a case opts into Temporal

A case type can have:

```python
"use_temporal": True
```

Then the backend starts a Temporal workflow as soon as the case is created.

Relevant code:

- [backend/routes/cases.py](backend/routes/cases.py)
- [backend/seed_temporal_demo.py](backend/seed_temporal_demo.py)

---

## 5) Main Temporal terms used here

### Workflow
The durable process definition.

This repo uses:

- `CaseWorkflow`

It represents the lifecycle of a case.

### Activity
A single task that executes inside a workflow.

Examples:

- fetch case
- get active step
- complete step
- resolve case
- send mail

### Signal
External event sent into a workflow to continue execution.

Examples:

- user completes assignment
- user approves an item
- workflow is told a step is finished

### Task queue
The queue the worker listens to.

Example:

- `workflow-queue`

### Worker
The process that receives workflow tasks and executes activities.

Code:

- [backend/temporal_worker/worker.py](backend/temporal_worker/worker.py)

---

## 6) How the flow works in this repo

1. User creates a case in Angular
2. Backend creates the case record in MongoDB
3. Backend sees `use_temporal = true`
4. Backend calls Temporal `start_workflow(...)`
5. Worker receives the workflow job
6. Workflow reads the current active step
7. If step is automation, it runs an activity
8. If step is human, it waits for a signal
9. API sends signal when user completes the human step
10. Workflow resumes and moves to next step

---

## 7) Human step pattern

This is the most important concept.

Human steps do not run instantly in a loop. They pause.

Example pattern:

```python
await workflow.wait_condition(
    lambda: self._pending_signal is not None or self._resolved_signal is not None
)
```

This means:

- workflow waits until a human action happens
- then external signal wakes it up
- then it progresses

This is the classic “human-in-the-loop” workflow pattern.

---

## 8) Why it is better than custom manual logic

Without Temporal, a case flow is usually just a set of database checks and manual state updates.

That becomes risky when:

- the server crashes in the middle
- a worker retries a failed step
- a human approval is pending for days
- you need auditability and execution history

Temporal gives you:

- durable workflow state
- retries and timeout management
- execution visibility
- safer orchestration of long-running business processes

---

## 9) Demo example in this repo

The seeded demo is:

- `Employee Onboarding (Temporal Demo)`

It contains stages such as:

- Intake
- HR Review
- IT Setup
- Orientation

That is a real-world lifecycle process, which is exactly why Temporal is appropriate here.

---

## 10) What you should remember

### Temporal is for:

- approvals
- long-running services
- multi-step business processes
- automation + human steps together
- durable workflow state

### Not needed for:

- simple CRUD records
- basic API list/create/read operations
- short-lived local state

---

## 11) One-line summary

Temporal in this project is the engine that keeps case workflows durable, retryable, and resumable while humans and automation interact over time.
