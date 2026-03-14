# Workflow & Case Management Platform — Implementation Plan
### Angular 19.2.19 · Python Microservices · MongoDB · PEGA-Inspired Architecture

---

## Executive Summary

This plan delivers a PEGA-style workflow and case management platform in **4 phases**, starting with a production-ready MVP and incrementally adding intelligence, integrations, and enterprise features. The architecture draws from PEGA's **Case Lifecycle Management**, **Stage-Step-Task model**, and **BPM/AI hybrid** patterns — reimplemented on a modern open stack.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Angular 19.2.19 Frontend                   │
│  (Case Manager · Task Board · Flow Designer · Portals)  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│              API Gateway (FastAPI / Nginx)               │
└────┬──────────┬──────────┬──────────┬───────────────────┘
     │          │          │          │
  Case Svc  Task Svc  Auth Svc  Notify Svc  ... (Python Microservices)
     │          │          │          │
┌────▼──────────▼──────────▼──────────▼───────────────────┐
│                      MongoDB                             │
│   (Cases · Tasks · Users · Workflows · Audit Logs)      │
└─────────────────────────────────────────────────────────┘
```

### PEGA Concept Mapping

| PEGA Concept | This Platform Equivalent |
|---|---|
| Case Type | Workflow Template / Schema |
| Case | Workflow Instance |
| Stage | Phase / Stage in pipeline |
| Step | Task Group |
| Assignment | Task assigned to User/Team |
| Flow Action | Form-based Action |
| Decisioning | Conditional Routing Engine |
| Pulse | Activity Feed / Comments |
| SLA Rules | Deadline & Escalation Engine |
| Constellation UI | Angular Component Library |

---

## Phase 1 — MVP (Weeks 1–10)

> **Goal:** Working case & task management with user auth, basic workflow orchestration, and collaboration. Deployable and usable by a real team.

---

### 1.1 Backend — Core Services

**Tech:** Python 3.12, FastAPI, Motor (async MongoDB driver), Pydantic v2, PyJWT

#### Auth Service (`/services/auth`)

```
auth/
├── models/     user.py, role.py, session.py
├── routes/     login.py, register.py, token.py
├── middleware/ jwt_middleware.py
└── utils/      password.py, token.py
```

- JWT-based authentication (access + refresh tokens)
- Role definitions: `ADMIN`, `MANAGER`, `WORKER`, `VIEWER`
- Password hashing with bcrypt
- Session management in MongoDB

**MongoDB Collections:**
```json
users: { _id, email, name, role, team_ids, hashed_password, created_at, is_active }
sessions: { _id, user_id, token_hash, expires_at, device_info }
```

#### Case Service (`/services/case`)

Mirrors PEGA's Case Lifecycle — cases move through Stages → Steps → Tasks.

```
case/
├── models/     case.py, stage.py, step.py
├── routes/     cases.py, stages.py, actions.py
├── engine/     lifecycle.py, transitions.py
└── schemas/    case_schema.py (JSON Schema for case types)
```

**Case Document Schema:**
```json
{
  "_id": "CASE-2024-00042",
  "type": "loan_origination",
  "status": "open | pending | resolved | withdrawn",
  "stage": "underwriting",
  "priority": "high | medium | low | critical",
  "owner_id": "user_id",
  "team_id": "team_id",
  "fields": {},
  "stages": [{ "name": "intake", "status": "completed", "completed_at": "" }],
  "sla": { "target_date": "", "escalated": false },
  "created_at": "", "updated_at": "", "created_by": ""
}
```

**Key Endpoints:**
```
POST   /cases                    Create new case
GET    /cases                    List with filters (status, assignee, stage)
GET    /cases/{id}               Case detail with full history
PATCH  /cases/{id}/stage         Advance or revert stage
POST   /cases/{id}/actions       Execute a flow action (approve, reject, rework)
GET    /cases/{id}/audit         Full audit trail
```

#### Task Service (`/services/task`)

- Task CRUD with assignment to users or teams
- Dependencies: `sequential`, `parallel`, `conditional`
- Status machine: `pending → in_progress → completed | blocked | cancelled`
- Priority inheritance from parent case

```json
{
  "_id": "", "case_id": "", "title": "", "description": "",
  "assignee_id": "", "team_id": "", "status": "pending",
  "priority": "medium", "due_date": "",
  "depends_on": ["task_id_1"], "tags": [],
  "checklist": [{ "item": "", "checked": false }],
  "created_at": "", "updated_at": ""
}
```

#### Notification Service (`/services/notify`)

- In-app notifications stored in MongoDB
- WebSocket push via FastAPI + `asyncio`
- Email via SMTP (smtplib) — templated with Jinja2
- Notification types: `assignment`, `mention`, `status_change`, `sla_warning`, `comment`

---

### 1.2 Frontend — Angular 19.2.19

**Tech:** Angular 19.2.19, Angular Material, NgRx (state), RxJS, TailwindCSS

#### Module Structure
```
src/app/
├── core/              auth, http-interceptors, guards
├── shared/            components, directives, pipes
├── features/
│   ├── dashboard/     summary panel, activity feed
│   ├── cases/         case list, case detail, stage timeline
│   ├── tasks/         task board (Kanban), task list, task detail
│   ├── comments/      threaded comments, @mentions
│   └── admin/         user management, role management
├── layout/            shell, sidebar, header, nav
└── state/             NgRx store: cases, tasks, user, notifications
```

#### Key UI Components (PEGA Constellation-Inspired)

**Case Manager View**
- Left nav: Summary Panel, expandable stage tree
- Main: Case detail with stage/step progress bar (PEGA-style stage strip)
- Right panel: Pulse feed (comments, activity), related tasks

**Task Board**
- Kanban columns: Pending → In Progress → Review → Done → Blocked
- Drag-and-drop (CDK DragDrop)
- Quick filters: My Tasks, Team Tasks, Overdue, By Priority

**Stage Progress Strip**
- Visual horizontal stages (like PEGA's stage strip)
- Click to jump to stage details
- Status indicators: completed (✓), current (●), pending (○), skipped (–)

#### NgRx State Shape
```typescript
interface AppState {
  auth:          { user, token, role }
  cases:         { list, selected, loading, filters }
  tasks:         { list, myTasks, loading }
  notifications: { items, unreadCount }
  ui:            { sidebarOpen, theme }
}
```

#### Routing
```typescript
/dashboard              → Dashboard
/cases                  → Case list
/cases/:id              → Case detail
/cases/:id/tasks        → Tasks for a case
/tasks                  → My task board
/admin/users            → User management (ADMIN only)
```

---

### 1.3 Workflow Engine (Basic)

A lightweight orchestration engine in the Case Service — PEGA-inspired but without the overhead.

```python
# engine/lifecycle.py

