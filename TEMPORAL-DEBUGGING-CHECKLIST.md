# Temporal debugging checklist for this project

## 1) First check: is Temporal installed in the active Python environment?

This is the most common startup issue.

Run this in the same backend venv you use to start the app:

```powershell
cd C:\development\workflow\backend
.\venv\Scripts\python.exe -c "import temporalio; print(temporalio.__file__)"
```

Expected result:

```text
C:\development\workflow\backend\venv\Lib\site-packages\temporalio\__init__.py
```

If you get `ModuleNotFoundError: No module named 'temporalio'`, then install dependencies into that exact venv:

```powershell
cd C:\development\workflow\backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

> On Windows, deep-path installs may fail under the user profile. If needed, use a short-path venv such as `C:\wf\venv` instead.

---

## 2) Is Temporal server running?

Check the Temporal dev server is started:

```powershell
temporal server start-dev --ui-port 8233
```

You should see:

- server listening on `localhost:7233`
- UI at `http://localhost:8233`

If it is not running, the worker and API cannot connect to Temporal.

---

## 3) Is the Temporal worker running?

Run:

```powershell
cd C:\development\workflow\backend
.\venv\Scripts\python.exe -m temporal_worker.worker
```

You should see logs like:

```text
[INFO] Connecting to MongoDB...
[INFO] Connecting to Temporal at localhost:7233 ...
[INFO] Worker started — task queue: workflow-queue  namespace: default
```

If the worker is not running, no workflow execution will be processed.

---

## 4) Is the environment variable / config correct?

Check the backend `.env` values:

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=workflow_platform
JWT_SECRET=workflow-dev-secret-change-in-production
CORS_ORIGINS=["http://localhost:4200","http://localhost:8233"]
TEMPORAL_HOST=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=workflow-queue
```

The project reads these through the backend config layer.

---

## 5) Is the case type using Temporal?

Make sure the case type has:

```python
"use_temporal": True
```

The demo seed file shows this in:

- [backend/seed_temporal_demo.py](backend/seed_temporal_demo.py)

If this flag is false, the API will not start a Temporal workflow for the case.

---

## 6) Is the case actually created in MongoDB?

Verify the case exists before expecting a workflow.

Check the case record in your MongoDB instance or via API.

If the case is not created, there is no workflow to start.

---

## 7) Did the API start the Temporal workflow?

Check the backend create-case route in:

- [backend/routes/cases.py](backend/routes/cases.py)

It calls:

```python
handle = await tc.start_workflow(
    CaseWorkflow.run,
    case_id,
    id=f"case-{case_id}",
    task_queue=settings.temporal_task_queue,
    execution_timeout=timedelta(days=365),
)
```

If this throws an exception, the code catches it and ignores it (`pass`), which is intentional so the API does not fail case creation.

That means a Temporal problem can quietly fail without blocking the UI. So check the worker and Temporal cluster directly.

---

## 8) Are you looking at the right task queue?

The worker and the workflow start must use the same queue.

The app config uses `TEMPORAL_TASK_QUEUE=workflow-queue` in `.env`.

If the workflow is started on one queue and the worker is polling another, the workflow will sit idle.

---

## 9) Is the worker connected to the same Temporal namespace?

Check the config values:

```env
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=workflow-queue
```

If namespace names mismatch, the workflow will not be seen by the worker.

---

## 10) Is the workflow waiting on a human signal?

This is normal.

The workflow pauses when the active step is human-driven:

```python
await workflow.wait_condition(
    lambda: self._pending_signal is not None or self._resolved_signal is not None
)
```

This does not mean the workflow is broken. It means it is waiting for a user action such as:

- approve step
- complete assignment
- resolve case

If the workflow is stuck, check whether the API is sending the signal from the relevant route.

---

## 11) Is the API sending the signal after user action?

Example route logic:

- [backend/routes/approvals.py](backend/routes/approvals.py)
- [backend/routes/assignments.py](backend/routes/assignments.py)

The signal call looks conceptually like:

```python
handle.signal(
    "step_completed",
    StepCompletedSignal(...)
)
```

If this method is never called, the workflow will remain blocked waiting for the signal.

---

## 12) Is the workflow ID/handle correct?

The app stores the workflow handle on the case in MongoDB as:

```python
"temporal_workflow_id": handle.id
```

If the case does not have this field populated, the workflow likely did not start correctly.

---

## 13) Check Temporal UI directly

Open:

```text
http://localhost:8233
```

Look for:

- workflow execution list
- workflow type
- status
- task queue
- execution history

This is the fastest way to see whether the system is alive and whether the workflow is stuck or failed.

---

## 14) Verify the worker is listening on the queue

Use the backend route or direct worker logs:

- [backend/routes/temporal_routes.py](backend/routes/temporal_routes.py)

The route `/api/temporal/workers` can show poller details.

Check the task queue name and pollers list to confirm the worker is connected.

---

## 15) If a workflow appears but never moves forward

Check these in order:

1. task queue matches worker queue
2. namespace matches
3. signal is actually being sent
4. case state is still active
5. workflow is waiting on a human step and not blocked on something else

---

## 16) Quick command checklist

### Check Python package

```powershell
cd C:\development\workflow\backend
.\venv\Scripts\python.exe -c "import temporalio; print(temporalio.__file__)"
```

### Check worker

```powershell
cd C:\development\workflow\backend
.\venv\Scripts\python.exe -m temporal_worker.worker
```

### Check Temporal dev server

```powershell
temporal server start-dev --ui-port 8233
```

### Check Temporal UI

```text
http://localhost:8233
```

### Check backend API health

```powershell
Invoke-RestMethod http://localhost:8000/api/temporal/health
```

---

## 17) Most common root causes in this project

- `temporalio` not installed in the active venv
- Temporal server not running
- worker not started
- wrong task queue
- wrong namespace
- workflow waiting for a signal that never gets sent
- case type `use_temporal` flag left false

---

## 18) Rule of thumb

If a workflow never appears:

- check server + worker + queue + venv

If a workflow appears but never proceeds:

- check signal path and active step state

If the API returns success but nothing happens in Temporal:

- check whether the backend silently swallowed a Temporal exception during workflow start

---

## 19) Best debugging sequence

Use this order:

1. verify `temporalio` import works
2. start Temporal server
3. start Temporal worker
4. confirm task queue and namespace
5. verify case type has `use_temporal = true`
6. create case and inspect Temporal UI
7. trace signal flow from the UI/API to the workflow

This order usually finds the issue quickly.
