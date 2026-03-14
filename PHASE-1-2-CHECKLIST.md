# Phase 1 & 2 Implementation Checklist

## PHASE 1: MVP (Weeks 1-10)

### ✅ Pre-Implementation
- [ ] Review architecture & schema with team
- [ ] Finalize tech stack versions (Angular 19.2.19, Python 3.12, FastAPI, MongoDB 7.x)
- [ ] Setup Git repositories
- [ ] Create shared environment variables template (.env.example)

---

## SPRINT 1: Foundation (Week 1-2)
### Project Structure & Docker Setup

**Backend Setup:**
- [ ] Create `/backend` directory
- [ ] Create microservice structure:
  - [ ] `/backend/auth-service` (FastAPI project)
  - [ ] `/backend/case-service` (FastAPI project)
  - [ ] `/backend/task-service` (FastAPI project)
  - [ ] `/backend/notify-service` (FastAPI project)
- [ ] Create `requirements.txt` for each service with core deps:
  - FastAPI, Pydantic v2, Motor, PyJWT, bcrypt, python-jose, aiosmtplib, aiohttp

**Frontend Setup:**
- [ ] Create `/frontend` directory
- [ ] Initialize Angular 19 project with:
  - [ ] Angular Material
  - [ ] NgRx for state management
  - [ ] TailwindCSS
  - [ ] RxJS

**Infrastructure:**
- [ ] Create `docker-compose.yml` with:
  - [ ] MongoDB (27017)
  - [ ] Auth Service (8001)
  - [ ] Case Service (8002)
  - [ ] Task Service (8003)
  - [ ] Notify Service (8004)
  - [ ] Nginx reverse proxy (8000)
  - [ ] Angular dev server (4200)

**Auth Service Implementation:**
- [ ] Setup FastAPI app structure (main.py, config.py, models/routes/middleware)
- [ ] Create User model (Pydantic)
- [ ] Implement password hashing (bcrypt)
- [ ] Implement JWT token generation/validation
- [ ] Create database connection (Motor + MongoDB)
- [ ] Implement POST /auth/register
- [ ] Implement POST /auth/login
- [ ] Implement POST /auth/refresh
- [ ] Implement GET /auth/me (with JWT guard)
- [ ] Create MongoDB users collection + indexes
- [ ] Test: register user, login, get profile

**Docker Validation:**
- [ ] All containers start without errors
- [ ] Health check endpoints respond
- [ ] MongoDB collections created automatically
- [ ] Services can communicate via Docker network

**Deliverables:**
- [ ] `docker-compose up` starts full stack
- [ ] Auth endpoints working (test with curl/Postman)
- [ ] User created in MongoDB
- [ ] JWT tokens valid and refreshable

---

## SPRINT 2: Case Service (Week 3-4)
### Case Management & Lifecycle Engine

**Case Model & Database:**
- [ ] Create Case Pydantic model
- [ ] Define case status/stage enum
- [ ] Create MongoDB case collection + indexes
- [ ] Create CaseType model (workflow templates)
- [ ] Create MongoDB case_types collection
- [ ] Implement case ID auto-generation (CASE-YYYY-XXXXX)

**Case Lifecycle Engine:**
- [ ] Implement stage transition rules engine
- [ ] Create transition validation logic (role-based)
- [ ] Implement on_enter / on_exit hooks
- [ ] Create event/audit logging system

**Case Endpoints:**
- [ ] POST /cases → Create new case instance
- [ ] GET /cases → List with filtering (status, stage, owner, team)
- [ ] GET /cases/{id} → Full case detail
- [ ] PATCH /cases/{id} → Update case fields
- [ ] PATCH /cases/{id}/stage → Transition case
- [ ] GET /cases/{id}/audit → Audit trail
- [ ] GET /cases/{id}/timeline → Timeline view

**Case Types (Workflow Templates):**
- [ ] POST /case-types → Create template
- [ ] GET /case-types → List templates
- [ ] GET /case-types/{id} → Template detail
- [ ] PATCH /case-types/{id} → Edit template
- [ ] Validate transitions in workflow definition

**Audit Trail:**
- [ ] Create AuditLog model + collection
- [ ] Middleware to capture all POST/PATCH/DELETE
- [ ] Store before/after changes
- [ ] Implement TTL index (90 days retention)
- [ ] GET /audit endpoint for admin

**Authentication & Authorization:**
- [ ] JWT decode middleware in all services
- [ ] Role-based route guards (ADMIN, MANAGER, WORKER, VIEWER)
- [ ] Owner-based access (user can only see own cases)
- [ ] Team-based access (member can see team cases)