class CaseLifecycleEngine:
    def transition(self, case_id, action, actor):
        case = await Case.get(case_id)
        rule = self.get_transition_rule(case.type, case.stage, action)
        
        if not rule.is_allowed(case, actor):
            raise TransitionDeniedError()
        
        next_stage = rule.next_stage
        await self.execute_on_exit_hooks(case)
        await case.update(stage=next_stage, updated_by=actor)
        await self.execute_on_enter_hooks(case, next_stage)
        await self.notify(case, action, actor)
        await self.write_audit(case, action, actor)
```

**Workflow Definition (JSON Schema):**
```json
{
  "type": "loan_origination",
  "stages": ["intake", "documents", "underwriting", "approval", "disbursement"],
  "transitions": [
    { "from": "intake", "action": "submit", "to": "documents", "roles": ["WORKER", "MANAGER"] },
    { "from": "underwriting", "action": "approve", "to": "approval", "roles": ["MANAGER"] },
    { "from": "underwriting", "action": "reject", "to": "intake", "roles": ["MANAGER"] }
  ]
}
```

---

### 1.4 MongoDB Schema Design

```
Collections:
  cases          — case instances
  case_types     — workflow definitions / templates
  tasks          — task instances
  comments       — threaded comments (linked to case or task)
  users          — user accounts
  teams          — team definitions
  notifications  — in-app notifications
  audit_logs     — immutable event trail
  sessions       — auth sessions

Indexes:
  cases:     { status, stage, owner_id, team_id, created_at, type }
  tasks:     { case_id, assignee_id, status, due_date }
  audit_logs: { case_id, timestamp }  — TTL index for retention
  notifications: { user_id, is_read, created_at }
