"""
Mail Engine — Pluggable email notification module.

Public API:
    from mail_engine import mail_hooks, mail_router, mail_settings

    # Register router in main.py:
    app.include_router(mail_router)

    # Call hooks from lifecycle/step engine:
    await mail_hooks.on_case_created(case_id, case_type_id, title, owner_id, team_id)
"""

from mail_engine.mail_routes import router as mail_router
from mail_engine.config import get_mail_settings, MailSettings
from mail_engine import mail_hooks

__all__ = ["mail_router", "mail_hooks", "get_mail_settings", "MailSettings"]
