# Temporal Integration — Implementation Reference

> **Status:** Sprint T-1 ✅ · Sprint T-2 ✅ · Sprint T-3 ✅  
> **Python SDK:** `temporalio==1.7.1`  
> **Temporal Server:** `temporalio/auto-setup:1.24`  
> **Temporal Web UI:** `http://localhost:8088`

---

## Overview

Temporal is layered **additively** on top of the existing Pega-Lite engine. All existing code is unchanged. Cases opt in to durable execution via a per–case-type flag (`use_temporal: true`). Cases without the flag continue using the existing in-process engine.

```
Without Temporal (default):
  POST /api/cases → instantiate_case() → engine activates steps inline

With Temporal (opt-in):
  POST /api/cases → instantiate_case() → start CaseWorkflow in Temporal
  PATCH /api/assignments/:id/complete → step_engine → signal CaseWorkflow
  PATCH /api/approvals/:id/approve → step_engine → signal CaseWorkflow
```

---

## What Temporal Adds

| Problem | Temporal Solution |
|---|---|
| API restart mid-workflow leaves case stuck | `CaseWorkflow` resumes from last event on restart |
| Automation step fails on transient network error | Activity retry policy (20 attempts, exponential backoff) |
| SLA check is a 15-min polling loop | `SLAWorkflow` sleeps until exact deadline — event-driven |
| Parallel processes have no join guarantee | Temporal's async/await in workflow code provides coordination |
| No visibility into in-flight workflow state | Temporal Web UI + `/api/temporal/*` proxy endpoints |

---

## Architecture

```
Angular :4200
  /temporal → TemporalDashboardComponent
  /temporal/workflows → TemporalWorkflowListComponent
  /temporal/workflows/:id → TemporalWorkflowDetailComponent
        ↓ HTTP
FastAPI :8000
  /api/temporal/health
  /api/temporal/workflows
  /api/temporal/workflows/:id
  /api/temporal/cases/:id/start
  /api/temporal/workers
        ↓ gRPC :7233
Temporal Server (auto-setup:1.24)
  Persistence: PostgreSQL :5432
  Web UI: :8088
        ↑ long-poll
Temporal Worker (separate container)
  Workflows: CaseWorkflow, SLAWorkflow
  Activities: case_activities, step_activities, mail_activities
        ↓
MongoDB :27017
```

---

## File Inventory

### Backend — New Files

| File | Purpose |
|---|---|
| `temporal_worker/__init__.py` | Package marker |
| `temporal_worker/client.py` | Singleton `TemporalClient` (cached, shared by API + worker) |
| `temporal_worker/worker.py` | Worker entry point — `python -m temporal_worker.worker` |
| `temporal_worker/activities/case_activities.py` | `get_case`, `get_case_type`, `advance_stage`, `resolve_case` |
| `temporal_worker/activities/step_activities.py` | `get_active_step`, `get_step_status`, `complete_step` |
| `temporal_worker/activities/mail_activities.py` | `send_mail`, `send_sla_escalation` |
| `temporal_worker/workflows/case_workflow.py` | `CaseWorkflow` — signal-driven durable state machine |
| `temporal_worker/workflows/sla_workflow.py` | `SLAWorkflow` — precise timer + escalation |
| `routes/temporal_routes.py` | Proxy endpoints (`/api/temporal/*`) |
| `Dockerfile.worker` | Worker container entry point |

### Backend — Modified Files (additive only)

| File | Change |
|---|---|
| `config.py` | + `temporal_host`, `temporal_namespace`, `temporal_task_queue` settings |
| `requirements.txt` | + `temporalio==1.7.1` |
| `main.py` | + register `temporal_router`; + `http://localhost:8088` in default CORS |
| `models/case_types.py` | + `use_temporal: bool = False` on Create / Update / Response models |
| `routes/cases.py` | + start `CaseWorkflow` after `instantiate_case()` when flag is set |
| `routes/assignments.py` | + signal `step_completed` to workflow after step completion |
| `routes/approvals.py` | + signal `step_completed` to workflow after approve/reject |
| `docker-compose.yml` | + `postgresql`, `temporal`, `temporal-ui`, `temporal-worker` services |

### Frontend — New Files

| File | Purpose |
|---|---|
| `features/temporal/temporal.routes.ts` | Lazy-loaded route definitions |
| `features/temporal/services/temporal.service.ts` | HTTP client for `/api/temporal/*` |
| `features/temporal/temporal-dashboard/temporal-dashboard.component.ts` | Health + stats + "Open Temporal UI" button |
| `features/temporal/temporal-workflow-list/temporal-workflow-list.component.ts` | Searchable list with status filter |
| `features/temporal/temporal-workflow-detail/temporal-workflow-detail.component.ts` | History timeline |