```

---

### 1.5 Infrastructure (MVP)

```
docker-compose.yml
├── auth-service      :8001
├── case-service      :8002
├── task-service      :8003
├── notify-service    :8004
├── api-gateway       :8000  (Nginx reverse proxy)
├── mongodb           :27017
├── mongo-express     :8081  (dev admin UI)
└── angular-app       :4200
```

---

### Phase 1 Deliverables

| # | Deliverable | Notes |
|---|---|---|
| 1 | User auth with JWT, roles | Login, register, role-based guards |
| 2 | Case CRUD with stage lifecycle | Create, list, detail, transition |
| 3 | Task management (Kanban + List) | Assignment, status, priority |
| 4 | Threaded comments + @mentions | Per case and per task |
| 5 | In-app notifications + email | Assignment, mentions, SLA warnings |
| 6 | Audit trail | Immutable log of all actions |
| 7 | Admin: user & team management | CRUD, role assignment |
| 8 | Docker Compose deployment | Full local dev + staging setup |
| 9 | Angular shell with responsive nav | Stage strip, task board, case detail |

---

## Phase 2 — Enhanced Workflow & Collaboration (Weeks 11–18)

> **Goal:** Visual workflow designer, approval chains, document management, real-time collaboration.

---

### 2.1 Visual Workflow Designer (Angular)

PEGA Flow Designer equivalent — drag-and-drop workflow authoring.

**Tech:** Angular CDK, custom canvas renderer or `@antv/g6` / `mermaid`

**Features:**
- Drag shapes: Start, End, Task, Decision (diamond), Parallel Gateway, Sub-Process
- Connect with directed edges; set conditions on edges
- Export to JSON workflow definition consumed by the engine
- Import existing workflow to edit
- Validate for unreachable nodes, missing end states

**Workflow Definition v2 (supports branching):**
```json
{
  "nodes": [
    { "id": "n1", "type": "start" },
    { "id": "n2", "type": "task", "label": "Document Review", "assignee_role": "ANALYST" },
    { "id": "n3", "type": "decision", "label": "Approved?",
      "branches": [
        { "condition": "approved == true", "next": "n4" },
        { "condition": "approved == false", "next": "n5" }
      ]
    },
    { "id": "n4", "type": "task", "label": "Fund Disbursement" },
    { "id": "n5", "type": "task", "label": "Send Rejection Notice" },
    { "id": "n6", "type": "end" }
  ]
}
```

---

### 2.2 Approval Workflow Engine

- Multi-level approval chains (sequential or parallel)
- Dynamic routing based on case field values (e.g., `amount > 100000 → senior_approver`)
- Delegation: approver can delegate to another user
- Mobile-friendly approve/reject with comments
- Escalation if SLA breached — auto-reassign to manager

```python
# approval_chain.py

class ApprovalChain:
    def build_chain(self, case, workflow_def):
        # Evaluate dynamic routing rules
        approvers = self.resolve_approvers(case, workflow_def)
        return ApprovalChainInstance(case_id=case.id, approvers=approvers)
    
    async def record_decision(self, chain_id, approver_id, decision, comment):
        # Record and check if all required approvals met
        ...
```

---

### 2.3 Document Management

**Backend:**
- File upload: FastAPI `UploadFile`, stored in local volume (S3-compatible interface for future)
- Metadata stored in MongoDB: `{ file_id, case_id, task_id, name, type, size, version, uploaded_by, tags }`
- Versioning: new upload creates new version, previous retained
- Virus scan hook (ClamAV) before storing

**Frontend:**
- Drag-and-drop upload zone in case detail
- Document list with version history drawer
- In-browser preview: PDF (ngx-extended-pdf-viewer), images
- Download + delete (with permission check)

---

### 2.4 Real-Time Collaboration

**Tech:** FastAPI WebSockets, Angular WebSocket service

- Live task status updates across all connected users
- Presence indicators (who's viewing this case right now)
- Live comment feed — no page refresh needed
- Optimistic UI updates with conflict resolution

```typescript
// websocket.service.ts
this.ws$ = webSocket(`ws://api/ws/${caseId}?token=${token}`);
this.ws$.pipe(
  filter(msg => msg.type === 'task_updated'),
  tap(msg => this.store.dispatch(taskUpdated({ task: msg.payload })))
).subscribe();
```

---

### 2.5 SLA & Deadline Engine

- SLA definitions on workflow types: `{ stage: "underwriting", sla_hours: 48 }`
- Background worker (APScheduler) checks SLAs every 15 min
- Escalation levels: Warning (75%) → Breach (100%) → Critical (125%)
- Auto-escalation: reassign to manager tier, send alerts
- SLA dashboard: heatmap of at-risk cases

---

### Phase 2 Deliverables

| # | Deliverable |
|---|---|
| 1 | Visual workflow designer (drag-and-drop) |
| 2 | Multi-level approval chains with delegation |
| 3 | Document upload, versioning, preview |
| 4 | Real-time WebSocket updates + presence |
| 5 | SLA engine with escalation and alerting |
| 6 | Rework / rejection loop (return to earlier stage) |
| 7 | Form builder for case field capture |
| 8 | Workflow template library |

---

## Phase 3 — AI / GenAI Integration (Weeks 19–28)

> **Goal:** Embed AI agents, intelligent routing, content generation, and semantic search. PEGA Next-Best-Action equivalent.

---

### 3.1 AI Agent Framework

Pluggable agent architecture. Each agent handles a domain.

```
agents/
├── base_agent.py           Abstract agent interface
├── summarization_agent.py  Summarize case history + docs
├── routing_agent.py        Intelligent task/case assignment
├── qa_agent.py             Answer questions about a case
├── extraction_agent.py     Extract fields from uploaded documents
└── recommendation_agent.py Suggest next best action
```

**Agent Interface:**
```python
class BaseAgent:
    async def run(self, context: AgentContext) -> AgentResult:
        raise NotImplementedError

