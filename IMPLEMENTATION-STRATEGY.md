# Workflow & Case Management Platform — Implementation Strategy

**Status:** Phase 1 & 2 Design Complete | Ready for Implementation

**Target:** Deliver Phase 1 MVP first, validate with team, then Phase 2

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Phase 1 Implementation Roadmap](#phase-1-implementation-roadmap)
3. [Phase 2 Implementation Roadmap](#phase-2-implementation-roadmap)
4. [Database Schema (Phase 1 & 2)](#database-schema-phase-1--2)
5. [API Contract Specifications](#api-contract-specifications)
6. [Key Design Decisions](#key-design-decisions)
7. [Validation & Testing Strategy](#validation--testing-strategy)

---

## Design Philosophy

### Core Principles
1. **Simplicity First:** Start with minimum viable features. No premature optimization.
2. **Modularity:** Each microservice has a single responsibility (Auth, Case, Task, Notify).
3. **PEGA-Inspired Pattern:** Cases → Stages → Steps/Tasks. Stateful workflows with clear transitions.
4. **Event-Driven:** All state changes trigger events (audit logs, notifications).
5. **Async-First Backend:** Use FastAPI's async patterns for scalability.
6. **Type Safety:** Pydantic v2 for API contracts, TypeScript for frontend.

### PEGA Concepts Mapped
| PEGA | Our Platform |
|------|---|
| Case Type | workflow template with stages |
| Case | case instance |
| Stage | workflow stage with entry/exit rules |
| Step | task or task group |
| Flow Action | REST endpoint that executes transition |
| Pulse | comments + activity feed |
| Assignment | task.assignee_id or team_id |
| SLA Rules | SLA definitions + background worker |

---

## Phase 1 Implementation Roadmap

### Sprint 1: Foundation (Week 1-2)
**Goal:** Project structure, Docker setup, Auth service ready

#### Tasks
- [ ] Create project directory structure
- [ ] Setup Docker Compose with all services
- [ ] Initialize Python FastAPI projects (auth, case, task, notify)
- [ ] Initialize Angular 19 project with NgRx
- [ ] Implement JWT auth service (register, login, token refresh)
- [ ] MongoDB connection + basic models
- [ ] Docker Compose passes health checks

#### Deliverables
- Full Docker stack running locally
- Auth endpoints working (POST /auth/register, POST /auth/login)
- JWT tokens issued and validated
- User collection in MongoDB

---

### Sprint 2: Core Case Service (Week 3-4)
**Goal:** Case CRUD + stage lifecycle engine

#### Tasks
- [ ] Case model + MongoDB schema
- [ ] Case CRUD endpoints (POST/GET/PATCH)
- [ ] Stage transition logic (rule-based)
- [ ] Workflow type definitions (JSON schema for stages/transitions)
- [ ] Audit log collection + middleware
- [ ] Role-based route guards
- [ ] Case query filters (by status, stage, owner, team)

#### Deliverables
- POST /cases → Create case instance
- GET /cases?status=open&stage=intake → List with filters
- GET /cases/{id} → Full case detail with history
- PATCH /cases/{id}/stage → Transition case
- GET /cases/{id}/audit → Audit trail

---

### Sprint 3: Task Service (Week 5-6)
**Goal:** Task management + Kanban support

#### Tasks
- [ ] Task model + relationship to cases
- [ ] Task CRUD endpoints
- [ ] Kanban status states (pending → in_progress → completed)
- [ ] Task assignment (to user or team)
- [ ] Task dependencies (sequential, parallel, conditional)
- [ ] Task priority + due dates
- [ ] Bulk task operations (reassign, status change)

#### Deliverables
- POST /tasks → Create task (linked to case)
- GET /tasks?assignee_id=me&status=pending → My task list
- PATCH /tasks/{id}/status → Update status
- PATCH /tasks/{id}/assignee → Reassign
- GET /tasks (Kanban board data)

---

### Sprint 4: Notifications + Comments (Week 7)
**Goal:** In-app notifications, email, threaded comments

#### Tasks
- [ ] Notification model (type, recipient, content, is_read)
- [ ] WebSocket server in notify-service
- [ ] Notification types (assignment, mention, status_change, sla_warning, comment)
- [ ] SMTP email configuration
- [ ] Comment model (text, mentions, created_at)
- [ ] @mention detection + notification trigger
- [ ] Notification preferences (per user, per type)

#### Deliverables
- Notifications sent on: task assignment, case transition, mention
- Email templates for key events
- In-app notification UI (bell icon, list)
- Comment thread per case + task

---

### Sprint 5: Frontend - Auth & Shell (Week 8)
**Goal:** Angular app foundation + auth flow + responsive layout

#### Tasks
- [ ] Angular project setup with Material, NgRx, TailwindCSS
- [ ] Login/Register pages
- [ ] JWT interceptor + unauthorized guard
- [ ] Role-based route guards
- [ ] Dashboard shell with sidebar
- [ ] Header + navigation
- [ ] Responsive layout (mobile-first)
- [ ] NgRx store setup (auth, cases, tasks, ui)

#### Deliverables
- /login page (working OAuth-style flow)
- /dashboard available only after auth
- Sidebar with case list + task board links
- Responsive to mobile/tablet/desktop

---

### Sprint 6: Frontend - Cases & Tasks (Week 9)
**Goal:** Case list, case detail, task Kanban board

#### Tasks
- [ ] Case list component with filters (status, stage, owner)
- [ ] Case detail component (timeline, stage strip, audit trail)
- [ ] Stage transition UI (button to move case forward)
- [ ] Task Kanban board (CDK DragDrop, columns: pending → done)
- [ ] Task card with drag/drop
- [ ] Task quick-edit (assignee, priority)
- [ ] Task detail drawer (full form)
- [ ] Comments section (threaded)
- [ ] Real-time notification badge

#### Deliverables
- /cases → Case list (filterable)
- /cases/:id → Case detail with full workflow info
- /tasks → Kanban board
- Comments visible on case/task detail

---

### Sprint 7: Admin & Integration Testing (Week 10)
**Goal:** User/team admin, e2e testing, Docker validation

#### Tasks
- [ ] Admin user management (CRUD users, assign roles)
- [ ] Admin team management (CRUD teams, assign members)
- [ ] Admin workflow type management (CRUD case types)
- [ ] E2E test: create user → login → create case → assign task → comment
- [ ] Performance test: simulate 100 concurrent users
- [ ] Docker Compose full stack test
- [ ] Documentation: API contracts, setup guide

#### Deliverables
- /admin/users (ADMIN only)
- /admin/teams (ADMIN only)
- /admin/workflows (ADMIN only)
- All Docker services healthy
- Phase 1 ready for validation

---

### Phase 1 Validation Checklist
- [ ] User registration & login works
- [ ] Case transitions follow workflow rules
- [ ] Tasks visible in Kanban, can be reassigned
- [ ] Comments + @mentions trigger notifications
- [ ] Notifications sent (in-app + email)
- [ ] Audit trail captures all state changes
- [ ] Role-based access control enforced
- [ ] Docker Compose starts all services cleanly
- [ ] Performance acceptable (sub-500ms response times)
- [ ] Team able to create & complete real workflow scenario

---

## Phase 2 Implementation Roadmap

### Sprint 8: Workflow Designer (Week 11-12)
**Goal:** Visual drag-drop workflow builder

#### Tasks
- [ ] Canvas component (@antv/g6 or custom)
- [ ] Draggable node types (Start, End, Task, Decision, Parallel)
- [ ] Edge connections with conditions
- [ ] Save workflow to JSON format
- [ ] Load workflow from JSON for editing
- [ ] Validate workflow (unreachable nodes, missing end)
- [ ] Export to workflow-definition.json
- [ ] Link to create case from workflow template

#### Deliverables
- /workflow-designer/:id → Editor (new/existing)
- POST /workflows → Save definition
- GET /workflows → List templates
- Workflows used as templates for case creation

---

### Sprint 9: Approval Engine (Week 13-14)
**Goal:** Multi-level approval chains with delegation

#### Tasks
- [ ] Approval chain model (sequential/parallel, dynamic routing rules)
- [ ] Create approval task when case reaches approval stage
- [ ] Approve/Reject endpoints with comment
- [ ] Delegation: approver can delegate to another user
- [ ] Auto-escalation: if SLA breached, notify manager
- [ ] Approval UI (mobile-friendly approve/reject form)
- [ ] Approval history dashboard

#### Deliverables
- POST /approvals/{id}/approve → Record approval
- POST /approvals/{id}/reject → Record rejection
- POST /approvals/{id}/delegate → Delegate to another user
- Approval tasks appear in task board

---

### Sprint 10: Document Management (Week 15)
**Goal:** Upload, version, preview documents

#### Tasks
- [ ] File upload endpoint (FastAPI UploadFile)
- [ ] Store files locally (volume mount in Docker)
- [ ] Document metadata in MongoDB (version, uploaded_by, tags)
- [ ] Version history (retain previous versions)
- [ ] PDF text extraction (PyMuPDF)
- [ ] Preview UI (PDF viewer, image gallery)
- [ ] Download + delete with permission check
- [ ] Virus scan hook (optional ClamAV)

#### Deliverables
- POST /documents → Upload file to case
- GET /documents?case_id=X → List versions
- GET /documents/{id}/preview → View in browser
- DELETE /documents/{id} (only by creator or admin)

---

### Sprint 11: Real-Time Collaboration (Week 16)
**Goal:** WebSocket live updates, presence, live comments

#### Tasks
- [ ] WebSocket connection per case (user presence)
- [ ] Broadcast task status changes to all viewers
- [ ] Live comment feed (no page refresh)
- [ ] Presence indicator (who's viewing this case now)
- [ ] Optimistic UI updates with conflict resolution
- [ ] Reconnection logic (exponential backoff)
- [ ] Memory cleanup on disconnect

#### Deliverables
- WS /ws/cases/{id} → Live feed
- Presence shown in case detail header
- Task updates real-time
- Comments appear instantly for all viewers

---

### Sprint 12: SLA & Escalation Engine (Week 17)
**Goal:** Background SLA checks + auto-escalation

#### Tasks
- [ ] SLA definition in workflow types (stage-specific hours)
- [ ] Background worker (APScheduler, runs every 15 min)
- [ ] Escalation levels (75%, 100%, 125%)
- [ ] Auto-escalation: reassign to manager, send alert
- [ ] SLA dashboard (heatmap of at-risk cases)
- [ ] Overdue queue (cases > SLA)
- [ ] Email alerts for SLA warnings

#### Deliverables
- Background worker checks SLAs every 15 min
- POST /sla/{id}/acknowledge → Acknowledge warning
- GET /dashboard/sla-status → Heatmap of at-risk cases
- Alerts sent 75% through SLA window

---

### Sprint 13: Form Builder & Templates (Week 18)
**Goal:** Dynamic field capture, workflow templates

#### Tasks
- [ ] Field types (text, select, date, checkbox, textarea)
- [ ] Form builder UI (drag fields, set validation)
- [ ] Form rendering on case detail
- [ ] Field-level permissions (who can edit)
- [ ] Workflow template library (reusable templates)
- [ ] Case creation from template (pre-fill fields)
- [ ] Field change audit trail

#### Deliverables
- /form-builder/:workflow_id → Editor
- GET /case-types/{id}/form → Render form
- POST /cases → Create from template with form data
- Field values stored in case.fields

---

### Phase 2 Validation Checklist
- [ ] Workflow designer creates valid workflows
- [ ] Template cases inherit field definitions
- [ ] Approval chain works end-to-end
- [ ] Documents upload, version, preview correctly
- [ ] Real-time collaboration (presence, live comments)
- [ ] SLA engine triggers escalations accurately
- [ ] Form builder creates functional forms
- [ ] Performance acceptable under load
- [ ] Team completes complex workflow with approval + docs

---

## Database Schema (Phase 1 & 2)

### Collections

```javascript
// ========== AUTH ==========
db.users {
  _id: ObjectId,
  email: string (unique),
  name: string,
  role: "ADMIN" | "MANAGER" | "WORKER" | "VIEWER",
  team_ids: [ObjectId],
  hashed_password: string,
  created_at: timestamp,
  is_active: boolean,
  preferences: { theme, language, notifications_enabled }
}

db.sessions {
  _id: ObjectId,
  user_id: ObjectId,
  token_hash: string,
  expires_at: timestamp,
  device_info: string,
  created_at: timestamp
}

// ========== CASES ==========
db.cases {
  _id: string ("CASE-2024-00042"),
  type: string ("loan_origination"),
  status: "open" | "pending" | "resolved" | "withdrawn",
  stage: string ("intake"),
  priority: "low" | "medium" | "high" | "critical",
  owner_id: ObjectId,
  team_id: ObjectId,
  fields: { [key]: value },  // Dynamic case-specific fields
  stages: [{
    name: string,
    status: "pending" | "in_progress" | "completed" | "skipped",
    completed_at: timestamp,
    entered_at: timestamp,
    completed_by: ObjectId
  }],
  sla: {
    target_date: timestamp,
    escalated: boolean,
    escalation_level: 0 | 1 | 2,  // 75%, 100%, 125%
    acknowledged_at: timestamp
  },
  created_at: timestamp,
  updated_at: timestamp,
  created_by: ObjectId,
  
  // Phase 2 additions
  document_ids: [ObjectId],
  approval_chain_id: ObjectId
}

db.case_types {
  _id: ObjectId,
  name: string,
  description: string,
  stages: [string],  // ["intake", "documents", "underwriting", "approval"]
  transitions: [{
    from: string,
    action: string,
    to: string,
    allowed_roles: [string]
  }],
  fields_schema: {  // Phase 2: Dynamic fields
    [field_name]: {
      type: "text" | "select" | "date" | "checkbox",
      label: string,
      required: boolean,
      options: [string],  // for select
      editable_roles: [string]
    }
  },
  sla_rules: [{
    stage: string,
    hours: number,
    escalation_enabled: boolean
  }],
  created_by: ObjectId,
  created_at: timestamp
}

// ========== TASKS ==========
db.tasks {
  _id: ObjectId,
  case_id: ObjectId,
  title: string,
  description: string,
  assignee_id: ObjectId (optional),
  team_id: ObjectId (optional),
  status: "pending" | "in_progress" | "completed" | "blocked" | "cancelled",
  priority: "low" | "medium" | "high" | "critical",
  due_date: timestamp,
  depends_on: [ObjectId],  // Task IDs
  dependency_type: "sequential" | "parallel" | "conditional",
  tags: [string],
  checklist: [{
    item: string,
    checked: boolean,
    completed_at: timestamp
  }],
  created_at: timestamp,
  updated_at: timestamp,
  completed_at: timestamp (optional),
  created_by: ObjectId
}

// ========== COMMENTS ==========
db.comments {
  _id: ObjectId,
  case_id: ObjectId (optional),
  task_id: ObjectId (optional),
  user_id: ObjectId,
  text: string,
  mentions: [{
    user_id: ObjectId,
    user_name: string
  }],
  parent_id: ObjectId (optional, for threading),
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp (soft delete)
}

// ========== NOTIFICATIONS ==========
db.notifications {
  _id: ObjectId,
  user_id: ObjectId,
  type: "assignment" | "mention" | "status_change" | "sla_warning" | "comment",
  title: string,
  message: string,
  entity_type: "case" | "task",
  entity_id: ObjectId,
  is_read: boolean,
  read_at: timestamp (optional),
  created_at: timestamp,
  ttl: 2592000  // 30 days (TTL index)
}

// ========== AUDIT LOGS ==========
db.audit_logs {
  _id: ObjectId,
  entity_type: "case" | "task" | "user" | "workflow",
  entity_id: string,
  action: "created" | "updated" | "deleted" | "transitioned" | "assigned",
  actor_id: ObjectId,
  changes: {
    before: {},
    after: {}
  },
  timestamp: timestamp,
  ttl: 7776000  // 90 days (TTL index), configurable per tenant
}

// ========== PHASE 2 ADDITIONS ==========

db.workflows {
  _id: ObjectId,
  name: string,
  description: string,
  nodes: [{
    id: string,
    type: "start" | "end" | "task" | "decision" | "parallel",
    label: string,
    assignee_role: string (optional),
    branches: [{
      condition: string,
      next: string
    }]
  }],
  edges: [{
    from: string,
    to: string,
    condition: string (optional)
  }],
  version: number,
  created_by: ObjectId,
  created_at: timestamp,
  updated_at: timestamp
}

db.documents {
  _id: ObjectId,
  case_id: ObjectId,
  name: string,
  mime_type: string,
  size: number,
  version: number,
  versions: [{
    version: number,
    uploaded_by: ObjectId,
    uploaded_at: timestamp,
    file_path: string
  }],
  tags: [string],
  uploaded_by: ObjectId,
  created_at: timestamp
}

db.approvals {
  _id: ObjectId,
  case_id: ObjectId,
  chain_id: ObjectId,
  approver_id: ObjectId,
  status: "pending" | "approved" | "rejected" | "delegated",
  decision: "approved" | "rejected" (optional),
  comment: string (optional),
  delegated_to: ObjectId (optional),
  created_at: timestamp,
  decided_at: timestamp (optional),
  sequence: number  // Order in chain
}

db.case_fields {
  _id: ObjectId,
  case_id: ObjectId,
  field_name: string,
  value: any,
  type: string,
  required: boolean
}
```

### Indexes
```javascript
db.cases.createIndex({ status: 1, stage: 1, owner_id: 1 })
db.cases.createIndex({ created_at: -1 })
db.cases.createIndex({ type: 1, status: 1 })

db.tasks.createIndex({ case_id: 1, status: 1 })
db.tasks.createIndex({ assignee_id: 1, status: 1 })
db.tasks.createIndex({ due_date: 1 })

db.audit_logs.createIndex({ case_id: 1, timestamp: -1 })
db.audit_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 })

db.notifications.createIndex({ user_id: 1, is_read: 1 })
db.notifications.createIndex({ created_at: 1 }, { expireAfterSeconds: 2592000 })

db.comments.createIndex({ case_id: 1, created_at: -1 })
db.comments.createIndex({ task_id: 1, created_at: -1 })
```

---

## API Contract Specifications

### Auth Service (Port 8001)

```
POST /auth/register
  Payload: { email, password, name }
  Response: { user_id, email, token }

POST /auth/login
  Payload: { email, password }
  Response: { access_token, refresh_token, expires_in }

POST /auth/refresh
  Payload: { refresh_token }
  Response: { access_token, expires_in }

POST /auth/logout
  Response: { message: "Logged out" }

GET /auth/me
  Response: { user_id, email, name, role, team_ids }
```

### Case Service (Port 8002)

```
POST /cases
  Payload: { type, priority, team_id, fields }
  Response: { id, type, status, stage, created_at }

GET /cases
  Query: ?status=open&stage=intake&owner_id=X&team_id=Y&limit=20&skip=0
  Response: { cases: [], total, skip, limit }

GET /cases/{id}
  Response: { case_detail with full history, audit_trail, tasks, documents }

PATCH /cases/{id}
  Payload: { priority, fields, ...partial_updates }
  Response: { updated case }

PATCH /cases/{id}/stage
  Payload: { action: "submit" | "approve" | "reject", notes }
  Response: { case, new_stage, next_stage }

GET /cases/{id}/audit
  Response: { events: [] with before/after changes }

GET /cases/{id}/timeline
  Response: { timeline events with timestamps }
```

### Task Service (Port 8003)

```
POST /tasks
  Payload: { case_id, title, priority, assignee_id, due_date, depends_on }
  Response: { id, case_id, status, created_at }

GET /tasks
  Query: ?case_id=X&assignee_id=me&status=pending&limit=20
  Response: { tasks: [], total }

GET /tasks/{id}
  Response: { task_detail with case info, assignee, comments }

PATCH /tasks/{id}
  Payload: { status, assignee_id, priority, due_date, ...updates }
  Response: { updated task }

PATCH /tasks/{id}/status
  Payload: { status: "in_progress" }
  Response: { task }

PATCH /tasks/{id}/assignee
  Payload: { assignee_id or team_id }
  Response: { task }

DELETE /tasks/{id}
  Response: { message: "Deleted" }
```

### Notification Service (Port 8004)

```
GET /notifications
  Query: ?limit=20&unread_only=true
  Response: { notifications: [], unread_count }

PATCH /notifications/{id}
  Payload: { is_read: true }
  Response: { notification }

DELETE /notifications/{id}
  Response: { message: "Deleted" }

WS /ws
  Auth: token in query (?token=X)
  Message types: { type: "task_updated", payload: {...} }
```

---

## Key Design Decisions

### 1. Microservice Granularity
- **Auth Service:** JWT validation, user CRUD, roles
- **Case Service:** Case lifecycle, stage transitions, audit
- **Task Service:** Task CRUD, assignment, status
- **Notify Service:** Notifications, WebSocket, email

**Why:** Separation of concerns. Each service can scale independently.

### 2. Case ID Format
- Format: `CASE-YYYY-XXXXX` (e.g., `CASE-2024-00042`)
- Generated server-side with auto-incrementing counter
- Human-readable in URLs and reports

### 3. Stage Transitions
- Stages stored as state machine rules in case_types
- Each transition requires role + optional conditions
- Audit trail captures before/after stage
- On transition, trigger tasks, notifications, SLA updates

### 4. Task Dependencies
- Three types: sequential (must complete before next), parallel (all can start), conditional
- Tracked via depends_on array + dependency_type field
- Background worker checks when parent task completes

### 5. Real-Time Architecture
- FastAPI WebSocket per case (not per user)
- Clients send heartbeat every 30s
- Server broadcasts changes via channel (case_id)
- Graceful reconnection with exponential backoff

### 6. SLA Engine
- Background worker (APScheduler) runs every 15 minutes
- Checks cases at 75%, 100%, 125% of SLA
- Each case has sla.target_date and sla.escalation_level
- Auto-escalation: notify manager, optional reassign

### 7. Audit Trail Strategy
- Immutable append-only log
- Every action creates audit_log entry
- TTL index: 90 days retention (configurable)
- Soft delete for comments (deleted_at flag)

### 8. Frontend State Management
- NgRx store: cases, tasks, user, notifications, ui
- Actions for: load, select, update, delete
- Effects for API calls + WebSocket subscriptions
- Selectors for filtered views (my tasks, overdue, etc.)

---

## Validation & Testing Strategy

### Phase 1 Validation

**Unit Tests:**
- Auth service: password hashing, JWT generation/validation
- Case service: stage transitions, rule evaluation
- Task service: dependency logic, priority inheritance
- Notification service: email template rendering

**Integration Tests:**
- End-to-end: user register → login → create case → assign task → comment → notification
- Case transition workflow
- Task reassignment + status change

**Performance Tests:**
- 100 concurrent users simultaneous WebSocket connections
- Case list query with filters (< 500ms)
- Notification delivery (< 100ms)

**Manual Acceptance:**
- Team member can complete fictional loan approval workflow
- Audit trail captures all events
- Docker Compose starts all services in order
- Frontend responsive on mobile/tablet/desktop

### Phase 2 Validation

**Additional Tests:**
- Workflow designer creates valid workflows (no orphan nodes)
- Approval chain executes correctly (serial and parallel)
- Document upload + versioning
- SLA escalation triggers at correct thresholds

**Acceptance Criteria:**
- Team completes complex multi-stage workflow with approval + docs
- Real-time collaboration: two users see live updates
- Performance: SLA check on 1000 cases < 2s

---

## Next Steps

1. **Setup Project Structure:** Create repos, Docker Compose baseline
2. **Sprint 1 Implementation:** Auth service + database
3. **Regular Validation:** End of each sprint, integration test
4. **Phase 1 Gate:** Full team validation before Phase 2 start
5. **Phase 2 Implementation:** Workflow designer → approval engine → docs → real-time
6. **Phase 2 Gate:** Before proceeding to Phase 3 (AI/GenAI)

---

**Created:** 2026-03-14  
**Last Updated:** [Implementation Progress TBD]
