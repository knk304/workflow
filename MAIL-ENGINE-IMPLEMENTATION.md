# Mail Engine — Pluggable Email Notification Module

## Overview

A **standalone, self-contained** email notification module for the Workflow Platform. Triggers emails on case lifecycle events (case created, status changed, step assigned, step completed, case resolved). Designed as **plug-and-play** — drop the module in, register one router and a few one-line hooks, done.

---

## Scope

**Triggers ONLY on Case Designer flow** (case lifecycle, assignments) — NOT workflow/flow executions.

| Event | Trigger Point | Default Recipients |
|---|---|---|
| Case Created | After `instantiate_case()` | Case owner, team DL |
| Case Status Changed | After resolve / withdraw / stage advance | Case owner, team DL, current assignee |
| Step Assigned | After `assignment_step.activate()` | Assigned user, or team DL |
| Step Completed | After step completion | Case owner |
| Case Resolved | After case reaches terminal status | Case owner, team DL |

---

## Architecture

```
Case Event (lifecycle.py / assignment_step.py)
    │
    ▼  one-line hook call (fire-and-forget, try/except)
mail_hooks.on_<event>(case_id, ...)
    │
    ▼  lookup
mail_dispatcher → mail_configs collection (enabled for this case_type + event?)
    │
    ▼  resolve
recipient_resolver → users/teams collections → email addresses + team DLs
    │
    ▼  render
template_engine → Jinja2 HTML template with case context
    │
    ▼  send
mail_service → SMTP (async) → log to mail_logs collection
```

---

## Backend Structure

```
backend/mail_engine/
├── __init__.py              Public API exports
├── config.py                SMTP settings (env-based, MAIL_ prefix)
├── models.py                Pydantic models: MailConfigCreate, MailLog, etc.
├── event_types.py           MailEvent enum
├── recipient_resolver.py    Resolves user/team → email addresses
├── template_engine.py       Jinja2 template loader + renderer
├── mail_service.py          Async SMTP sender with retry
├── mail_dispatcher.py       Event → config lookup → render → send
├── mail_hooks.py            Public hook functions (non-invasive)
├── mail_routes.py           FastAPI router: /api/mail/*
└── templates/
    ├── base.html            Shared layout (header, footer)
    ├── case_created.html
    ├── case_status_changed.html
    ├── step_assigned.html
    ├── step_completed.html
    └── case_resolved.html
```

## Frontend Structure

```
frontend/src/app/features/admin/mail-config/
├── mail.service.ts                  Standalone HTTP service
├── mail-config.component.ts         Config list page
├── mail-config-dialog.component.ts  Add/edit config dialog
├── mail-log-viewer.component.ts     Sent mail audit log
└── mail-test-dialog.component.ts    Test email sender
```

---

## MongoDB Collections

### `mail_configs` — Per-case-type event email configuration
```json
{
  "_id": "ObjectId",
  "case_type_id": "ct-loan",
  "event": "case_created",
  "enabled": true,
  "recipient_type": "owner | assignee | team_dl | custom",
  "custom_emails": ["dl-underwriting@company.com"],
  "subject_template": "Case {{case_id}} created — {{case_title}}",
  "template_override": null,
  "created_at": "ISO",
  "updated_at": "ISO"
}
```

### `mail_logs` — Immutable send audit trail
```json
{
  "_id": "ObjectId",
  "case_id": "LOAN-001",
  "case_type_id": "ct-loan",
  "event": "case_created",
  "recipients": ["alice@example.com"],
  "subject": "Case LOAN-001 created — Home Loan App",
  "status": "sent | failed | skipped",
  "error": null,
  "sent_at": "ISO"
}
```

---

## Integration Points (3 files touched, 1 line each)

| File | Change |
|---|---|
| `backend/main.py` | `app.include_router(mail_router)` |
| `backend/engine/lifecycle.py` | `await mail_hooks.on_case_created(...)` after insert |
| `backend/engine/steps/assignment_step.py` | `await mail_hooks.on_step_assigned(...)` after insert |

Each hook call is wrapped in `try/except` — mail failure never blocks case operations.

---

## Configuration

All SMTP settings via environment variables (`.env` file):

```env
MAIL_ENABLED=true
MAIL_SMTP_HOST=smtp.gmail.com
MAIL_SMTP_PORT=587
MAIL_SMTP_USER=noreply@company.com
MAIL_SMTP_PASSWORD=app-password-here
MAIL_SMTP_USE_TLS=true
MAIL_FROM_ADDRESS=noreply@company.com
MAIL_FROM_NAME=Workflow Platform
```

Set `MAIL_ENABLED=false` to disable all email sending (hooks become no-ops).

---

## Portability

| Concern | Solution |
|---|---|
| Zero core engine changes | Hooks are one-line, try/except wrapped, removable |
| Self-contained backend | `mail_engine/` has own config, models, routes, templates |
| Self-contained frontend | `mail-config/` is standalone with own service |
| Project-portable | Copy module + add router + add hooks = done |
| Kill-switch | `MAIL_ENABLED=false` → all hooks instant no-ops |
| No NgRx needed | Frontend uses standalone injectable service |