class AgentContext:
    case_id: str
    user_query: str
    case_data: dict
    documents: list[str]   # extracted text
    history: list[dict]    # conversation turns
```

**LLM Integration:** OpenAI-compatible API (supports OpenAI, Azure OpenAI, Ollama, Anthropic via adapters)

```python
# llm_client.py
async def complete(prompt, system="", model="gpt-4o"):
    response = await openai.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content
```

---

### 3.2 Case Summarization

- Auto-generate case summary from: case fields + audit trail + comments + documents
- "What happened so far" narrative for new assignees
- Triggered on: case assignment, stage transition, on-demand

```
POST /cases/{id}/summarize
→ Returns: { summary, key_decisions, pending_actions, risk_flags }
```

---

### 3.3 Document Intelligence

- Extract structured fields from uploaded PDFs/images using LLM
- Auto-populate case fields from extracted data (with human review step)
- Confidence scores; low-confidence fields flagged for manual verification

```python
async def extract_from_document(file_path, case_type_schema):
    text = extract_text(file_path)   # PyMuPDF / pdfplumber
    prompt = build_extraction_prompt(text, case_type_schema)
    result = await llm_complete(prompt)
    return parse_structured_output(result)
```

---

### 3.4 Semantic Search

**Tech:** MongoDB Atlas Vector Search or pgvector fallback; text-embedding-3-small

- Embed all case descriptions, comments, documents at write time
- Semantic search across entire case repository
- "Find cases similar to this one" — for resolution time estimation
- Search with natural language: "overdue cases in underwriting assigned to Sarah"

```python
# embedding_service.py
async def embed_and_store(doc_id, text, collection):
    vector = await get_embedding(text)  # OpenAI or local model
    await collection.update_one({ "_id": doc_id },
        { "$set": { "embedding": vector } })
```

---

### 3.5 Intelligent Task Routing

- Score assignees by: current workload, domain expertise, past resolution time, availability
- Suggest best assignee when creating a task
- Load balancing across teams
- Human can override suggestion

---

### 3.6 AI Chat Assistant (Case Copilot)

- Embedded chat panel in case detail (Angular side panel)
- Context: full case data, documents, history
- Capabilities: answer questions, draft responses, highlight blockers, suggest actions
- Streamed responses via Server-Sent Events

```typescript
// copilot.service.ts
askCopilot(caseId: string, query: string): Observable<string> {
  return this.http.post('/ai/copilot', { caseId, query },
    { responseType: 'text', observe: 'events' });
}
```

---

### Phase 3 Deliverables

| # | Deliverable |
|---|---|
| 1 | Pluggable AI agent framework |
| 2 | Case auto-summarization |
| 3 | Document field extraction (PDF, images) |
| 4 | Semantic case search with embeddings |
| 5 | Intelligent task routing with scoring |
| 6 | AI Case Copilot (streaming chat) |
| 7 | Next-best-action recommendations |
| 8 | Risk flag detection in case data |

---

## Phase 4 — Enterprise Features (Weeks 29–40)

> **Goal:** Enterprise integrations, multi-tenancy, advanced analytics, compliance, and production hardening.

---

### 4.1 Enterprise Integrations

#### SSO & Identity
- SAML 2.0 + OAuth2/OIDC (python-social-auth / authlib)
- LDAP/Active Directory sync for user provisioning
- MFA via TOTP (pyotp)

#### JIRA & ServiceNow
- Bi-directional sync: create JIRA issue from case, update case from JIRA webhook
- Map case stages to JIRA statuses
- ServiceNow incident linking

#### Communication
- Slack integration: case notifications in Slack channel, slash commands
- MS Teams webhook notifications
- Email-to-case: inbound email creates/updates cases

---

### 4.2 Advanced Analytics & Reporting

**Tech:** MongoDB Aggregation Pipeline + Apache ECharts (Angular)

**Dashboards:**
- Executive: case volume, SLA breach rate, resolution time trends
- Operational: team workload, bottleneck stages, backlog aging
- Individual: my tasks velocity, completion rate

**Custom Report Builder:**
- Drag-and-drop field selector
- Filters, grouping, aggregations
- Export to XLSX, PDF, CSV
- Scheduled email delivery

---

### 4.3 Multi-Tenancy

- Tenant isolation via `tenant_id` field + MongoDB multi-collection strategy
- Tenant-specific workflow definitions, roles, UI themes
- Per-tenant feature flags
- Tenant admin portal

---

### 4.4 Compliance & Governance

- Immutable audit log (append-only collection, no update/delete)
- Data retention policies (MongoDB TTL indexes per tenant config)
- GDPR: right-to-erasure (anonymization, not deletion of audit records)
- Field-level encryption for sensitive data (MongoDB CSFLE)
- Compliance report generator (SOC2, GDPR checklists)

---

### 4.5 Developer Portal

- Auto-generated OpenAPI docs (FastAPI built-in)
- Webhook management UI: subscribe to events, view delivery logs
- SDK generation (openapi-generator-cli)
- Sandbox environment with seeded data
- API key management

---

### 4.6 Production Infrastructure

```yaml
# Kubernetes deployment targets
services:
  - auth-service:     2 replicas, HPA (cpu 70%)
  - case-service:     3 replicas, HPA
  - task-service:     2 replicas
  - notify-service:   2 replicas
  - ai-service:       1-2 replicas (GPU optional)
  - api-gateway:      2 replicas (Nginx Ingress)

