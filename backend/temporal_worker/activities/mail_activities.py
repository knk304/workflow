"""Mail activities — durable email dispatch with automatic retries."""

from __future__ import annotations

from dataclasses import dataclass

from temporalio import activity


@dataclass
class SendMailParams:
    template_key: str
    recipient_ids: list[str]
    context: dict
    case_id: str | None = None


@activity.defn
async def send_mail_activity(params: SendMailParams) -> dict:
    """
    Dispatch an email via the existing mail_engine.
    Temporal retries this on transient SMTP / network failures.
    """
    from mail_engine.mail_dispatcher import dispatch_mail

    result = await dispatch_mail(
        template_key=params.template_key,
        recipient_ids=params.recipient_ids,
        context=params.context,
        case_id=params.case_id,
    )
    return result or {"dispatched": True}


@activity.defn
async def send_sla_escalation_activity(case_id: str) -> dict:
    """Send SLA breach notification and update escalation level on the case."""
    from database import get_db
    from datetime import datetime, timezone

    db = get_db()
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return {"skipped": True, "reason": "case_not_found"}

    if case.get("status") in ("resolved", "cancelled"):
        return {"skipped": True, "reason": "case_already_closed"}

    now = datetime.now(timezone.utc).isoformat()
    new_level = case.get("escalation_level", 0) + 1
    await db.cases.update_one(
        {"_id": case_id},
        {"$set": {"escalation_level": new_level, "updated_at": now}},
    )

    # Fire mail hook if mail engine is configured
    try:
        from mail_engine.mail_hooks import on_sla_breached
        await on_sla_breached(case_id, case.get("owner_id"), new_level)
    except Exception:
        pass  # mail failure must not block escalation recording

    return {"case_id": case_id, "escalation_level": new_level}