**Testing:**
- [ ] Unit tests: stage transition logic, rule evaluation
- [ ] Integration test: create case → transition → audit captured
- [ ] Test filtering by status, stage, owner
- [ ] Test permission denied for unauthorized transitions

**Deliverables:**
- [ ] Full CRUD case endpoints working
- [ ] Workflow templates define valid stages & transitions
- [ ] Audit trail captures all changes
- [ ] Role-based access enforced

---

## SPRINT 3: Task Service (Week 5-6)
### Task Management & Kanban

**Task Model & Database:**
- [ ] Create Task Pydantic model
- [ ] Define task status enum (pending, in_progress, completed, blocked, cancelled)
- [ ] Create MongoDB tasks collection + indexes
- [ ] Link tasks to cases (case_id foreign key)

**Task CRUD:**
- [ ] POST /tasks → Create task
- [ ] GET /tasks → List with filters (case_id, assignee_id, status, priority)
- [ ] GET /tasks/{id} → Task detail
- [ ] PATCH /tasks/{id} → Update task
- [ ] PATCH /tasks/{id}/status → Update status
- [ ] PATCH /tasks/{id}/assignee → Reassign to user/team
- [ ] DELETE /tasks/{id} → Soft delete

**Task Features:**
- [ ] Priority levels (low, medium, high, critical)
- [ ] Due dates with overdue calculation
- [ ] Assignment to user or team
- [ ] Task dependencies (depends_on array)
- [ ] Checklist items (sub-tasks)
- [ ] Tags for organization

**Kanban Board Support:**
- [ ] GET /tasks/kanban?case_id=X → Grouped by status
- [ ] Support drag-drop reordering (update status + position)

**Task Assignment Rules:**
- [ ] When task assigned, create notification
- [ ] When status changes, notify assignee + case owner
- [ ] Show mine, team, unassigned queues

**Audit Trail:**
- [ ] All task changes logged in audit_logs
- [ ] Assignment history tracked

**Testing:**
- [ ] Create task → verify in case
- [ ] Reassign task → notification triggered
- [ ] Update status → audit logged
- [ ] List by filters → correct results

**Deliverables:**
- [ ] Full task CRUD working
- [ ] Kanban board data endpoint (by status)
- [ ] Task assignment + notifications trigger
- [ ] All changes audited

---

## SPRINT 4: Notifications & Comments (Week 7)
### Real-Time Notifications & Collaboration

**Comment System:**
- [ ] Create Comment model (linked to case or task)
- [ ] POST /comments → Create comment
- [ ] GET /comments?case_id=X → List threaded comments
- [ ] PATCH /comments/{id} → Edit comment
- [ ] DELETE /comments/{id} → Soft delete
- [ ] Implement @mention detection
- [ ] Extract mentioned user IDs

**Notification Model & Database:**
- [ ] Create Notification model + collection
- [ ] Notification types: assignment, mention, status_change, sla_warning, comment
- [ ] POST /notifications → Create (internal, triggered by events)
- [ ] GET /notifications → List for current user
- [ ] PATCH /notifications/{id} → Mark as read
- [ ] DELETE /notifications/{id} → Dismiss
- [ ] GET /notifications/count → Unread count

**Notification Triggers:**
- [ ] Task assigned → notification to assignee
- [ ] Case transitioned → notification to owner + team
- [ ] Comment @mention → notification to mentioned user
- [ ] Task status changed → notification to owner + assignee
- [ ] SLA milestone (75%, 100%, 125%) → alert notification

**Email Integration:**
- [ ] Configure SMTP (environment variables)
- [ ] Create email templates (Jinja2):
  - [ ] Task assignment email
  - [ ] Mention notification email
  - [ ] SLA warning email
- [ ] Send email for key events (async)
- [ ] Email queue in MongoDB (retry logic)

**WebSocket/Real-Time:**
- [ ] Setup FastAPI WebSocket endpoint in notify-service
- [ ] WS /ws?token=X → Authenticated connection
- [ ] Broadcast notifications to connected clients
- [ ] Heartbeat mechanism (30s)
- [ ] Graceful reconnection
- [ ] Memory cleanup on disconnect

**Testing:**
- [ ] Create notification → appears in GET /notifications
- [ ] Mark read → unread_count decreases
- [ ] @mention → notification for mentioned user
- [ ] Email sent for task assignment (check SMTP logs)
- [ ] WebSocket broadcasts to all connected clients
- [ ] Reconnection after disconnect

