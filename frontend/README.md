# Workflow Platform

Full-stack Case & Task Management application with Angular 19 frontend and FastAPI Python backend.

---

## Prerequisites

- **Node.js:** v20.x or higher
- **npm:** v10.x or higher
- **Python:** 3.12.x
- **MongoDB:** 7.x (running locally on port 27017)

---

## Quick Start

### 1. Start MongoDB

Make sure MongoDB is running locally on `localhost:27017`.

### 2. Start Backend (Python/FastAPI)

```powershell
cd backend
python -m venv venv                    # Create virtual environment (first time only)
.\venv\Scripts\Activate.ps1            # Activate virtual environment
pip install -r requirements.txt        # Install dependencies (first time only)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> If `Activate.ps1` fails, run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` first.

The backend will:
- Connect to MongoDB at `localhost:27017`
- Seed initial data (users, teams, cases, tasks, etc.)
- Start the SLA background scheduler
- Serve the API at **http://localhost:8000**
- Swagger docs at **http://localhost:8000/docs**

**Backend `.env` file** (`backend/.env`):
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=workflow_platform
JWT_SECRET=workflow-dev-secret-change-in-production
CORS_ORIGINS=["http://localhost:4200"]
```

### 3. Start Frontend (Angular)

```powershell
cd frontend
npm install           # Install dependencies (first time only)
npm start             # Start dev server at http://localhost:4200
```

### 4. Switch Between Mock & Real API

In `frontend/src/environments/environment.ts`:

```typescript
useMock: true,    // Use mock data (no backend needed)
useMock: false,   // Use real backend API
```

---

## Login Credentials

### Mock Mode (useMock: true) — any non-empty password works

| Email | Role |
|-------|------|
| admin@example.com | ADMIN |
| manager@example.com | MANAGER |
| worker@example.com | WORKER |
| viewer@example.com | VIEWER |

### Real API Mode (useMock: false) — uses seeded passwords below

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | ADMIN |
| alice@example.com | demo123 | MANAGER |
| bob@example.com | demo123 | WORKER |
| carol@example.com | demo123 | WORKER |

### Role Visibility

| Section | ADMIN | MANAGER | WORKER | VIEWER |
|---------|-------|---------|--------|--------|
| Navigation (Dashboard, Cases, Tasks, Docs, Approvals) | Yes | Yes | Yes | Yes |
| Tools (Workflow Designer, Form Builder, SLA Dashboard) | Yes | Yes | No | No |
| Admin - Users, Teams, Workflows | Yes | No | No | No |
| Admin - Teams only | — | Yes | No | No |

---

## Project Structure

```
workflow/
├── backend/                   # FastAPI Python backend
│   ├── main.py                # App entry point, lifespan, routers
│   ├── config.py              # Settings (MongoDB, JWT, CORS)
│   ├── database.py            # MongoDB connection (Motor async)
│   ├── seed.py                # Seed data loader
│   ├── security.py            # JWT token handling
│   ├── auth_deps.py           # Auth dependency injection
│   ├── routes/                # API route modules
│   ├── models/                # Pydantic models
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Container build
│   └── .env                   # Local environment overrides
├── frontend/                  # Angular 19 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/          # Services, models, guards, interceptors
│   │   │   ├── features/      # Feature components
│   │   │   │   ├── admin/     # User, Team, Workflow management
│   │   │   │   ├── auth/      # Login, Register
│   │   │   │   ├── cases/     # Case list, detail, create
│   │   │   │   ├── tasks/     # Kanban board
│   │   │   │   ├── comments/  # Threaded comments
│   │   │   │   ├── dashboard/ # Dashboard with stats
│   │   │   │   ├── approvals/ # Approval workflows
│   │   │   │   ├── documents/ # Document management
│   │   │   │   ├── workflows/ # Workflow designer
│   │   │   │   ├── forms/     # Form builder & renderer
│   │   │   │   └── sla/       # SLA dashboard
│   │   │   ├── layout/        # Shell (toolbar + sidebar)
│   │   │   ├── shared/        # Shared components
│   │   │   ├── state/         # NgRx stores (auth, cases, tasks, etc.)
│   │   │   ├── app.routes.ts  # Application routing
│   │   │   └── app.config.ts  # App configuration
│   │   ├── environments/      # Environment configs
│   │   └── styles.scss        # Tailwind integration
│   ├── angular.json           # Angular CLI config
│   ├── tailwind.config.js     # Tailwind CSS config
│   └── package.json           # Node dependencies
└── docker-compose.yml         # Docker setup (alternative)
```

## Key Features

### Authentication
- Login/Register with email & password
- JWT-based auth with role support (ADMIN, MANAGER, WORKER, VIEWER)
- Auth guard on all protected routes

### Case Management
- Case list with Material table, filters, search, pagination
- Case detail with stage progression (5 stages)
- New Case wizard (3-step stepper with dynamic fields)

### Task Management
- Kanban board with CDK drag-drop (5 columns)
- Task filters by assignee, priority, due date
- Checklist tracking with progress bars

### Documents
- Drag & drop file upload
- File preview (PDF, images)
- Version history tracking

### Approvals
- Sequential/parallel approval chains
- Approve, reject, delegate actions

### Workflows
- Visual workflow designer
- Node-based workflow definition

### Forms
- Dynamic form builder with sections
- Form renderer with field validation

### SLA Dashboard
- SLA breach monitoring
- Escalation tracking

### Administration
- User management (ADMIN only)
- Team management (ADMIN + MANAGER)
- Workflow management (ADMIN only)

---

## Development Commands

### Frontend

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server at http://localhost:4200 |
| `npm run build` | Build with dev config |
| `npm run build:prod` | Build for production |
| `npm run watch` | Build in watch mode |
| `npm test` | Run unit tests |
| `npm run lint` | Run ESLint |
| `npm run e2e` | Run Cypress E2E tests (headless) |
| `npm run e2e:headed` | Run Cypress E2E tests (visible browser) |
| `npm run cy:open` | Open Cypress interactive UI |
| `npm run cy:run` | Run Cypress tests (alias for e2e) |

### Backend

| Command | Description |
|---------|-------------|
| `.\venv\Scripts\Activate.ps1` | Activate Python virtual env |
| `deactivate` | Exit virtual env |
| `pip install -r requirements.txt` | Install/update Python deps |
| `uvicorn main:app --reload --port 8000` | Start server with hot reload |

### MongoDB

| Command | Description |
|---------|-------------|
| `mongosh` | Open MongoDB shell |
| `mongosh --eval "use workflow_platform; db.getCollectionNames()"` | List seeded collections |
| `mongosh --eval "use workflow_platform; db.cases.countDocuments()"` | Count cases |

---

## E2E Testing (Cypress)

Cypress is configured as an **optional dependency** — it won't block `npm install` if the binary fails to download (e.g. in CI without browser support).

### Prerequisites

Both servers must be running before executing E2E tests:

```powershell
# Terminal 1 — Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
npm start
```

### Running Tests

```powershell
cd frontend

