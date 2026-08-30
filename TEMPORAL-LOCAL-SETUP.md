# Running Locally Without Docker

> **Stack:** Python 3.11+, MongoDB (local), Temporal CLI, Angular 19  
> **Time to first run:** ~10 minutes

---

## Prerequisites Check

Open PowerShell and verify each tool is present:

```powershell
python --version      # need 3.11+
node --version        # need 18+
npm --version
mongosh --eval "db.adminCommand('ping')" --quiet   # need "{ ok: 1 }"
```

If MongoDB is not running, start it:
```powershell
# Windows Service
Start-Service MongoDB

# Or if installed via installer with default path
& "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db
```

---

## Step 1 — Install Temporal CLI

```powershell
# Option A: winget (recommended)
winget install Temporal.TemporalCLI

# Option B: manual
# Download from https://github.com/temporalio/cli/releases/latest
# temporal_windows_amd64.zip → extract → add extracted folder to PATH
```

Verify:
```powershell
temporal --version
# temporal version 1.1.x (or later)
```

---

## Step 2 — Install Python Dependencies

```powershell
cd c:\development\workflow\backend
pip install -r requirements.txt
```

Verify the Temporal SDK installed:
```powershell
pip show temporalio
# Name: temporalio
# Version: 1.7.1
```

---

## Step 3 — Create Backend `.env` File

```powershell
cd c:\development\workflow\backend

@"
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=workflow_platform
JWT_SECRET=workflow-dev-secret-change-in-production
CORS_ORIGINS=["http://localhost:4200","http://localhost:8233"]
TEMPORAL_HOST=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=workflow-queue
"@ | Set-Content .env
```

> Port `8233` = Temporal CLI Web UI. Port `7233` = gRPC (internal, not browser).

---

## Step 4 — Install Angular Dependencies

```powershell
cd c:\development\workflow\frontend
npm install
```

---

## Starting the Stack (4 Terminals)

Open 4 separate PowerShell terminals and run one command in each.

### Terminal 1 — Temporal Dev Server

```powershell
temporal server start-dev --ui-port 8233
```

Expected output:
```
Server:  localhost:7233
UI:      http://localhost:8233
Metrics: http://localhost:0/metrics
```

> The CLI dev server uses **embedded SQLite** — no PostgreSQL needed locally.  
> All Temporal workflow history is stored in memory (resets on restart).

---

### Terminal 2 — FastAPI Backend

```powershell
cd c:\development\workflow\backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Expected output:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

### Terminal 3 — Temporal Worker

```powershell
cd c:\development\workflow\backend
python -m temporal_worker.worker
```

Expected output:
```
[INFO] Connecting to MongoDB...
[INFO] Connecting to Temporal at localhost:7233 ...
[INFO] Worker started — task queue: workflow-queue  namespace: default
```

---

### Terminal 4 — Angular Frontend

```powershell
cd c:\development\workflow\frontend
npx ng serve
```

Expected output:
```
✔ Compiled successfully.
Local:   http://localhost:4200/
```

---

## Seed Demo Data

In a **new** terminal (after backend is running):

```powershell
cd c:\development\workflow\backend

# Seed the Temporal demo case type + sample cases
python seed_temporal_demo.py
```

What gets created:

| ID | Name | Status | Where in workflow |
|---|---|---|---|
| `ONB-001` | Sarah Chen | in_progress | **Stage 1 — Intake** (assignment step waiting) |
| `ONB-002` | Marcus Webb | in_progress | **Stage 2 — HR Review** (manager approval waiting) |
| `ONB-003` | Priya Patel | resolved | Full 4-stage lifecycle completed |

Case type **"Employee Onboarding (Temporal Demo)"** is created with `use_temporal: true` and 4 stages:
- **Intake** → assignment + attachment steps
- **HR Review** → approval step + automation (background check)
- **IT Setup** → 2 automation steps (email + Slack) + assignment (ship laptop)
- **Orientation** → 2 assignment steps → resolves case

---

## Open the Apps

| URL | What |
|---|---|
| `http://localhost:4200` | Angular app (login: `admin@example.com` / `password123`) |
| `http://localhost:4200/temporal` | Custom Temporal workflow monitor |
| `http://localhost:8233` | Temporal Web UI — full history, event viewer |
| `http://localhost:8000/docs` | FastAPI Swagger UI (all endpoints) |
| `http://localhost:8000/health` | API liveness check |

---

## Quick Smoke Tests

```powershell
# 1. API alive
Invoke-RestMethod http://localhost:8000/health
# { "status": "ok", "service": "workflow-api" }

# 2. Temporal cluster reachable via API (needs auth token in real use; or check swagger)
Invoke-RestMethod http://localhost:8000/api/temporal/health
# { "status": "ok", "namespace": "default" }

# 3. Temporal CLI direct check
temporal operator cluster health --address localhost:7233
# SERVING
```

---

## Verify a Temporal Workflow End-to-End

1. Log in → `http://localhost:4200` (admin@example.com / password123)
2. Go to **Portal → New Case** → select **"Employee Onboarding (Temporal Demo)"**
3. Fill in the employee name → Submit
4. Open **http://localhost:4200/temporal** — you should see a new `CaseWorkflow` with status `Running`
5. Click the workflow → view the event history timeline
6. Or open **http://localhost:8233** → Workflows → `case-ONB-xxx`

---

## Stopping Everything

```powershell
# In each terminal, press Ctrl+C

# Or kill by port if needed:
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 7233).OwningProcess | Stop-Process -Force
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: temporalio` | `pip install -r requirements.txt` in `backend/` |
| Worker: `Failed to connect to Temporal` | Start Terminal 1 (`temporal server start-dev`) first |
| `RuntimeError: Database not connected` | Backend must start before worker; check Terminal 2 |
| Angular `/temporal` shows "Unavailable" | Check Terminal 3 (worker) is running; check Terminal 2 for errors |
| `mongosh` not found | Add MongoDB bin folder to PATH or use `mongod` directly |
| Port 8000 already in use | `Get-NetTCPConnection -LocalPort 8000` → kill owning process |