**Deliverables:**
- [ ] Comment threads working
- [ ] Notifications triggered on events
- [ ] Emails sent for key events
- [ ] WebSocket push real-time notifications

---

## SPRINT 5: Frontend - Auth & Shell (Week 8)
### Angular Foundation

**Project Setup:**
- [ ] Angular 19 project created with ng CLI
- [ ] Angular Material installed + theme configured
- [ ] NgRx installed (store, effects, selectors)
- [ ] TailwindCSS configured
- [ ] Angular CDK installed

**NgRx State Setup:**
- [ ] Create store directory structure
- [ ] Auth state (user, token, loading, error)
- [ ] Cases state (list, selected, filters, loading)
- [ ] Tasks state (list, myTasks, kanban, loading)
- [ ] Notifications state (items, unreadCount)
- [ ] UI state (sidebarOpen, theme)

**Core Module:**
- [ ] HTTP interceptor for JWT (add token to all requests)
- [ ] 401 handling (clear auth state, redirect to login)
- [ ] Error handler for API responses
- [ ] Guards for authenticated routes
- [ ] Guards for role-based routes (e.g., admin-only)

**Auth Pages:**
- [ ] Login page (email/password form)
- [ ] Register page (email/password/name form)
- [ ] JWT token stored in localStorage (or sessionStorage)
- [ ] Auto-refresh token before expiry
- [ ] Logout button (clear storage + redirect)
- [ ] Session timeout warning

**Shell Component:**
- [ ] Main layout with sidebar + header + footer
- [ ] Responsive navigation (hamburger on mobile)
- [ ] Header with user profile dropdown
- [ ] Logo / branding
- [ ] Logout button in header
- [ ] Active route indicator in sidebar

**Sidebar Navigation:**
- [ ] Dashboard link
- [ ] Cases link
- [ ] Tasks (My Board) link
- [ ] Admin section (if ADMIN role)
- [ ] Collapsible menu on mobile

**Dashboard Page:**
- [ ] Simple landing page after login
- [ ] Quick stats (case count, my tasks, notifications)
- [ ] Recent activity list
- [ ] Link to case list + task board

**Styling:**
- [ ] TailwindCSS utility classes
- [ ] Responsive grid (mobile-first)
- [ ] Material Design principles
- [ ] Consistent color scheme
- [ ] Dark mode support (optional)

**Testing:**
- [ ] Login flow works
- [ ] Register new user works
- [ ] Sidebar responsive on mobile
- [ ] Protected routes redirect when unauthenticated
- [ ] Admin routes protected by role guard

**Deliverables:**
- [ ] Full auth flow (register, login, logout)
- [ ] Responsive shell layout
- [ ] NgRx store wired
- [ ] Role-based route guards
- [ ] Dashboard page accessible after login

---

## SPRINT 6: Frontend - Cases & Tasks (Week 9)
### UI Components for Cases & Tasks

**Case List Component:**
- [ ] Display list of cases in table
- [ ] Columns: ID, Type, Status, Stage, Priority, Owner, Updated
- [ ] Click row → navigate to case detail
- [ ] Filters: status dropdown, stage dropdown, owner filter
- [ ] Sort by column
- [ ] Pagination (20 cases per page)
- [ ] "Create new case" button

**Case Detail Component:**
- [ ] Case header (ID, Type, Status, Priority)
- [ ] Stage progress bar (horizontal strip, PEGA-style)
  - [ ] Show stages: completed (✓), current (●), pending (○), skipped (–)
  - [ ] Click stage → show stage detail
- [ ] Three-column layout:
  - [ ] Left: Case fields form (read/edit)
  - [ ] Center: Main content + task list
  - [ ] Right: Pulse feed (comments + activity)
- [ ] Case timeline (Gantt-style or vertical)
- [ ] Audit trail drawer (click "History" button)

**Create Case Form:**
- [ ] Modal or page to create new case
- [ ] Select case type → populate fields from schema
- [ ] Field validation (required, type)
- [ ] Submit → POST /cases
- [ ] Success message + redirect to case detail

**Stage Transition UI:**
- [ ] Button "Move to next stage" (if allowed)
- [ ] Confirmation dialog
- [ ] Optional notes field
- [ ] Submit → PATCH /cases/{id}/stage
- [ ] Auto-refresh case detail on success

**Task Kanban Board:**
- [ ] Four columns: Pending, In Progress, Review, Done (customizable)
- [ ] Drag-drop (CDK DragDrop) to change status
- [ ] Task cards show: title, assignee avatar, priority color, due date
- [ ] Click card → task detail drawer
- [ ] Filter by assignee: My Tasks, Team Tasks, All
- [ ] Filter by priority, due date