# Headless (CI-friendly, no visible browser)
npm run e2e

# Headed (visible browser window)
npm run e2e:headed

# Interactive Cypress UI (pick & run individual specs)
npm run cy:open

# Run a single spec file
npx cypress run --spec "cypress/e2e/auth.cy.ts"
```

### Test Specs (51 tests across 7 files)

| Spec | Tests | Coverage |
|------|-------|----------|
| `auth.cy.ts` | 9 | Login (3 roles), invalid credentials, password toggle, register link, auth guard redirect |
| `cases.cy.ts` | 11 | Case list, filters, table, pagination, case detail, stage journey, tabs, create navigation |
| `dashboard.cy.ts` | 6 | Stats cards (Open Cases, Critical, My Tasks, Overdue), recent items, View All links |
| `navigation.cy.ts` | 9 | Toolbar, sidebar nav, Tools section, Admin section, page navigation, user menu, logout |
| `roles.cy.ts` | 7 | Admin full access, Manager tools + limited admin, Worker no admin/tools, page access per role |
| `tasks.cy.ts` | 5 | Kanban board, 5 columns, filters, task cards, card details |
| `workflow.cy.ts` | 4 | Full login→dashboard→cases→detail flow, all-pages navigation, login→logout cycle |

### Project Structure

```
frontend/
├── cypress.config.ts          # Cypress configuration
├── cypress/
│   ├── tsconfig.json          # TypeScript config for Cypress
│   ├── support/
│   │   ├── e2e.ts             # Support file (loaded before each spec)
│   │   └── commands.ts        # Custom commands (login, loginAsAdmin, etc.)
│   └── e2e/
│       ├── auth.cy.ts         # Authentication flow tests
│       ├── cases.cy.ts        # Case list & detail tests
│       ├── dashboard.cy.ts    # Dashboard tests
│       ├── navigation.cy.ts   # Shell/sidebar navigation tests
│       ├── roles.cy.ts        # Role-based access tests
│       ├── tasks.cy.ts        # Task kanban board tests
│       └── workflow.cy.ts     # End-to-end workflow tests
```

### Custom Commands

Available in all specs via `cypress/support/commands.ts`:

| Command | Description |
|---------|-------------|
| `cy.login(email, password)` | Login with any credentials |
| `cy.loginAsAdmin()` | Login as admin@example.com / admin123 |
| `cy.loginAsManager()` | Login as alice@example.com / demo123 |
| `cy.loginAsWorker()` | Login as bob@example.com / demo123 |
| `cy.logout()` | Sign out via user menu |

---

## Tech Stack

### Frontend
- **Angular** 19.2.19 (standalone components, signals, new control flow)
- **Angular Material** 19.2.19 (MDC-based UI components)
- **Angular CDK** 19.2.19 (drag-drop, layout)
- **NgRx** 18.0.0 (state management with strict checks)
- **Tailwind CSS** 3.4.1
- **RxJS** 7.8.1

### Backend
- **FastAPI** 0.115.0
- **Python** 3.12
- **Motor** 3.5.0 (async MongoDB driver)
- **Pydantic** v2 (validation)
- **python-jose** (JWT auth)
- **passlib** (password hashing)

### Database
- **MongoDB** 7.x

---

## Connecting to Backend

The frontend uses a factory pattern with abstract services. The `useMock` flag in `environment.ts` controls which implementation is used:

- `useMock: true` — `MockDataService` / `MockAuthService` (no backend needed)
- `useMock: false` — `ApiDataService` / `ApiAuthService` (requires running backend + MongoDB)

### Environment Config

**Development** (`environment.ts`):
```typescript
apiUrl: 'http://localhost:8000/api'
useMock: false
```

**Production** (`environment.prod.ts`):
```typescript
apiUrl: 'https://api.workflow.example.com/api'
production: true
```

## Seed Data (MongoDB)

### Automatic Seeding

The backend **automatically seeds** all data on first startup. When `uvicorn` starts, the `lifespan` function in `main.py` calls `seed_all()` from `seed.py`. It checks if the `users` collection is empty — if yes, it inserts all seed data. If data already exists, it skips seeding.

**No manual steps needed** — just start the backend and it handles everything.

### Manual Seeding / Re-seeding

If you need to **re-seed** (e.g. data got corrupted, or you want a fresh start):

#### Step 1: Drop the database

Open a terminal and run:

```powershell
# If mongosh is installed locally:
mongosh --eval "use workflow_platform; db.dropDatabase()"

