"""
Mail Engine — event types and data models.
"""

from enum import Enum
from pydantic import BaseModel
from typing import Optional


class MailEvent(str, Enum):
    case_created = "case_created"
    case_status_changed = "case_status_changed"
    step_assigned = "step_assigned"
    step_completed = "step_completed"
    case_resolved = "case_resolved"


class RecipientType(str, Enum):
    owner = "owner"
    assignee = "assignee"
    team_dl = "team_dl"
    custom = "custom"


class MailLogStatus(str, Enum):
    sent = "sent"
    failed = "failed"
    skipped = "skipped"


# ── Request / Response Models ──────────────────────────────

class MailConfigCreate(BaseModel):
    case_type_id: str
    event: MailEvent
    enabled: bool = True
    recipient_type: RecipientType
    custom_emails: list[str] = []
    subject_template: str = "{{case_id}} — {{event_label}}"
    template_override: Optional[str] = None


class MailConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    recipient_type: Optional[RecipientType] = None
    custom_emails: Optional[list[str]] = None
    subject_template: Optional[str] = None
    template_override: Optional[str] = None


class MailConfigResponse(BaseModel):
    id: str
    case_type_id: str
    case_type_name: Optional[str] = None
    event: MailEvent
    enabled: bool
    recipient_type: RecipientType
    custom_emails: list[str] = []
    subject_template: str
    template_override: Optional[str] = None
    created_at: str
    updated_at: str


class MailLogResponse(BaseModel):
    id: str
    case_id: str
    case_type_id: str
    event: MailEvent
    recipients: list[str]
    subject: str
    status: MailLogStatus
    error: Optional[str] = None
    sent_at: str


class MailTestRequest(BaseModel):
    to_email: str
    subject: str = "Test Email from Workflow Platform"
    body: str = "This is a test email to verify SMTP configuration."