**Task Detail Drawer:**
- [ ] Task title + description
- [ ] Status dropdown (change via PATCH)
- [ ] Assignee dropdown (change via PATCH)
- [ ] Priority selector
- [ ] Due date picker
- [ ] Checklist items (editable)
- [ ] Related case link
- [ ] Quick edit buttons (Update, Delete)

**Task List (Alternative View):**
- [ ] Table view of tasks
- [ ] Columns: Title, Status, Assignee, Priority, Due Date, Case
- [ ] Inline edit (click to edit)
- [ ] Bulk actions (reassign, update status)

**Comments Section:**
- [ ] Threaded comments per case/task
- [ ] Display comment text, author, timestamp
- [ ] Reply button → nested comment form
- [ ] @mention textbox (autocomplete users)
- [ ] Edit own comments
- [ ] Delete (soft) comments
- [ ] Real-time updates (no refresh)

**Notifications:**
- [ ] Bell icon in header
- [ ] Badge with unread count
- [ ] Click bell → dropdown list of recent notifications
- [ ] "Mark as read" button on notification
- [ ] "Clear all" option
- [ ] Link to entity (click notification → navigate)

**Testing:**
- [ ] Case list loads and filters work
- [ ] Case detail: all fields display correctly
- [ ] Stage transition button visible + works
- [ ] Task Kanban: drag-drop changes status
- [ ] Comments appear in real-time
- [ ] Notifications badge updates

**Deliverables:**
- [ ] Fully functional case list + detail
- [ ] Kanban board for tasks
- [ ] Comments thread working
- [ ] Real-time notification bell
- [ ] Responsive design on mobile/tablet

---

## SPRINT 7: Admin & Phase 1 Validation (Week 10)
### Admin Features & Testing

**Admin User Management:**
- [ ] /admin/users page (ADMIN only)
- [ ] Table: email, name, role, team, created_at, actions
- [ ] "Create user" modal
- [ ] "Edit user" modal (change role, team, email)
- [ ] "Delete user" confirmation
- [ ] Bulk role assignment
- [ ] Filter users by role, team
- [ ] Search by name/email

**Admin Team Management:**
- [ ] /admin/teams page
- [ ] Table: team name, member count, created_at, actions
- [ ] "Create team" modal
- [ ] "Edit team" modal (name, members, roles)
- [ ] "Delete team" confirmation
- [ ] Add/remove members via multi-select

**Admin Workflow/Case Types:**
- [ ] /admin/workflows page
- [ ] List case types: name, stages, transitions, actions
- [ ] "Create case type" modal
- [ ] "Edit case type" modal
  - [ ] Stage order
  - [ ] Transitions (from, action, to, allowed_roles)
  - [ ] SLA rules per stage
- [ ] Test workflow in sandbox (trial case creation)

**Admin Audit Dashboard:**
- [ ] View audit logs (filterable by entity, action, date range)
- [ ] Export audit logs to CSV/PDF
- [ ] Search audit logs

**E2E Workflow Test:**
- [ ] Scenario: Loan origination process
  - [ ] Register new worker user
  - [ ] Login as worker
  - [ ] Create case (case type: loan_origination)
  - [ ] Auto-assigned tasks appear in Kanban
  - [ ] Comment on case (tag manager)
  - [ ] Manager receives notification
  - [ ] Manager transitions case to "underwriting"
  - [ ] New tasks created in underwriting stage
  - [ ] Case owner receives "stage transitioned" email
  - [ ] All events logged in audit trail
- [ ] Verification: at each step, verify data in MongoDB

**Performance Testing:**
- [ ] Load test 100 concurrent users
- [ ] Measure response times (target: < 500ms)
- [ ] Measure notification delivery (target: < 100ms)
- [ ] Measure WebSocket broadcast latency
- [ ] CPU/Memory usage acceptable

**Docker & Deployment Check:**
- [ ] `docker-compose up` starts all 9 containers in correct order
- [ ] Services health-check passes
- [ ] Frontend accessible at http://localhost:4200
- [ ] API Gateway at http://localhost:8000
- [ ] MongoDB admin UI at http://localhost:8081
- [ ] Logs aggregated (docker-compose logs view)

**Documentation:**
- [ ] API contract (Swagger/OpenAPI from FastAPI)
- [ ] Frontend component API documentation
- [ ] Database schema documentation
- [ ] Setup guide (prerequisites, docker-compose, env vars)
- [ ] Deployment guide
- [ ] Troubleshooting guide (common issues)

