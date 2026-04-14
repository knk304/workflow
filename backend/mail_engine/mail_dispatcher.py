"""
Mail Engine — Dispatcher.

Takes a mail event + case context, looks up mail_configs in MongoDB,
resolves recipients, renders templates, sends emails, and logs results.
"""

import logging
from datetime import datetime, timezone
from bson import ObjectId
from mail_engine.config import get_mail_settings
from mail_engine.models import MailEvent
from mail_engine.recipient_resolver import resolve_recipients
from mail_engine.template_engine import render_subject, render_body, DEFAULT_TEMPLATES
from mail_engine.mail_service import send_email

logger = logging.getLogger("mail_engine.dispatcher")

# Human-readable labels for event types
EVENT_LABELS = {
    "case_created": "Case Created",
    "case_status_changed": "Case Status Changed",
    "step_assigned": "Step Assigned",
    "step_completed": "Step Completed",
    "case_resolved": "Case Resolved",
}


async def dispatch_mail_event(
    event: str,
    case: dict,
    db,
    step: dict | None = None,
    extra_context: dict | None = None,
):
    """
    Main dispatcher — called by mail_hooks.

    1. Check if mail is enabled globally
    2. Find all mail_configs for this case_type_id + event
    3. For each enabled config: resolve recipients, render, send, log
    """
    settings = get_mail_settings()
    if not settings.mail_enabled:
        return

    case_type_id = case.get("case_type_id", "")
    case_id = case.get("_id", "")

    # Find matching configs
    configs = await db.mail_configs.find({
        "case_type_id": case_type_id,
        "event": event,
        "enabled": True,
    }).to_list(length=50)

    if not configs:
        logger.debug("No mail config for case_type=%s event=%s", case_type_id, event)
        return

    # Build template context
    context = {
        "case_id": case_id,
        "case_title": case.get("title", ""),
        "case_type_id": case_type_id,
        "case_type_name": case.get("case_type_name", ""),
        "status": case.get("status", ""),
        "priority": case.get("priority", ""),
        "owner_id": case.get("owner_id", ""),
        "team_id": case.get("team_id", ""),
        "event": event,
        "event_label": EVENT_LABELS.get(event, event),
        "step_name": step.get("name", "") if step else "",
        "step_type": step.get("type", "") if step else "",
        "assigned_to": step.get("assigned_to", "") if step else "",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        **(extra_context or {}),
    }

    # Resolve owner name for templates
    owner = await db.users.find_one({"_id": case.get("owner_id")}, {"name": 1, "email": 1})
    context["owner_name"] = owner.get("name", "") if owner else ""
    context["owner_email"] = owner.get("email", "") if owner else ""

    # Resolve assignee name
    if step and step.get("assigned_to"):
        assignee = await db.users.find_one({"_id": step["assigned_to"]}, {"name": 1, "email": 1})
        context["assignee_name"] = assignee.get("name", "") if assignee else ""

    for config in configs:
        try:
            recipients = await resolve_recipients(
                recipient_type=config.get("recipient_type", "owner"),
                custom_emails=config.get("custom_emails", []),
                case=case,
                step=step,
                db=db,
            )

            if not recipients:
                await _log_mail(db, case_id, case_type_id, event, [], "N/A", "skipped",
                                "No recipients resolved")
                continue

            # Render subject
            subject = render_subject(
                config.get("subject_template", "{{case_id}} — {{event_label}}"),
                context,
            )

            # Render body
            template_name = config.get("template_override") or DEFAULT_TEMPLATES.get(event, "case_created.html")
            body = render_body(template_name, context)

            # Send
            result = await send_email(recipients, subject, body)

            status = "sent" if result["success"] else "failed"
            await _log_mail(db, case_id, case_type_id, event, recipients, subject,
                            status, result.get("error"))

        except Exception as exc:
            logger.exception("Mail dispatch error for config %s: %s", config.get("_id"), exc)
            await _log_mail(db, case_id, case_type_id, event, [], "Error", "failed", str(exc))


async def _log_mail(db, case_id, case_type_id, event, recipients, subject, status, error=None):
    """Write to mail_logs collection."""
    settings = get_mail_settings()
    if not settings.mail_log_enabled:
        return

    await db.mail_logs.insert_one({
        "_id": str(ObjectId()),
        "case_id": case_id,
        "case_type_id": case_type_id,
        "event": event,
        "recipients": recipients,
        "subject": subject,
        "status": status,
        "error": error,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })
