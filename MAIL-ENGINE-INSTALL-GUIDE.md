# Mail Engine — Portable Installation Guide

## Overview

The Mail Engine is a self-contained, pluggable email notification module. It can be copied into any project that uses **FastAPI + MongoDB (Motor) + Angular** with minimal configuration.

---

## Quick Install (3 Steps)

### Step 1: Copy backend module

Copy the `backend/mail_engine/` folder into your project's backend directory:

```
your-project/
  backend/
    mail_engine/          ← copy this entire folder
      __init__.py
      config.py
      models.py
      template_engine.py
      recipient_resolver.py
      mail_service.py
      mail_dispatcher.py
      mail_hooks.py
      mail_routes.py
      templates/
        base.html
        case_created.html
        case_status_changed.html
        step_assigned.html
        step_completed.html
        case_resolved.html
```

Also copy the seed file (optional, for demo data):
```
backend/seed_mail_configs.py   ← copy if you want seed data
```

### Step 2: Register the router

In your `main.py` (FastAPI app), add **2 lines**:

```python
# Import
from mail_engine import mail_router

# Register (add alongside other routers)
app.include_router(mail_router)
```

### Step 3: Add hooks to your case engine

Add these hook calls wherever your case lifecycle events fire. Each is a one-line, try/except-wrapped call:

```python
# After case creation (e.g. in lifecycle.py):
try:
    from mail_engine.mail_hooks import on_case_created
    await on_case_created(case_id, case_type_id, title, owner_id, team_id)
except Exception:
    pass

# After step assignment (e.g. in assignment_step.py):
try:
    from mail_engine.mail_hooks import on_step_assigned
    await on_step_assigned(case_id, assignment_id, step_name, assigned_to, team_id)
except Exception:
    pass

# After step completion (e.g. in step_engine.py):
try:
    from mail_engine.mail_hooks import on_step_completed
    await on_step_completed(case_id, step_name, completed_by_user_id)
except Exception:
    pass

# After case resolved/withdrawn (e.g. in lifecycle.py):
try:
    from mail_engine.mail_hooks import on_case_resolved
    await on_case_resolved(case_id, resolution_status, resolved_by_user_id)
except Exception:
    pass

# After case status changed:
try:
    from mail_engine.mail_hooks import on_case_status_changed
    await on_case_status_changed(case_id, old_status, new_status, changed_by)
except Exception:
    pass
```

---

## Backend Configuration

### Environment Variables (.env)

Add these to your `.env` file:

```env
# ── Mail Engine ──────────────────────────
MAIL_ENABLED=true
MAIL_SMTP_HOST=smtp.gmail.com
MAIL_SMTP_PORT=587
MAIL_SMTP_USER=noreply@yourcompany.com
MAIL_SMTP_PASSWORD=your-app-password
MAIL_SMTP_USE_TLS=true
MAIL_FROM_ADDRESS=noreply@yourcompany.com
MAIL_FROM_NAME=Your Platform Name
MAIL_LOG_ENABLED=true
MAIL_MAX_RETRIES=2
MAIL_TIMEOUT_SECONDS=10
```

Set `MAIL_ENABLED=false` to disable all email sending (hooks become instant no-ops).

### Python Dependencies

Add to your `requirements.txt`:

```
jinja2==3.1.4
```

> `jinja2` may already be installed as a transitive dependency of FastAPI/Starlette.

### MongoDB Collections

The module automatically creates:
- `mail_configs` — email notification configurations per case type
- `mail_logs` — sent email audit trail

No manual collection creation needed.

### Database Expectations

The module reads from these existing collections:
- `cases` — case instances (reads `_id`, `case_type_id`, `title`, `status`, `owner_id`, `team_id`)
- `users` — user accounts (reads `_id`, `email`, `name`)
- `teams` — teams (reads `_id`, `dl_email`, `member_ids`)
- `assignments` — step assignments (reads `assigned_to`)
- `case_type_definitions` — case type names (reads `_id`, `name`)

### Team Distribution List Email

To use the `team_dl` recipient type, add a `dl_email` field to your teams collection:

```json
{ "_id": "team-1", "name": "Loan Processing", "dl_email": "loan-team@company.com", ... }
```

If `dl_email` is not set, the module falls back to emailing all team members individually.