**Phase 1 Sign-Off:**
- [ ] Team walkthrough of workflow scenario
- [ ] All acceptance criteria met
- [ ] No critical bugs remaining
- [ ] Performance acceptable
- [ ] Ready for Phase 2 development

**Deliverables:**
- [ ] Admin panel fully functional
- [ ] E2E workflow scenario passes
- [ ] All Phase 1 deliverables complete
- [ ] Phase 1 validated with team

---

## PHASE 2: Enhanced Workflow & Collaboration (Weeks 11-18)

### ✅ Phase 1 Validation Gate
- [ ] Phase 1 complete, tested, signed off by stakeholders
- [ ] No blockers for Phase 2
- [ ] Database backup / snapshot taken
- [ ] Phase 2 planning meeting completed

---

## SPRINT 8: Workflow Designer (Week 11-12)
### Visual Workflow Authoring

**Canvas Component:**
- [ ] Use @antv/g6 or custom canvas renderer
- [ ] Draggable node types from toolbar:
  - [ ] Start node (circle)
  - [ ] End node (circle)
  - [ ] Task node (rectangle)
  - [ ] Decision node (diamond)
  - [ ] Parallel gateway (circle with branches)
- [ ] Drop node on canvas → connected to graph
- [ ] Draw edges between nodes (directed arrows)
- [ ] Delete node / edge (right-click or delete key)
- [ ] Undo/Redo functionality

**Node Properties Panel:**
- [ ] Select node → show properties in right panel
- [ ] Task node: label, assignee_role selector, timeout (optional)
- [ ] Decision node: label, branches (add condition → next node)
- [ ] Start/End: label only
- [ ] Save properties → update canvas

**Edge Conditions:**
- [ ] Decision output edges: set condition (e.g., "approved == true")
- [ ] Condition input field with autocomplete (case fields)
- [ ] Operators: ==, !=, >, <, >=, <=, in, contains

**Workflow Validation:**
- [ ] Check for unreachable nodes (nodes with no path to End)
- [ ] Check for orphan nodes (not connected)
- [ ] Check for missing End node
- [ ] Validation errors displayed with node highlights

**Save/Export:**
- [ ] "Save workflow" button → POST /workflows
- [ ] Payload: { name, nodes[], edges[], version }
- [ ] Response: workflow_id
- [ ] Auto-save every 30s (debounced)
- [ ] Unsaved changes indicator

**Load/Edit:**
- [ ] GET /workflows → List existing workflows
- [ ] Click to edit → Load JSON into canvas
- [ ] Check version conflicts (if modified elsewhere)

**Preview / Simulate:**
- [ ] "Simulate" button → Mock case creation from this workflow
- [ ] Select decision branches (user input)
- [ ] Trace path through workflow
- [ ] Show expected tasks at each stage

**Template Creation:**
- [ ] "Save as case type" button
  - [ ] Enter case type name, description
  - [ ] Map workflow stages to case.stages
  - [ ] Set SLA rules per stage
  - [ ] POST /case-types with workflow definition
  - [ ] Template now available when creating cases

**Testing:**
- [ ] Draw workflow with 5 nodes
- [ ] Add decision point with conditions
- [ ] Save → verify in MongoDB workflows collection
- [ ] Load workflow → canvas renders correctly
- [ ] Validation catches unreachable nodes
- [ ] Template created from workflow

**Deliverables:**
- [ ] Full workflow designer UI
- [ ] Save/load workflows
- [ ] Validation + error messages
- [ ] Create case type from workflow

---

## SPRINT 9: Approval Engine (Week 13-14)
### Multi-Level Approvals & Delegation

**Approval Chain Model:**
- [ ] Create ApprovalChain service
- [ ] Support sequential + parallel approvers
- [ ] Dynamic routing: rules based on case fields
  - [ ] E.g., "if amount > 100k, route to VP_approval"
- [ ] Store approval chain definition in case_types
- [ ] Link approval chain to case on transition

**Approval Task Creation:**
- [ ] When case enters approval stage:
  - [ ] Resolve approvers (apply routing rules to case data)
  - [ ] Create approval task for each approver
  - [ ] Set task status: "pending"
  - [ ] Send notification to approvers
  - [ ] Schedule timeout (SLA-based)

**Approval Endpoints:**
- [ ] POST /approvals/{id}/approve
  - [ ] Payload: { comment }
  - [ ] Update approval.status = "approved"
  - [ ] Check if all approvals met → auto-advance case stage