# Or via Python (from the backend folder with venv activated):
cd backend
.\venv\Scripts\Activate.ps1
python -c "
from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017')
client.drop_database('workflow_platform')
print('Database dropped successfully')
"
```

#### Step 2: Restart the backend

```powershell
# If uvicorn is already running with --reload, just save any file to trigger restart
# Or stop and restart:
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will detect an empty database and re-seed automatically.

#### Step 3: Verify the seed data

```powershell
# Test login (proves users were seeded):
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"

# Or via PowerShell:
$body = @{email="admin@example.com"; password="admin123"} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method POST -Body $body -ContentType "application/json"
```

### What Gets Seeded

The `seed.py` file creates the following data:

| Collection | Count | Details |
|------------|-------|---------|
| users | 4 | Admin, Alice (MANAGER), Bob (WORKER), Carol (WORKER) |
| teams | 1 | Loan Processing (all 4 users) |
| case_types | 1 | Loan Origination (5 stages, field schema) |
| cases | 3 | Documents stage, Underwriting stage, Approval stage |
| tasks | 5 | Various statuses: pending, in_progress, completed, blocked |
| comments | 2 | With @mentions |
| notifications | 5 | Assignment, SLA warning, mention, status change |
| workflows | 1 | Loan Origination (8 nodes, 8 edges) |
| approval_chains | 1 | Sequential approval for case-3 |
| sla_definitions | 3 | Per-stage SLA targets (24h, 72h, 120h) |
| case_forms | 1 | Loan Intake Form (8 fields, 2 sections) |
| approval_routing_rules | 2 | High-value and commercial loan rules |
| documents | 2 | PDF metadata (W-2, financials) |

