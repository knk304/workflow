"""
Mail Engine — Public hook functions.

These are the ONLY integration points with the existing codebase.
Each function is fire-and-forget and wrapped in try/except so mail
failure never blocks case operations.

Usage in lifecycle.py / assignment_step.py:
    from mail_engine.mail_hooks import on_case_created
    try:
        await on_case_created(case_id, case_type_id, title, owner_id, team_id)
    except Exception:
        pass
"""

import logging
from mail_engine.config import get_mail_settings

logger = logging.getLogger("mail_engine.hooks")


async def on_case_created(
    case_id: str,
    case_type_id: str,
    title: str,
    owner_id: str,
    team_id: str | None = None,
):
    """Hook: called after a new case is instantiated."""
    if not get_mail_settings().mail_enabled:
        return
    try:
        from database import get_db
        from mail_engine.mail_dispatcher import dispatch_mail_event
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        if case:
            await dispatch_mail_event("case_created", case, db)
    except Exception:
        logger.exception("Mail hook on_case_created failed for %s", case_id)


async def on_case_status_changed(
    case_id: str,
    old_status: str,
    new_status: str,
    changed_by: str,
):
    """Hook: called after case status changes (resolve, withdraw, stage advance)."""
    if not get_mail_settings().mail_enabled:
        return
    try:
        from database import get_db
        from mail_engine.mail_dispatcher import dispatch_mail_event
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        if case:
            await dispatch_mail_event(
                "case_status_changed", case, db,
                extra_context={"old_status": old_status, "new_status": new_status,
                               "changed_by": changed_by},
            )
    except Exception:
        logger.exception("Mail hook on_case_status_changed failed for %s", case_id)


async def on_step_assigned(
    case_id: str,
    assignment_id: str,
    step_name: str,
    assigned_to: str | None = None,
    assigned_team_id: str | None = None,
):
    """Hook: called after an assignment step is activated."""
    if not get_mail_settings().mail_enabled:
        return
    try:
        from database import get_db
        from mail_engine.mail_dispatcher import dispatch_mail_event
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        assignment = await db.assignments.find_one({"_id": assignment_id})
        if case:
            step_ctx = {
                "name": step_name,
                "assigned_to": assigned_to,
                "type": "assignment",
            }
            await dispatch_mail_event("step_assigned", case, db, step=step_ctx)
    except Exception:
        logger.exception("Mail hook on_step_assigned failed for %s", case_id)


async def on_step_completed(
    case_id: str,
    step_name: str,
    completed_by: str,
):
    """Hook: called after a step is completed."""
    if not get_mail_settings().mail_enabled:
        return
    try:
        from database import get_db
        from mail_engine.mail_dispatcher import dispatch_mail_event
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        if case:
            await dispatch_mail_event(
                "step_completed", case, db,
                step={"name": step_name, "type": "assignment"},
                extra_context={"completed_by": completed_by},
            )
    except Exception:
        logger.exception("Mail hook on_step_completed failed for %s", case_id)


async def on_case_resolved(
    case_id: str,
    resolution_status: str,
    resolved_by: str,
):
    """Hook: called after case is resolved/cancelled/rejected."""
    if not get_mail_settings().mail_enabled:
        return
    try:
        from database import get_db
        from mail_engine.mail_dispatcher import dispatch_mail_event
        db = get_db()
        case = await db.cases.find_one({"_id": case_id})
        if case:
            await dispatch_mail_event(
                "case_resolved", case, db,
                extra_context={"resolution_status": resolution_status,
                               "resolved_by": resolved_by},
            )
    except Exception:
        logger.exception("Mail hook on_case_resolved failed for %s", case_id)