- [ ] POST /approvals/{id}/reject
  - [ ] Payload: { comment }
  - [ ] Update approval.status = "rejected"
  - [ ] Revert case to previous stage (rework)
- [ ] POST /approvals/{id}/delegate
  - [ ] Payload: { delegate_to_user_id }
  - [ ] Update approval.delegated_to
  - [ ] Create new notification for delegate
  - [ ] Original approver released

**Approval UI:**
- [ ] Task board shows "Approval pending" tasks
- [ ] Task card for approval shows:
  - [ ] Approver name
  - [ ] Case summary
  - [ ] "Approve / Reject" buttons
- [ ] Click task → approval detail view:
  - [ ] Case context (fields, documents, comments)
  - [ ] Previous approval decisions (if serial)
  - [ ] Approve/Reject form (with comment textbox)
  - [ ] Delegate dropdown (if allowed)
- [ ] Mobile-friendly layout (buttons large)

**Parallel Approvals:**
- [ ] Multiple approvers can review simultaneously
- [ ] Each must submit decision
- [ ] Case advances when ALL approvals received
- [ ] Show progress: "2 of 3 approvals received"

**Sequential Approvals:**
- [ ] Approver 1 decides → goes to Approver 2
- [ ] Show sequence: "Awaiting approval from: [Person 1] → Person 2"

**Escalation on SLA Breach:**
- [ ] If approval SLA exceeded:
  - [ ] Send escalation alert
  - [ ] Optionally: auto-reassign to manager
  - [ ] Log in audit trail

**Testing:**
- [ ] Create case → enters approval stage → task created
- [ ] User approves → case advances
- [ ] User rejects → case reverts
- [ ] Delegate approval → new user receives task
- [ ] Parallel approvals: all must approve before advancing
- [ ] SLA breach triggers notification

**Deliverables:**
- [ ] Approval chain engine working
- [ ] Approve/reject/delegate endpoints
- [ ] Approval UI in task board + detail
- [ ] Sequential + parallel approval support
- [ ] SLA escalation for approvals

---

## SPRINT 10: Document Management (Week 15)
### File Upload, Versioning, Preview

**File Upload Endpoint:**
- [ ] POST /documents (multipart/form-data)
  - [ ] Payload: { case_id, file }
  - [ ] Save file to volume mount (/data/documents/...)
  - [ ] Extract metadata: name, size, mime_type
  - [ ] Store metadata + version info in MongoDB
  - [ ] Response: { document_id, version, file_url }
- [ ] Max file size: 50MB
- [ ] Allowed types: PDF, images, Office docs

**Document Metadata:**
- [ ] Name, MIME type, size, version
- [ ] Uploaded by user + timestamp
- [ ] Tags (optional, for organization)
- [ ] Case link + task link (optional)

**Versioning:**
- [ ] Each new file upload = new version
- [ ] Previous versions retained in versions array
- [ ] GET /documents/{id}/versions → version history
- [ ] GET /documents/{id}/versions/{version_num} → download old version

**Document Endpoints:**
- [ ] GET /documents?case_id=X → List documents for case
- [ ] GET /documents/{id} → Document metadata + latest version
- [ ] GET /documents/{id}/download → Download file
- [ ] DELETE /documents/{id} → Delete latest version (soft)
- [ ] PATCH /documents/{id}/tags → Update tags

**Text Extraction:**
- [ ] PDF → extract text using PyMuPDF (pdfplumber)
- [ ] Store extracted_text in MongoDB (indexed)
- [ ] Enable semantic search across documents (Phase 3 prep)

**Preview UI:**
- [ ] Document picker in case detail (drag-drop zone or file input)
- [ ] Document list per case:
  - [ ] Thumbnail + filename + size + upload date
  - [ ] Download button
  - [ ] Version history button (show all versions)
  - [ ] Delete button (ADMIN or owner)
  - [ ] Preview button
- [ ] Preview modal:
  - [ ] PDF viewer (ngx-extended-pdf-viewer or similar)
  - [ ] Image gallery (swiper or carousel)
  - [ ] Office docs: download-only for now
- [ ] Zoom, full-screen, annotation (optional)

**Document Audit:**
- [ ] All uploads logged in audit_logs
- [ ] Version history maintained

**Testing:**
- [ ] Upload PDF → stored in volume + MongoDB
- [ ] Upload image → preview renders
- [ ] Upload new version → version number incremented
- [ ] Download → file retrieved correctly
- [ ] Delete → soft delete, audit logged
- [ ] List documents → all versions shown