### Seed Data File Location

All seed data is defined in: `backend/seed.py`

To customize seed data, edit that file and re-seed (drop database + restart backend).

---

## Mock Data (when useMock: true)

Pre-configured mock data includes:
- 4 users (Alice/MANAGER, Bob/WORKER, Carol/WORKER, Dave/ADMIN)
- 2 teams (Lending Operations, Compliance)
- 2 case types (loan_origination, support_ticket) with field schemas
- 3 cases at different stages
- 5 tasks with dependencies and checklists
- Comments, notifications, workflows, documents, forms

All mock responses simulate network latency (200-800ms delay).

---

## TypeScript Configuration

Strict mode enabled with path aliases:
- `@app/*` → `src/app/*`
- `@core/*` → `src/app/core/*`
- `@features/*` → `src/app/features/*`
- `@state/*` → `src/app/state/*`

---

## 🎯 Common Tasks

### Add a New Component
```bash
ng generate component features/my-feature/my-component --standalone
```

### Add a New Service
```bash
ng generate service core/services/my-service
```

### Generate NgRx Store
```bash
ng generate @ngrx/schematics:action state/my-feature/my-feature
ng generate @ngrx/schematics:effect state/my-feature/my-feature
ng generate @ngrx/schematics:reducer state/my-feature/my-feature
```

## Troubleshooting

### Port 4200 already in use
```powershell
ng serve --port 4300
```

### Module not found errors
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### TypeScript compilation errors
```powershell
Remove-Item -Recurse -Force .angular
ng serve
```

### Backend: uvicorn not recognized
Activate the virtual environment first:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
```

### Backend: Activate.ps1 opens as text file
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
.\venv\Scripts\Activate.ps1
```

### Backend: MongoDB connection refused
Make sure MongoDB is running on `localhost:27017` and the `.env` file has `MONGODB_URL=mongodb://localhost:27017`.

### Memory issues during build
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## Docker Setup (Alternative)

If you prefer containers instead of local installs:

```powershell
cd workflow
docker-compose up -d
```

This starts both MongoDB and the backend automatically. The frontend still runs locally with `npm start`.

---

## Resources

- [Angular Documentation](https://angular.io/docs)
- [Angular Material](https://material.angular.io)
- [NgRx Documentation](https://ngrx.io)
- [Tailwind CSS](https://tailwindcss.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Motor (Async MongoDB)](https://motor.readthedocs.io)

For issues or questions, refer to the main project documentation in the root `README-IMPLEMENTATION.md`.
