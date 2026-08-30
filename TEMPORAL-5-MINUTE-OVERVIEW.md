# Temporal in 5 minutes for this project

## What is Temporal?

Temporal is a durable workflow engine.

In simple terms, it helps you run long-running business processes reliably.

It is useful when a process must:

- continue after a server restart
- wait for a human approval
- retry failed actions safely
- track progress over time
- trigger SLA/escalation logic

---

## Why this project needs it

This project already has case workflows with stages, steps, approvals, and automation.

Examples:

- employee onboarding
- loan processing
- case review
- approval chains
- SLA-driven follow-ups

These are not just database rows. They are live business processes.

If the API crashes in the middle, or a manager is reviewing an approval, you do not want the workflow state to disappear or become inconsistent.

Temporal helps solve that.

---

## What Temporal does here

For case types marked with `use_temporal = true`, the project starts a Temporal workflow when the case is created.

Then the workflow:

- loads the active case step
- runs automation steps as activities
- waits for human actions like approval or assignment completion
- resumes when a signal arrives from the API
- keeps state durable across restarts and retries

So Temporal is the orchestration layer on top of your case system.

---

## The key terms

### Workflow
The overall durable business process.

In this repo:

- `CaseWorkflow`
- one workflow per case

### Activity
A single unit of work inside the workflow.

Examples:

- fetch case
- resolve case
- advance stage
- check active step
- complete step
- send mail

### Signal
A message from outside the workflow telling it to continue.

Example:

- user completes a human step
- API sends `step_completed` signal
- workflow wakes up and continues

### Task queue
The worker listens here and picks up workflow work.

Example:

- `workflow-queue`

---

## Why not just use MongoDB alone?

MongoDB is great for storing data.

But MongoDB alone does not automatically give you:

- durable execution history
- retry loops
- workflow resume semantics
- safe human-interrupted steps
- workflow-level visibility and debugging

Temporal adds that runtime layer.

---

## How the flow works in this project

### Normal case without Temporal

- create case in MongoDB
- update status manually
- server logic decides next step
- if crash happens, state may get stuck or inconsistent

### Case with Temporal

- create case in MongoDB
- start Temporal workflow
- workflow reads the case and current step
- if step is automation, run it as durable activity
- if step is human, pause and wait for signal
- when signal arrives, resume and move forward

This is much cleaner and more reliable for real business processes.

---

## Why this is a win for this app

This project is a workflow-heavy platform:

- approvals
- tasks
- stage changes
- escalation
- automation hooks
- SLA monitoring

For that kind of app, Temporal gives real business value:

- stronger reliability
- easier debugging
- safer long-running processes
- better visibility into execution state

---

## Demo example in this repo

The seeded demo case type is:

- `Employee Onboarding (Temporal Demo)`
- `use_temporal = True`

It has stages like:

- Intake
- HR Review
- IT Setup
- Orientation

When you submit a case, the app starts a workflow and Temporal tracks its execution.

That is why you can see the workflow entry under the Temporal menu.

---

## In one sentence

Temporal is useful here because the project is not just storing case records — it is running coordinated business workflows where accuracy, restart safety, and human-in-the-loop execution matter.

---

## Practical takeaway

Use Temporal for workflow-heavy business processes.

Use normal MongoDB + API logic for simple CRUD flows.

This project is doing both correctly: MongoDB for data, Temporal for durable process orchestration.
