# Temporal end-to-end flow in this project

## Goal

This document explains the actual path from the Angular UI to the Temporal workflow, using the real code in this repository.

---

## 1) The business decision: case type opts into Temporal

A case type can enable Temporal by setting:

```python
"use_temporal": True
```

That is exactly how the demo seed file defines the case type:

- [backend/seed_temporal_demo.py](backend/seed_temporal_demo.py)

This case type is:

- `Employee Onboarding (Temporal Demo)`
- `use_temporal = True`

When this flag is enabled, the backend does not just create a case record. It also starts a Temporal workflow.

---

## 2) User submits a case from Angular

The UI submits a case creation request to the backend API.

The server route is:

- [backend/routes/cases.py](backend/routes/cases.py)

Inside `create_case`, the code does this:

1. Create the case in MongoDB
2. Look up the case type definition
3. If `use_temporal` is true, start a Temporal workflow

The exact logic is here:

```python
case_type_doc = await db.case_type_definitions.find_one({"_id": body.case_type_id})
if case_type_doc and case_type_doc.get("use_temporal"):
    tc = await get_temporal_client()
    handle = await tc.start_workflow(
        CaseWorkflow.run,
        case_id,
        id=f"case-{case_id}",
        task_queue=settings.temporal_task_queue,
        execution_timeout=timedelta(days=365),
    )
```

The important point is:

- the workflow is started automatically after case creation
- the workflow is associated with this case ID
- the workflow is assigned to the configured Temporal task queue

---

## 3) Temporal workflow is created

The workflow definition is here:

- [backend/temporal_worker/workflows/case_workflow.py](backend/temporal_worker/workflows/case_workflow.py)

The workflow is the durable state machine for the case.

It loops over the case lifecycle and does this:

- fetch the current active step
- decide whether the step is automation or human-driven
- if automation, execute an activity
- if human, wait for a signal

The main workflow run structure is roughly:

```python
while True:
    active = await workflow.execute_activity(get_active_step_activity, case_id, ...)

    if active is None:
        # no active step yet
        await asyncio.sleep(10)
        continue

    if step_type == "automation":
        await workflow.execute_activity(complete_step_activity, ...)
    else:
        await workflow.wait_condition(
            lambda: self._pending_signal is not None or self._resolved_signal is not None
        )
```

So the workflow is the orchestrator.

---

## 4) Worker picks it up

The worker process is here:

- [backend/temporal_worker/worker.py](backend/temporal_worker/worker.py)

This code starts a Temporal `Worker` with:

- the `CaseWorkflow`
- the `SLAWorkflow`
- all related activities

Example:

```python
worker = Worker(
    client,
    task_queue=settings.temporal_task_queue,
    workflows=[CaseWorkflow, SLAWorkflow],
    activities=[
        get_case_activity,
        get_case_type_activity,
        advance_stage_activity,
        resolve_case_activity,
        get_step_status_activity,
        get_active_step_activity,
        complete_step_activity,
        send_mail_activity,
        send_sla_escalation_activity,
    ],
)
```

This worker is polling the task queue and executing jobs assigned to it.

---

## 5) Workflow reads the case data

The workflow calls activities to read the case and step state from MongoDB.

Examples of activities are in:

- [backend/temporal_worker/activities/case_activities.py](backend/temporal_worker/activities/case_activities.py)
- [backend/temporal_worker/activities/step_activities.py](backend/temporal_worker/activities/step_activities.py)

These are used to:

- get the case
- get the active step
- complete a step
- advance the stage
- resolve the case

This keeps the workflow logic independent from direct database code and makes retries safe.

---

## 6) Automation steps run as activities

If the active step is an automation step, the workflow executes it as an activity.

For example, the workflow calls:

```python
await workflow.execute_activity(
    complete_step_activity,
    CompleteStepParams(...),
    start_to_close_timeout=timedelta(minutes=10),
    retry_policy=_AUTOMATION_RETRY,
)
```

This means:

- the operation is treated as a Temporal activity
- it can be retried if it fails
- it is durable and tracked by Temporal
- the workflow will not lose its place if the activity is retried

So automation is not just “fire and forget” logic. It is part of the workflow state machine.

---

## 7) Human steps pause the workflow

If the current step is human-driven (assignment, approval, attachment, etc.), the workflow does not keep looping blindly.

Instead it waits for a signal:

```python
await workflow.wait_condition(
    lambda: self._pending_signal is not None or self._resolved_signal is not None,
    timeout=timedelta(days=30),
)
```

This is the key human-in-the-loop behavior.

The workflow is effectively saying:

> “I am waiting for a human to finish this step. When that event arrives, resume me.”

---

## 8) API sends a signal when a user completes the step

When a user completes an assignment or approval, the backend route sends a signal to the workflow.

Examples:

- [backend/routes/approvals.py](backend/routes/approvals.py)
- [backend/routes/assignments.py](backend/routes/assignments.py)

The workflow exposes a signal method:

```python
@workflow.signal
async def step_completed(self, signal: StepCompletedSignal) -> None:
    self._pending_signal = signal
```

After that, the workflow resumes and continues with the next step.

This is how the system bridges:

- user action in Angular / API
- signal into the Temporal workflow
- durable continuation of the business process

---

## 9) What this means in your demo scenario

For a case such as `ONB-001` from [backend/seed_temporal_demo.py](backend/seed_temporal_demo.py):

- case is created
- workflow starts
- workflow sees active step = `step-fill-form`
- because it is a human activity/assignment step, it pauses
- the user action completes the step in the app
- the API sends the signal
- Temporal workflow resumes
- it continues to the next stage and process

That is the exact operational meaning of “the case is in Temporal.”

---

## 10) Why the Temporal menu shows a workflow

The frontend is not showing a random process. It is showing an actual Temporal workflow execution.

The API that lists workflow executions is here:

- [backend/routes/temporal_routes.py](backend/routes/temporal_routes.py)

That route calls the Temporal client and returns details like:

- workflow ID
- run ID
- workflow type
- status
- task queue
- event history

This is exactly why you can see the workflow entry in the project’s workflow menu.

---

## 11) Why this is stronger than a simple case-status flag

With plain status flags, your app often has this problem:

- state is updated in MongoDB
- some step is “in progress” but the server cannot reliably recover after restart
- you have to manually rebuild workflow progress from scattered data

With Temporal, the workflow itself carries the execution state.

It remembers:

- which step is active
- whether it is waiting for signal
- which activities already ran
- what happened in event history

That is a real advantage for long-running business processes.

---

## 12) The practical takeaway

This project is using Temporal in the correct enterprise pattern:

- MongoDB stores the case/entity state
- Temporal manages the durable execution of a workflow over time
- the API and UI drive human steps via signals
- the worker executes activities reliably and retries where needed

That is why the workflow menu shows entries: because the workflow is an actual durable execution running inside Temporal.

---

## 13) One sentence summary

In this repo, a case with `use_temporal = true` is not just a record — it is a live Temporal workflow that continues through stages, waits for human signals, and resumes safely even across restarts and retries.
