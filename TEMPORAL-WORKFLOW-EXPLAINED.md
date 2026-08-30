# Temporal in this project — technical explanation

## 1) Why Temporal exists at all

Temporal is a durable workflow engine.

In plain English:

- A normal app usually keeps workflow state in a database and manually moves it forward.
- If the server restarts, the API crashes, or a task is retried, you have to carefully rebuild the workflow state.
- Temporal gives you a workflow runtime that remembers state, resumes safely, and retries steps without losing progress.

It is especially useful when your application has:

- long-running processes
- human approval steps
- automation steps that must be retried
- SLA timers
- state that should survive restarts and partial failures

---

## 2) Why it matters for this project

This project already has a workflow-like model:

- Case
- Stage
- Process
- Step
- Assignment / approval / automation

The database stores those relationships, but once a case starts moving through a lifecycle, there are real operational problems if that process is only tracked in application memory or ad-hoc logic:

- API server restarts while a case is waiting on manager approval
- A background task fails halfway through a stage
- You want a durable process that can resume automatically
- You want SLA escalation / reminders to keep firing even if the main app is down

That is the exact gap Temporal fills.

In this project, Temporal is not replacing the case model in MongoDB. It is sitting on top of it as the orchestration layer for cases that opt in with `use_temporal = true`.

---

## 3) Where Temporal is used in this codebase

Relevant files:

- [backend/routes/cases.py](backend/routes/cases.py)
- [backend/temporal_worker/worker.py](backend/temporal_worker/worker.py)
- [backend/temporal_worker/workflows/case_workflow.py](backend/temporal_worker/workflows/case_workflow.py)
- [backend/temporal_worker/activities/case_activities.py](backend/temporal_worker/activities/case_activities.py)
- [backend/temporal_worker/activities/step_activities.py](backend/temporal_worker/activities/step_activities.py)
- [backend/routes/temporal_routes.py](backend/routes/temporal_routes.py)
- [backend/seed_temporal_demo.py](backend/seed_temporal_demo.py)

### Flow in this repo

When a case is created:

1. The FastAPI route creates the case in MongoDB.
2. It checks whether the case type has `use_temporal: true`.
3. If enabled, it starts a Temporal workflow using `CaseWorkflow.run`.
4. The Temporal worker service is already polling the configured task queue.
5. The workflow then executes the lifecycle logic durably.

---

## 4) What the workflow looks like here

The actual workflow is implemented in [backend/temporal_worker/workflows/case_workflow.py](backend/temporal_worker/workflows/case_workflow.py).

The logic is roughly:

```python
while True:
    active = get_active_step_activity(case_id)

    if active is None:
        # no active step; maybe case is resolved or waiting
        sleep and re-check

    if step_type == "automation":
        execute_activity(complete_step_activity, ...)
    else:
        wait_condition(lambda: pending_signal or resolved_signal)
```

This means:

- automation steps run automatically inside a workflow activity
- human steps pause the workflow and wait for a signal
- when a human completes an assignment or approval through the API, the API sends a `step_completed` signal back to the workflow
- the workflow resumes and continues to the next stage/step

That is the key Temporal pattern.

---

## 5) The basic Temporal concepts used here

### Workflow
A workflow is the durable orchestration logic.

Here:

- `CaseWorkflow` represents the lifecycle of a business case
- it can wait, resume, retry, and remember its current state

### Activity
An activity is an actual action the workflow performs.

Examples here:

- fetch case data from MongoDB
- advance the stage in the case
- mark a step complete
- resolve the case
- send SLA/escalation mail

### Signal
A signal is an external event that wakes the workflow up.

Example: a user completes an approval in the UI.

That path is triggered in routes such as:

- [backend/routes/approvals.py](backend/routes/approvals.py)
- [backend/routes/assignments.py](backend/routes/assignments.py)

The API sends a signal like `StepCompletedSignal` into the running workflow.

### Query
A query is a read-only request for workflow status.

This project exposes Temporal status through:

- [backend/routes/temporal_routes.py](backend/routes/temporal_routes.py)

### Task queue
The worker listens on a task queue such as `workflow-queue` and picks up work assigned to it.

That queue is configured in the backend settings.

---

## 6) Why this is useful for this project

### Real advantages

#### a) Durable workflow continuity
If the API server restarts, the workflow keeps running in Temporal.

#### b) Safe retries for automation steps
If an activity fails, Temporal can retry it with exponential backoff.

#### c) Human-in-the-loop process management
Approval steps pause cleanly and resume when the human action arrives.

#### d) SLA timers
Temporal makes it easier to start timeout logic and escalate if a step is not completed in time.

#### e) Separation of concerns
The case database remains the source of truth for the case object, while Temporal coordinates the live orchestration.

---

## 7) What the demo case does

The seeded demo case type is defined in [backend/seed_temporal_demo.py](backend/seed_temporal_demo.py):

- Employee Onboarding (Temporal Demo)
- `use_temporal: true`
- 4 stages:
  - Intake
  - HR Review
  - IT Setup
  - Orientation

Sample cases:

- `ONB-001` — active at Intake, waiting on assignment
- `ONB-002` — active at HR Review, waiting on approval
- `ONB-003` — resolved and completed end-to-end

So when you submit the case from the Angular UI and enable Temporal on that case type, the app is not just saving a case record. It is also:

- starting a Temporal workflow
- tracking that workflow in Temporal server
- waiting for step completion or automation activity results
- surfacing flow history and status through the Temporal UI and your app

---

## 8) How it works end-to-end in this app

### Typical flow for a case

1. User creates a case in Angular.
2. Backend creates the case in MongoDB.
3. Backend sees `use_temporal = true`.
4. Backend calls `client.start_workflow(...)`.
5. Temporal creates a workflow execution with a workflow ID like `case-ONB-001`.
6. Worker picks it up from the task queue.
7. Workflow reads the current active step.
8. If step is automation, it executes an activity.
9. If step is human, it waits for a signal.
10. When the user approves or completes the step, the API sends a signal.
11. Workflow resumes, advances the case, and continues.

This is durable orchestration, not just a database update loop.

---

## 9) Why Temporal is not mandatory for every case type

This project uses a hybrid design.

Not every case type needs Temporal.

Use Temporal when:

- the process is important enough that restart resilience matters
- there are approvals, timers, retries, or automation
- you want a durable lifecycle engine

Do not overuse it when:

- the workflow is short and simple
- there are no long-running human steps
- you do not need durability or retry semantics

In other words:

- normal CRUD case management can stay in MongoDB
- Temporal is for orchestration of complex business processes

---

## 10) Developer-level intuition

The easiest way to think about it:

- MongoDB = the state database
- FastAPI = the API layer
- Temporal = the execution engine for long-running workflows

So the project is saying:

> “Keep the case data in MongoDB, but let Temporal own the process movement for durable, retryable, long-running business logic.”

That is a very standard enterprise pattern.

---

## 11) In one sentence

Temporal is useful here because your app is not just storing a case; it is running a business workflow with approvals, automation, stages, signals, and SLA timers, and Temporal gives that workflow real durability and reliability.

---

## 12) Practical takeaway for this repo

Your project currently demonstrates the concept cleanly:

- a case type can be marked `use_temporal`
- the Angular UI can start the workflow
- the Temporal dashboard shows it executing
- the worker handles durable progression
- the API sends signals for completion

This is exactly how you would architect a real workflow-heavy system without building a fragile manual state machine yourself.