databases:
  - MongoDB Atlas (M10+) or self-hosted replica set (3 nodes)
  - Redis:            notification queue, session cache

monitoring:
  - Prometheus + Grafana
  - Jaeger distributed tracing (OpenTelemetry)
  - Sentry (error tracking)
  - ELK stack (log aggregation)
```

---

### Phase 4 Deliverables

| # | Deliverable |
|---|---|
| 1 | SSO/OIDC + MFA |
| 2 | JIRA & ServiceNow bi-directional sync |
| 3 | Slack / Teams notification integration |
| 4 | Advanced analytics dashboards |
| 5 | Custom report builder with export |
| 6 | Multi-tenancy with tenant admin portal |
| 7 | GDPR compliance + field-level encryption |
| 8 | Kubernetes Helm charts + CI/CD pipeline |
| 9 | OpenAPI developer portal + SDK |
| 10 | Full observability stack |

---

## Project Timeline Summary

```
Phase 1 — MVP              Weeks  1–10    (10 weeks)
Phase 2 — Enhanced WF      Weeks 11–18    ( 8 weeks)
Phase 3 — AI Integration   Weeks 19–28    (10 weeks)
Phase 4 — Enterprise       Weeks 29–40    (12 weeks)
                                     ───────────────
Total                                     40 weeks
```

---

## Technology Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Angular 19.2.19, Angular Material, NgRx, TailwindCSS, Angular CDK |
| Backend | Python 3.12, FastAPI, Pydantic v2, Motor (async MongoDB) |
| Database | MongoDB 7.x (replica set), Redis (cache/queue) |
| Auth | JWT (PyJWT), bcrypt, python-jose, authlib (OAuth2/OIDC) |
| AI/LLM | OpenAI SDK, LangChain (agents), PyMuPDF (doc extraction) |
| Real-time | FastAPI WebSockets, Server-Sent Events |
| Scheduler | APScheduler (SLA engine, scheduled workflows) |
| Infra | Docker, Docker Compose (dev), Kubernetes + Helm (prod) |
| Monitoring | Prometheus, Grafana, Jaeger, Sentry |
| CI/CD | GitHub Actions / GitLab CI |

---

## Team Structure Recommendation

| Role | Phase 1 | Phase 2–4 |
|---|---|---|
| Backend Engineers | 2 | 3 |
| Frontend Engineer | 1 | 2 |
| DevOps / Infra | 0.5 | 1 |
| AI/ML Engineer | — | 1 (Phase 3) |
| QA Engineer | 0.5 | 1 |

---

## Key Design Principles (PEGA-Aligned)

1. **Case-centric**: Everything revolves around the Case, not tasks or processes alone
2. **Stage-Step-Task hierarchy**: Mirrors PEGA's proven 3-tier model
3. **Human-in-the-Loop**: AI assists, humans decide on critical actions
4. **Declarative workflows**: Workflow definitions are data (JSON), not code
5. **Audit-first**: Every state change is logged before it happens
6. **Composability**: Services, agents, and workflows are independently pluggable
7. **API-first**: Every feature is API-accessible before being UI-accessible