### Frontend — Modified Files

| File | Change |
|---|---|
| `app.routes.ts` | + lazy-load `/temporal` route |
| `layout/shell.component.ts` | + "Temporal Workflows" item in Admin nav menu |
| `core/models/index.ts` | + `useTemporal?` on `CaseTypeDefinition`, `CaseTypeCreateRequest`, `CaseTypeUpdateRequest` |
| `core/services/api-data.service.ts` | + map `use_temporal` ↔ `useTemporal` in `mapCaseTypeDef`, `createCaseTypeDefinition`, `updateCaseTypeDefinition` |
| `features/admin/case-type-designer/case-type-designer.component.ts` | + "Durable Execution" toggle in Settings tab; `useTemporal` included in `save()` |

---

## Workflows

### CaseWorkflow

```
run(case_id) →
  loop:
    if resolved_signal → resolve_case_activity → return
    active_step = get_active_step_activity(case_id)
    if no active step:
      if case.status == resolved → return
      sleep 10s → continue
    if step.type == "automation":
      complete_step_activity (retry up to 20×, backoff 10s→10min)
    else (assignment / approval / attachment / decision / subprocess):
      wait_condition(pending_signal OR resolved_signal, timeout=30 days)
      consume signal → continue

Signals:
  step_completed(StepCompletedSignal)  ← sent by assignments route + approvals route
  case_resolved(CaseResolvedSignal)    ← sent manually or by resolve API

Queries:
  get_status() → { waiting_for_step, completed_steps }
```

### SLAWorkflow

```
run(SLAWorkflowParams) →
  sleep until sla_target_date  (durable timer)
  if cancelled → return "cancelled"
  for interval in escalation_intervals_hours:
    sleep interval hours
    if cancelled → return "cancelled"
    send_sla_escalation_activity(case_id)
  return "escalated"

Signal:
  cancel_sla()  ← sent when case resolves before SLA breach
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/temporal/health` | Required | Temporal cluster + namespace health |
| `GET` | `/api/temporal/workflows` | Required | List executions; filter by `?status=running\|completed\|failed\|timed_out` |
| `GET` | `/api/temporal/workflows/{id}` | Required | Execution detail + history events (max 200) |
| `POST` | `/api/temporal/cases/{case_id}/start` | Required | Manually start `CaseWorkflow` for an existing case |
| `GET` | `/api/temporal/workers` | Required | Active pollers on the task queue |

---

## Opt-In: Enabling Temporal for a Case Type

### Via Admin UI
1. Navigate to **Design → Case Type Designer** → open a case type
2. Go to the **Settings** tab
3. Toggle **"Enable Temporal Workflow"** (Durable Execution section)
4. Click **Save**

### Via API
```http
PATCH /api/case-types/{id}
{ "use_temporal": true }
```

New cases created from that case type will automatically start a `CaseWorkflow` in Temporal.

---

## Configuration (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `TEMPORAL_HOST` | `localhost:7233` | Temporal server gRPC address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_TASK_QUEUE` | `workflow-queue` | Task queue name (must match worker) |

---

## Running Locally

```bash
# Start all services (includes Temporal)
docker compose up

# Temporal Web UI
open http://localhost:8088

# Angular monitor
open http://localhost:4200/temporal

# Run worker directly (outside Docker, for development)
cd backend
python -m temporal_worker.worker
```

---

## Retry Policies

| Scenario | Policy |
|---|---|
| Default (DB reads, stage advance) | Initial 5s, ×2 backoff, max 5 min, 10 attempts |
| Automation steps | Initial 10s, ×2 backoff, max 10 min, 20 attempts |
| SLA escalation | Initial 10s, max 5 min, 5 attempts |
| Human step wait timeout | 30 days (configurable in `case_workflow.py`) |

---

## Temporal → Production (Temporal Cloud)

The only change needed to move from self-hosted to Temporal Cloud:

```bash
# docker-compose or k8s env
TEMPORAL_HOST=<namespace>.tmprl.cloud:7233
TEMPORAL_NAMESPACE=<your-namespace>
# Add mTLS cert paths to temporal_worker/client.py connect() call
```

The PostgreSQL + Temporal server containers are removed; Temporal Cloud manages persistence.
