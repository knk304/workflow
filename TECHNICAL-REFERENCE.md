# Technical Reference & Implementation Patterns

## Quick Start Commands

```bash
# Initial Setup
git clone <repo-url>
cd workflow-platform
docker-compose up -d                 # Start all services
docker-compose logs -f               # View logs

# Backend Development
cd backend/auth-service
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001

# Frontend Development
cd frontend
npm install
ng serve --open                      # Opens http://localhost:4200

# Database
docker-compose exec mongodb mongosh  # MongoDB shell
show dbs; use workflow_db; show collections;
```

---

## Architecture Decision Record (ADR)

### ADR-1: Microservices Split by Responsibility

**Decision:** 4 separate FastAPI services (Auth, Case, Task, Notify) instead of monolith

**Rationale:**
- Separation of concerns
- Independent scaling (e.g., notify-service under load)
- Easier testing (mock other services)
- Future: separate deployments

**Tradeoff:**
- Complexity: service-to-service calls + error handling
- Distributed tracing needed for debugging
- Data consistency across services (eventual consistency)

**Pattern:**
```python
# Case service calls task service
async def create_tasks_for_stage(case_id, stage_name):
    task_svc = TaskServiceClient(base_url="http://localhost:8003")
    await task_svc.create_bulk(
        tasks=[...],
        case_id=case_id
    )
```

---

### ADR-2: MongoDB Schema Without Foreign Keys

**Decision:** Denormalization + embed related data instead of joins

**Rationale:**
- MongoDB scales horizontally without ACID constraints
- Faster queries (no joins)
- Easier for document-centric domain (cases, tasks)

**Pattern:**
```python
# Task document includes case_id + case_snapshot
task = {
    "_id": ObjectId(),
    "case_id": ObjectId(),             # Reference
    "case_summary": {                  # Denormalized snapshot
        "case_type": "loan_origination",
        "owner_name": "Alice",
        "priority": "high"
    }
}
```

---

### ADR-3: Immutable Audit Trail (Not Audit Logs)

**Decision:** Append-only collection of events vs. updating records

**Rationale:**
- Compliance: cannot delete or modify audit trail
- Full history: can replay events
- Simpler: no update conflicts

**Pattern:**
```python
# Audit logging middleware captures all changes
@app.middleware("http")
async def audit_middleware(request, call_next):
    response = await call_next(request)
    if request.method in ["POST", "PATCH", "DELETE"]:
        await db.audit_logs.insert_one({
            "entity_type": "case",
            "entity_id": case_id,
            "action": "transitioned",
            "actor_id": user.id,
            "changes": { "before": old_state, "after": new_state },
            "timestamp": datetime.utcnow()
        })
    return response
```

---

### ADR-4: JWT for Auth, Not Session Cookies

**Decision:** Stateless JWT tokens, no server-side session store

**Rationale:**
- Stateless → easier to scale (no sticky sessions)
- Mobile-friendly (token in header)
- Works with microservices (each service validates independently)

**Tradeoff:**
- Cannot revoke token server-side immediately
- Must implement refresh token rotation

**Pattern:**
```python
# Generate JWT
access_token = create_access_token(
    data={"sub": user.id, "role": user.role},
    expires_delta=timedelta(minutes=15)
)
refresh_token = create_refresh_token(data={"sub": user.id})

# Validate in each service
@app.get("/protected")
async def protected_endpoint(token: str = Depends(oauth2_scheme)):
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user_id = payload.get("sub")
    # ...
```

---

### ADR-5: WebSocket Per Case, Not Per User

**Decision:** User connects to case-specific WebSocket channel

**Rationale:**
- Reduces memory (don't track user across all sockets)
- Scales: each case room is independent
- Simpler pub-sub pattern

**Tradeoff:**
- If user viewing 5 cases, 5 connections (acceptable)

**Pattern:**
```python
# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}  # case_id -> [ws, ws]
    
    async def connect(self, case_id: str, ws: WebSocket):
        await ws.accept()
        self.active_connections.setdefault(case_id, []).append(ws)
    
    async def broadcast_to_case(self, case_id: str, message: dict):
        for ws in self.active_connections.get(case_id, []):
            await ws.send_json(message)

# Usage
@app.websocket("/ws/cases/{case_id}")
async def websocket_endpoint(websocket: WebSocket, case_id: str):
    await manager.connect(case_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast_to_case(case_id, data)
    except WebSocketDisconnect:
        manager.disconnect(case_id, websocket)
```

---

### ADR-6: Async-First Python Backend

**Decision:** All I/O operations use async/await (FastAPI, Motor, aiohttp)

**Rationale:**
- Scalability: handle 1000s concurrent connections with few threads
- Responsive: don't block on database queries
- Native Python 3.8+ feature

**Pattern:**
```python
# FastAPI is async by default
@app.get("/cases/{id}")
async def get_case(id: str):
    case = await db.cases.find_one({"_id": id})  # Non-blocking I/O
    tasks = await db.tasks.find({"case_id": id}).to_list(100)
    return { "case": case, "tasks": tasks }
```

---

### ADR-7: NgRx for Frontend State

**Decision:** Centralized state with actions, reducers, effects, selectors

**Rationale:**
- Predictable state updates (single source of truth)
- Time-travel debugging (Redux DevTools)
- Testable (pure functions)
- Scales: can manage complex app state

**Tradeoff:**
- Learning curve (boilerplate)
- Overkill for simple components

**Pattern:**
```typescript
// Define state shape
interface CasesState {
  list: Case[];
  selected: Case | null;
  loading: boolean;
  error: string | null;
}

// Actions
export const loadCases = createAction('[Cases] Load);
export const loadCasesSuccess = createAction('[Cases] Load Success', props<{cases}>());

// Reducer
export const casesReducer = createReducer(
  initialState,
  on(loadCases, state => ({ ...state, loading: true })),
  on(loadCasesSuccess, (state, {cases}) => ({
    ...state, list: cases, loading: false
  }))
);

// Effect
@Injectable()
export class CasesEffects {
  loadCases$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadCases),
      switchMap(() =>
        this.api.getCases().pipe(
          map(cases => loadCasesSuccess({cases}))
        )
      )
    )
  );
}

// Selector
export const selectCasesList = (state: AppState) => state.cases.list;
export const selectCasesLoading = (state: AppState) => state.cases.loading;
```

---

### ADR-8: Form Validation — Pydantic v2 for Backend, Angular Reactive Forms for Frontend

**Decision:** Type-safe validation on both layers

**Rationale:**
- Backend: Pydantic validates API input before business logic
- Frontend: Reactive forms prevent round-trips for validation errors
- Both enforce same rules

**Pattern:**
```python
# Backend — Pydantic
from pydantic import BaseModel, Field, validator

class CreateCaseRequest(BaseModel):
    type: str = Field(..., min_length=1)
    priority: Literal["low", "medium", "high", "critical"]
    team_id: str
    
    @validator('team_id')
    def validate_team_exists(cls, v):
        team = db.teams.find_one({"_id": ObjectId(v)})
        if not team:
            raise ValueError("Team not found")
        return v

# Frontend — Reactive Forms
const form = this.fb.group({
  type: ['', [Validators.required, Validators.minLength(1)]],
  priority: ['medium', Validators.required],
  team_id: ['', [Validators.required, this.teamExistsValidator()]]
});

private teamExistsValidator(): AsyncValidatorFn {
  return (control: AbstractControl) => {
    if (!control.value) return of(null);
    return this.api.getTeam(control.value).pipe(
      map(() => null),
      catchError(() => of({teamNotFound: true}))
    );
  };
}
```

---

## Common Code Patterns

### 1. Case Transition Engine

```python
class CaseLifecycleEngine:
    async def transition(self, case_id: str, action: str, actor_id: str, notes: str = ""):
        # Get case + workflow definition
        case = await db.cases.find_one({"_id": case_id})
        workflow = await db.case_types.find_one({"name": case.type})
        
        # Find transition rule
        rule = next((
            t for t in workflow.transitions
            if t["from"] == case.stage and t["action"] == action
        ), None)
        
        if not rule:
            raise InvalidTransitionError(f"Cannot {action} from {case.stage}")
        
        # Check permissions
        if actor_id not in rule.allowed_roles:
            raise UnauthorizedError()
        
        # Execute transition
        old_stage, new_stage = case.stage, rule["to"]
        
        # On-exit hooks
        await self.execute_on_exit_hooks(case, old_stage)
        
        # Update case
        await db.cases.update_one(
            {"_id": case_id},
            {
                "$set": {
                    "stage": new_stage,
                    "updated_at": datetime.utcnow(),
                    "updated_by": actor_id
                },
                "$push": {
                    "stages": {
                        "name": new_stage,
                        "status": "in_progress",
                        "entered_at": datetime.utcnow(),
                        "entered_by": actor_id
                    }
                }
            }
        )
        
        # On-enter hooks
        await self.execute_on_enter_hooks(case_id, new_stage)
        
        # Notify
        await notify_svc.send("case_transitioned", {
            "case_id": case_id,
            "from": old_stage,
            "to": new_stage,
            "actor_id": actor_id
        })
        
        # Audit
        await db.audit_logs.insert_one({
            "entity_type": "case",
            "entity_id": case_id,
            "action": "transitioned",
            "actor_id": actor_id,
            "changes": {
                "before": {"stage": old_stage},
                "after": {"stage": new_stage}
            },
            "timestamp": datetime.utcnow()
        })
```

---

### 2. Real-Time WebSocket with Error Recovery

```python
@app.websocket("/ws/cases/{case_id}")
async def websocket_endpoint(websocket: WebSocket, case_id: str, token: str):
    # Auth
    user = await auth_service.verify_token(token)
    
    # Connect
    await manager.connect(case_id, websocket)
    user_presence = {"user_id": user.id, "user_name": user.name}
    await manager.broadcast_to_case(case_id, {
        "type": "user_joined",
        "user": user_presence
    })
    
    last_heartbeat = datetime.utcnow()
    
    try:
        while True:
            try:
                # Receive with timeout
                data = await asyncio.wait_for(
                    websocket.receive_json(), timeout=90.0
                )
                
                if data["type"] == "heartbeat":
                    last_heartbeat = datetime.utcnow()
                    await websocket.send_json({"type": "heartbeat_ack"})
                    
                elif data["type"] in ["task_updated", "comment_added"]:
                    # Broadcast to other clients
                    await manager.broadcast_to_case(case_id, {
                        "type": data["type"],
                        "payload": data["payload"],
                        "user_id": user.id
                    })
                    
            except asyncio.TimeoutError:
                # Heartbeat timeout—client not responding, close
                await websocket.close(code=1000, reason="Heartbeat timeout")
                
    except WebSocketDisconnect:
        manager.disconnect(case_id, websocket)
        await manager.broadcast_to_case(case_id, {
            "type": "user_left",
            "user_id": user.id
        })
```

---

### 3. NgRx State Update on WebSocket Message

```typescript
// In ChatEffects
@Injectable()
export class CasesEffects {
  @Effect()
  websocketMessages$ = this.store.select(selectWebSocketMessage)
    .pipe(
      filter(msg => msg?.type === 'task_updated'),
      tap(msg => this.store.dispatch(
        updateTask({
          task: msg.payload,
          source: 'websocket'
        })
      ))
    );
}

// Reducer handles both HTTP + WebSocket updates identically
on(updateTask, (state, {task}) => ({
  ...state,
  list: state.list.map(t => t.id === task.id ? task : t)
}))
```

---

### 4. Error Handling & Retry Pattern

```python
# Backend — Retry on transient failure
async def save_notification_with_retry(notification, max_retries=3):
    for attempt in range(max_retries):
        try:
            await db.notifications.insert_one(notification)
            return
        except pymongo.errors.ConnectionFailure as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed to save notification after {max_retries} retries")
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff

# Frontend — HTTP Interceptor with retry
export class HttpRetryInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      retry({
        count: 3,
        delay: (error, retryCount) => {
          if (retryCount === 3 || error.status < 500) {
            return throwError(() => error);
          }
          return timer(1000 * Math.pow(2, retryCount - 1));
        }
      })
    );
  }
}
```

---

### 5. SLA Deadline Calculation

```python
from datetime import datetime, timedelta

class SLAEngine:
    async def check_slas(self):
        # Find all in-progress cases
        in_progress_cases = await db.cases.find({
            "stages": {
                "$elemMatch": {"status": "in_progress"}
            }
        }).to_list(None)
        
        for case in in_progress_cases:
            current_stage = case["stages"][-1]
            workflow = await db.case_types.find_one({"name": case["type"]})
            sla_rule = next((
                r for r in workflow["sla_rules"]
                if r["stage"] == current_stage["name"]
            ), None)
            
            if not sla_rule:
                continue
            
            sla_hours = sla_rule["sla_hours"]
            stage_entered = current_stage["entered_at"]
            target_date = stage_entered + timedelta(hours=sla_hours)
            
            now = datetime.utcnow()
            time_remaining = (target_date - now).total_seconds() / 3600  # hours
            percent_elapsed = ((now - stage_entered).total_seconds() / (sla_hours * 3600)) * 100
            
            # Determine escalation level
            if percent_elapsed >= 125:
                level = 2  # Critical
            elif percent_elapsed >= 100:
                level = 1  # Breached
            elif percent_elapsed >= 75:
                level = 0  # Warning
            else:
                level = -1  # On track
            
            # Update if escalated
            if level >= 0:
                await db.cases.update_one(
                    {"_id": case["_id"]},
                    {
                        "$set": {
                            "sla.target_date": target_date,
                            "sla.escalation_level": level
                        }
                    }
                )
                
                # Send alerts
                await self.send_escalation_alert(case, level, time_remaining)
```

---

## Testing Patterns

### Backend Unit Test

```python
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
async def test_user():
    user = User(email="test@example.com", role="MANAGER")
    await db.users.insert_one(user.dict())
    return user

def test_create_case(client, test_user):
    token = create_test_token(test_user.id)
    response = client.post(
        "/cases",
        json={
            "type": "loan_origination",
            "priority": "high",
            "team_id": str(test_user.team_ids[0])
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    assert response.json()["status"] == "open"
```

### Frontend Component Test

```typescript
describe('CaseDetailComponent', () => {
  let component: CaseDetailComponent;
  let fixture: ComponentFixture<CaseDetailComponent>;
  let store: Store;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CaseDetailComponent],
      providers: [provideMockStore()]
    }).compileComponents();

    fixture = TestBed.createComponent(CaseDetailComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(Store);
  });

  it('should display case details', () => {
    const mockCase = { id: '1', type: 'loan', stage: 'intake' };
    store.dispatch(selectCase({case: mockCase}));
    fixture.detectChanges();
    
    expect(component.case()).toBe(mockCase);
    expect(fixture.debugElement.query(By.css('.case-id'))
      .nativeElement.textContent).toContain('1');
  });
});
```

---

## Performance Optimization Checklist

### Backend
- [ ] MongoDB indexes on frequently queried fields (status, stage, created_at)
- [ ] Pagination implemented (skip/limit in queries)
- [ ] Connection pooling configured in Motor
- [ ] Caching: Redis for user sessions
- [ ] Profiling: track slow queries (> 100ms)

### Frontend
- [ ] Lazy loading modules (cases, tasks, admin)
- [ ] OnPush change detection strategy
- [ ] Unsubscribe in OnDestroy (no memory leaks)
- [ ] Virtual scrolling for large lists
- [ ] Image optimization (lazy load, WebP format)

### DevOps
- [ ] Load testing (100+ concurrent users)
- [ ] Monitor CPU, memory, disk usage
- [ ] Auto-scaling based on load (Kubernetes)
- [ ] Database backup strategy (daily snapshots)
- [ ] Log aggregation (centralized logs)

---

## Debugging Tips

### API Issues
```bash
# Check service health
curl http://localhost:8002/health

# Check MongoDB
docker-compose exec mongodb mongosh
> db.cases.findOne()

# Check logs
docker-compose logs case-service --tail 50

# Inspect JWT token
curl -H "Authorization: Bearer {TOKEN}" http://localhost:8002/auth/me
```

### Frontend Issues
```typescript
// NgRx store debugging
redux-devtools-extension in Chrome → Time travel through state changes

// API calls
Network tab in DevTools → check request/response headers + body

// Component debugging
ng serve --source-map  // Enables full source maps
debugger; // Set breakpoints in Chrome
```

---

## Deployment Checklist

- [ ] Environment secrets configured (.env not in git)
- [ ] Database backups automated (daily)
- [ ] SSL/TLS certificates valid
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Log retention policy set
- [ ] Monitoring + alerts configured
- [ ] Disaster recovery plan tested

---

## AI / LLM Provider Configuration

### Configured Providers

The platform supports **4 LLM providers + 1 stub fallback**, configured in `backend/config/llm_providers.yaml`:

| # | Provider | Type | Model | Use Case |
|---|----------|------|-------|----------|
| 1 | **OpenAI** | `openai` | `gpt-4o` | Primary cloud provider |
| 2 | **Azure OpenAI** | `azure` | `gpt-4o` | Enterprise / compliance deployments |
| 3 | **Ollama** | `ollama` | `llama3` | Local / air-gapped / privacy-sensitive |
| 4 | **Custom** | `custom` | Configurable | Any OpenAI-compatible API |
| 5 | **Stub** (built-in) | `stub` | N/A | Offline fallback — hardcoded responses |

### Architecture

```
┌─────────────────────────────────────────────┐
│           AI Agents (Copilot, Risk,         │
│       Recommendation, Summarization)        │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │    LLMClient      │  ← Singleton, provider-agnostic
         │  (llm_client.py)  │
         └────┬────┬────┬────┘
              │    │    │
    ┌─────────▼┐ ┌▼────▼──────┐ ┌──────────┐
    │  OpenAI  │ │   Custom   │ │   Stub   │
    │ Provider │ │  Provider  │ │ Provider │
    └──────────┘ └────────────┘ └──────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `backend/config/llm_providers.yaml` | Provider definitions (model, API key env vars, temperature, max_tokens) |
| `backend/agents/llm_client.py` | Singleton LLMClient — `chat()`, `stream()`, fallback chain, `health_check()` |
| `backend/agents/providers/openai_provider.py` | Handles OpenAI, Azure OpenAI, and Ollama (all OpenAI-compatible) |
| `backend/agents/providers/custom_provider.py` | Generic HTTP LLM with configurable request/response templates |
| `backend/agents/providers/stub_provider.py` | Hardcoded responses for offline/fallback mode |
| `backend/agents/providers/base.py` | `BaseLLMProvider` ABC, `LLMMessage`, `LLMResponse`, `LLMConfig` |
| `backend/routes/config_api.py` | Runtime switching: `GET/PATCH /api/config/llm/active` |
| `backend/agents/embeddings.py` | Text → vector pipeline (sentence-transformers or hash fallback) |

### Fallback Chain

```
Primary Provider → fallback_provider (from YAML) → Stub Provider
```

If the active provider fails, the system automatically falls to the next in chain. The stub provider ensures AI features never hard-crash — they return safe placeholder responses.

### Runtime Switching (Admin API)

```bash
# Check active provider
GET /api/config/llm/active
# Response: { "provider": "openai", "label": "OpenAI", "type": "openai", "model": "gpt-4o" }

# Switch provider (admin only)
PATCH /api/config/llm/active
Body: { "provider": "ollama" }
```

### AI Agents

| Agent | Purpose | LLM Required? |
|-------|---------|---------------|
| **CopilotAgent** | Natural language orchestrator (creates workflows, forms via chat) | Yes (or stub) |
| **FormBuilderAgent** | Generates form JSON from description | Yes (or stub) |
| **WorkflowBuilderAgent** | Generates workflow stages/transitions from description | Yes (or stub) |
| **SummarizationAgent** | Case summary generation | Yes (or stub) |
| **RecommendationAgent** | Next-action recommendations | Yes (or stub) |
| **RiskAgent** | Risk flag detection | Yes (or stub) |
| **CommandParser** | Intent extraction from user input | Yes (or stub) |

### LLM vs Core Features — Dependency Matrix

| Feature | Works Without LLM? | Notes |
|---------|-------------------|-------|
| Case CRUD | ✅ Yes | Standard REST |
| Workflow Designer (visual) | ✅ Yes | Drag-and-drop, no AI needed |
| Form Builder (manual) | ✅ Yes | Schema-driven fields |
| User Management | ✅ Yes | Auth + roles |
| Task Management | ✅ Yes | Kanban + assignments |
| SLA & Escalations | ✅ Yes | Rule-based engine |
| Documents | ✅ Yes | Upload/download |
| Comments & Activity | ✅ Yes | Standard CRUD |
| AI Copilot Chat | ⚡ Degraded | Stub returns placeholder |
| AI Recommendations | ⚡ Degraded | Stub returns generic list |
| AI Risk Assessment | ⚡ Degraded | Stub returns empty flags |
| AI Summarization | ⚡ Degraded | Stub returns brief text |
| Semantic Search | ⚡ Degraded | Falls back to hash-based vectors |

---

**Reference Created:** 2026-03-14