---

## Frontend Installation

### Step 1: Copy frontend components

Copy the `frontend/src/app/features/admin/mail-config/` folder:

```
your-project/
  frontend/src/app/features/admin/
    mail-config/              ← copy this entire folder
      mail.service.ts
      mail-config.component.ts
      mail-config-dialog.component.ts
      mail-log-viewer.component.ts
      mail-test-dialog.component.ts
```

### Step 2: Add routes

In your routing configuration (e.g. `app.routes.ts`), add:

```typescript
import { MailConfigComponent } from './features/admin/mail-config/mail-config.component';
import { MailLogViewerComponent } from './features/admin/mail-config/mail-log-viewer.component';

// Inside admin children:
{ path: 'mail-config', component: MailConfigComponent, data: { title: 'Email Notifications' } },
{ path: 'mail-logs', component: MailLogViewerComponent, data: { title: 'Email Delivery Log' } },
```

### Step 3: Add nav link (optional)

Add a navigation link in your admin menu:

```html
<a mat-menu-item routerLink="/admin/mail-config" routerLinkActive="menu-active">
  <mat-icon>email</mat-icon>
  <span>Email Notifications</span>
</a>
```

### Frontend Dependencies

The components use standard Angular Material modules (no extra npm packages):
- `@angular/material` (button, icon, table, dialog, form-field, select, slide-toggle, chips, menu, tooltip, snack-bar, spinner, input)
- `@angular/cdk` (keycodes)
- `@angular/forms` (FormsModule)

### API Base URL

The `MailService` reads from `environment.caseApiUrl`. It constructs URLs as:
```
${environment.caseApiUrl}/mail/configs
${environment.caseApiUrl}/mail/logs
${environment.caseApiUrl}/mail/test
${environment.caseApiUrl}/mail/templates
${environment.caseApiUrl}/mail/settings
```

Update the base URL in `mail.service.ts` if your API gateway path differs.

### Frontend Model Dependencies

The components import from:
- `../../../core/services/data.service` — uses `getCaseTypeDefinitions()` for the case type dropdown
- `../../../core/models` — uses `CaseTypeDefinition` interface

Adjust import paths to match your project structure.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/mail/configs` | List all mail configs (optional `?case_type_id=`) |
| GET | `/api/mail/configs/by-case-type/{id}` | Configs for a specific case type |
| POST | `/api/mail/configs` | Create a mail config |
| PATCH | `/api/mail/configs/{id}` | Update a mail config |
| DELETE | `/api/mail/configs/{id}` | Delete a mail config |
| GET | `/api/mail/logs` | View mail logs (filters: `case_type_id`, `case_id`, `event`, `status`) |
| POST | `/api/mail/test` | Send a test email |
| GET | `/api/mail/templates` | List available email templates |
| GET | `/api/mail/settings` | View SMTP configuration status (no passwords exposed) |

---

## Customization

### Custom Email Templates

Add new `.html` templates to `mail_engine/templates/`. They can extend `base.html`:

```html
{% extends "base.html" %}
{% block header_title %}My Custom Event{% endblock %}
{% block content %}
  <p>Case {{ case_id }} — {{ case_title }}</p>
  <!-- Your custom content -->
{% endblock %}
```

Set `template_override` in the mail config to use your custom template filename.

### Available Template Variables

All templates receive:
- `case_id`, `case_title`, `case_type_id`, `case_type_name`
- `status`, `priority`, `owner_id`, `owner_name`, `owner_email`, `team_id`
- `event`, `event_label`, `timestamp`
- `step_name`, `step_type`, `assigned_to`, `assignee_name` (when applicable)
- Any `extra_context` passed by hooks (e.g. `old_status`, `new_status`, `resolution_status`)

---

## Removal

To remove the mail engine:

1. Delete `backend/mail_engine/` folder
2. Remove `from mail_engine import mail_router` and `app.include_router(mail_router)` from `main.py`
3. Remove the hook calls (search for `mail_hooks` in engine files)
4. Delete `frontend/src/app/features/admin/mail-config/` folder
5. Remove the routes and nav links from `app.routes.ts` and `shell.component.ts`
6. Drop MongoDB collections: `mail_configs`, `mail_logs`

No other code is affected.