**Deliverables:**
- [ ] Document upload + versioning
- [ ] PDF/image preview in case detail
- [ ] Full version history
- [ ] All document ops audited

---

## SPRINT 11: Real-Time Collaboration (Week 16)
### WebSocket Live Updates & Presence

**WebSocket Connection:**
- [ ] Endpoint: WS /ws/cases/{id}?token=JWT
- [ ] Auth: validate JWT token from query
- [ ] Connect user to case-specific room
- [ ] Track connected users per case (presence)

**Presence Tracking:**
- [ ] On connect: {type: "user_joined", user: {id, name, avatar}}
- [ ] Broadcast to all viewers of case
- [ ] Show "viewing now" indicator in case detail header
- [ ] On disconnect: remove from presence list

**Message Types:**
- [ ] task_updated: {type, payload: {task_id, changed_fields}}
- [ ] case_updated: {type, payload: {changed_fields}}
- [ ] comment_added: {type, payload: {comment} }
- [ ] comment_deleted: {type, payload: {comment_id}}
- [ ] user_joined: {type, payload: {user}}
- [ ] user_left: {type, payload: {user_id}}
- [ ] typing: {type, payload: {user_id, is_typing}} (optional)

**Live Updates Handler:**
- [ ] Update task status → broadcast task_updated
- [ ] Add comment → broadcast comment_added (no page refresh needed)
- [ ] Transition case → broadcast case_updated
- [ ] NgRx store updates on message receipt

**Conflict Resolution:**
- [ ] Optimistic UI: update immediately, validate on server
- [ ] If server rejects (concurrent change):
  - [ ] Revert UI to server state
  - [ ] Show conflict notification
  - [ ] Allow retry

**Heartbeat / Keepalive:**
- [ ] Client sends heartbeat every 30s
- [ ] Server responds with heartbeat
- [ ] Timeout after 60s (remove from presence)
- [ ] Client auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, 30s)

**Connection Loss:**
- [ ] Show "Connection lost" banner
- [ ] Disable editing temporarily
- [ ] Auto-retry connect in background
- [ ] Show "Reconnected" message on success
- [ ] Sync missed updates on reconnect

**Frontend Integration:**
- [ ] WebSocket service in Angular
- [ ] NgRx effects subscribe to WebSocket messages
- [ ] Store updates trigger automatic UI refresh
- [ ] Presence displayed in case detail header

**Testing:**
- [ ] Open case in 2 browser tabs
- [ ] Update task in tab 1 → Tab 2 sees live update
- [ ] Add comment in tab 1 → Tab 2 sees new comment
- [ ] Close browser → reconnect after 30s
- [ ] Simulate network loss → auto-reconnect

**Deliverables:**
- [ ] WebSocket live updates working
- [ ] Presence indicator in UI
- [ ] Auto-reconnection on disconnect
- [ ] Real-time comment feed (no refresh)
- [ ] Conflict resolution

---

## SPRINT 12: SLA & Escalation Engine (Week 17)
### Background SLA Checks & Alerts

**SLA Definition:**
- [ ] In case_types: SLA rules per stage
  - [ ] E.g., { stage: "underwriting", sla_hours: 48 }
- [ ] Calculate target_date = stage_entered_at + sla_hours

**Background Worker (APScheduler):**
- [ ] Runs every 15 minutes
- [ ] Query cases where:
  - [ ] stage.status = "in_progress"
  - [ ] now >= stage.entered_at + (75% of sla_hours)
- [ ] For each case at threshold:
  - [ ] Calculate escalation_level (75%, 100%, 125%)
  - [ ] Update case.sla.escalation_level
  - [ ] Create notification "SLA Warning: 6 hours remaining"
  - [ ] At 100%: "SLA Breached"
  - [ ] At 125%: "SLA Critical"

**Escalation Actions:**
- [ ] 75% threshold: send alert to owner + team lead
- [ ] 100% threshold: highlight case as breached (red)
- [ ] 125% threshold: auto-reassign to manager (if rule set)
- [ ] Send email alert to stakeholders

**SLA Dashboard:**
- [ ] Heatmap: X-axis = stages, Y-axis = cases, color = escalation level
- [ ] Green: on track
- [ ] Yellow: 75% (warning)
- [ ] Orange: 100% (breached)
- [ ] Red: 125% (critical)
- [ ] Click cell → see affected cases
- [ ] Filters: status, team, case type

**SLA Acknowledgment:**
- [ ] Button "Acknowledge" in SLA warning notification
- [ ] POST /sla/{id}/acknowledge → sets acknowledged_at
- [ ] Removes notification from alert center
- [ ] Logged in audit trail

