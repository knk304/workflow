"""
Mail Engine — Async SMTP email sender with retry.

Sends HTML emails via aiosmtplib (async) or falls back to smtplib (sync in thread).
"""

import logging
import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from mail_engine.config import get_mail_settings

logger = logging.getLogger("mail_engine.mail_service")


async def send_email(
    to_addresses: list[str],
    subject: str,
    html_body: str,
) -> dict:
    """
    Send an HTML email to one or more recipients.
    Returns {"success": True/False, "error": str|None}.
    """
    settings = get_mail_settings()

    if not settings.mail_enabled:
        return {"success": False, "error": "Mail is disabled (MAIL_ENABLED=false)"}

    if not to_addresses:
        return {"success": False, "error": "No recipients"}

    if not settings.mail_smtp_user or not settings.mail_smtp_password:
        return {"success": False, "error": "SMTP credentials not configured"}

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.mail_from_name} <{settings.mail_from_address}>"
    msg["To"] = ", ".join(to_addresses)
    msg.attach(MIMEText(html_body, "html"))

    last_error = None
    for attempt in range(1, settings.mail_max_retries + 1):
        try:
            # Run blocking SMTP in a thread to avoid blocking the event loop
            await asyncio.get_event_loop().run_in_executor(
                None, _send_smtp, settings, to_addresses, msg
            )
            logger.info("Email sent to %s (attempt %d)", to_addresses, attempt)
            return {"success": True, "error": None}
        except Exception as exc:
            last_error = str(exc)
            logger.warning("SMTP send attempt %d failed: %s", attempt, exc)
            if attempt < settings.mail_max_retries:
                await asyncio.sleep(1)

    logger.error("All SMTP attempts failed for %s: %s", to_addresses, last_error)
    return {"success": False, "error": last_error}


def _send_smtp(settings, to_addresses: list[str], msg: MIMEMultipart):
    """Blocking SMTP send — runs in executor."""
    if settings.mail_smtp_use_tls:
        server = smtplib.SMTP(settings.mail_smtp_host, settings.mail_smtp_port,
                               timeout=settings.mail_timeout_seconds)
        server.starttls()
    else:
        server = smtplib.SMTP(settings.mail_smtp_host, settings.mail_smtp_port,
                               timeout=settings.mail_timeout_seconds)

    try:
        server.login(settings.mail_smtp_user, settings.mail_smtp_password)
        server.sendmail(settings.mail_from_address, to_addresses, msg.as_string())
    finally:
        server.quit()