**SLA Reset:**
- [ ] On stage transition: clear sla.escalation_level
- [ ] Calculate new target_date for next stage

**Overdue Queue:**
- [ ] Dashboard view of all overdue cases
- [ ] Sorted by: most overdue first
- [ ] Quick actions: acknowledge, reassign, transition

**Testing:**
- [ ] Create case with 1-hour SLA
- [ ] Wait 45 minutes → worker runs → no alert yet
- [ ] Wait 75% threshold → alert sent
- [ ] Acknowledge → notification cleared
- [ ] Wait 100% → escalation triggered
- [ ] SLA dashboard shows heatmap

**Deliverables:**
- [ ] Background SLA worker running
- [ ] Alerts at 75%, 100%, 125% thresholds
- [ ] SLA dashboard with heatmap
- [ ] Auto-escalation + reassignment
- [ ] All SLA events logged

---

## SPRINT 13: Form Builder & Templates (Week 18)
### Dynamic Field Capture & Templates

**Form Builder UI:**
- [ ] /form-builder/:case_type_id page
- [ ] Left panel: available field types
  - [ ] Text, Textarea, Select, Checkbox, Date, Number
- [ ] Center panel: drag field onto form
- [ ] Right panel: field properties (label, required, validation)
- [ ] Field ordering (drag to reorder)
- [ ] Save form → updates case_type.fields_schema

**Field Properties:**
- [ ] Label (display name)
- [ ] Field name (API name)
- [ ] Type (text, select, date, checkbox, number, textarea)
- [ ] Required (boolean)
- [ ] Validation rules (regex, min/max length, email format)
- [ ] Default value
- [ ] Options (for select type)
- [ ] Help text / placeholder
- [ ] Editable by roles (who can modify)
- [ ] Visible in roles (who can see)

**Form Rendering:**
- [ ] When viewing case detail:
  - [ ] Load case_type.fields_schema for case.type
  - [ ] Render form with fields in order
  - [ ] Populate from case.fields
  - [ ] Validation on blur + submit
  - [ ] Save → PATCH /cases/{id} { fields: {} }

**Dynamic Forms:**
- [ ] Conditional visibility:
  - [ ] E.g., "Loan amount" only visible if loan_type == "personal"
  - [ ] Define via: field.visible_when = { loan_type: "personal" }
- [ ] Conditional required:
  - [ ] E.g., "Collateral value" required if amount > 100k

**Template Library:**
- [ ] /templates page
- [ ] List existing case types (templates)
- [ ] Preview template (show fields)
- [ ] "Create case from template" → pre-filled form
- [ ] Template categories / search

**Case Creation from Template:**
- [ ] Select template → form appears
- [ ] Form fields pre-populated with defaults
- [ ] Submit → POST /cases { type, fields }
- [ ] New case inherits stages, transitions, SLA from template

**Template Audit:**
- [ ] Track form changes: field added, label changed, validation updated
- [ ] Version history of form schema
- [ ] Ability to revert to previous form version

**Testing:**
- [ ] Create form with text, select, date fields
- [ ] Set validation + defaults
- [ ] Create case from template → form renders
- [ ] Submit form → case.fields populated
- [ ] Conditional visibility works
- [ ] Validation prevents invalid submission

**Deliverables:**
- [ ] Form builder UI (drag-drop fields)
- [ ] Dynamic form rendering on cases
- [ ] Template library
- [ ] Case creation from template
- [ ] Conditional field visibility + validation
- [ ] Form version history

---

### ✅ Phase 2 Validation Gate
- [ ] Phase 2 complete, tested, signed off
- [ ] Visual workflow designer creates valid workflows
- [ ] Approval chains execute correctly
- [ ] Documents upload, version, preview
- [ ] Real-time collaboration (WebSocket) working
- [ ] SLA engine triggers escalations
- [ ] Forms capture data correctly
- [ ] Performance acceptable with new features
- [ ] Database backup taken
- [ ] Team walkthrough of Phase 2 scenarios

---

## Validation & Sign-Off

### Pre-Phase 3 Checklist
- [ ] Phase 1 & 2 delivered on time
- [ ] No critical bugs remaining
- [ ] Performance metrics met
- [ ] Team has developed workflows (real cases)
- [ ] Audit trail verified complete
- [ ] Backup strategy in place
- [ ] Security review completed
- [ ] Documentation up-to-date

**Next Steps:** Phase 3 — AI/GenAI Integration (when approved by stakeholders)

---

**Last Updated:** 2026-03-14
