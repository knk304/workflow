"""
Mail Engine — Admin API routes.

Endpoints:
  GET    /api/mail/configs                    List all mail configs
  GET    /api/mail/configs/{case_type_id}     Configs for a case type
  POST   /api/mail/configs                    Create mail config
  PATCH  /api/mail/configs/{id}               Update mail config
  DELETE /api/mail/configs/{id}               Delete mail config
  GET    /api/mail/logs                       View sent mail log
  POST   /api/mail/test                       Send a test email
  GET    /api/mail/templates                  List available templates
  GET    /api/mail/settings                   Current mail settings (safe view)
"""

from fastapi import APIRouter, HTTPException, Query, status
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

from database import get_db
from mail_engine.config import get_mail_settings
from mail_engine.models import (
    MailConfigCreate, MailConfigUpdate, MailConfigResponse,
    MailLogResponse, MailTestRequest,
)
from mail_engine.template_engine import list_templates
from mail_engine.mail_service import send_email

router = APIRouter(prefix="/api/mail", tags=["mail-engine"])


# ── Config CRUD ────────────────────────────────────────────

@router.get("/configs", response_model=list[MailConfigResponse])
async def list_mail_configs(
    case_type_id: Optional[str] = Query(None),
):
    db = get_db()
    query = {}
    if case_type_id:
        query["case_type_id"] = case_type_id

    docs = await db.mail_configs.find(query).sort("created_at", -1).to_list(length=200)

    # Hydrate case type names
    ct_ids = list({d.get("case_type_id") for d in docs if d.get("case_type_id")})
    ct_map = {}
    if ct_ids:
        async for ct in db.case_type_definitions.find(
            {"_id": {"$in": ct_ids}}, {"name": 1}
        ):
            ct_map[ct["_id"]] = ct.get("name", "")

    return [_config_to_response(d, ct_map) for d in docs]


@router.get("/configs/by-case-type/{case_type_id}", response_model=list[MailConfigResponse])
async def get_configs_for_case_type(case_type_id: str):
    db = get_db()
    docs = await db.mail_configs.find({"case_type_id": case_type_id}).to_list(length=50)

    ct = await db.case_type_definitions.find_one({"_id": case_type_id}, {"name": 1})
    ct_map = {case_type_id: ct.get("name", "")} if ct else {}

    return [_config_to_response(d, ct_map) for d in docs]


@router.post("/configs", response_model=MailConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_mail_config(body: MailConfigCreate):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "_id": str(ObjectId()),
        "case_type_id": body.case_type_id,
        "event": body.event.value,
        "enabled": body.enabled,
        "recipient_type": body.recipient_type.value,
        "custom_emails": body.custom_emails,
        "subject_template": body.subject_template,
        "template_override": body.template_override,
        "created_at": now,
        "updated_at": now,
    }
    await db.mail_configs.insert_one(doc)

    ct = await db.case_type_definitions.find_one({"_id": body.case_type_id}, {"name": 1})
    ct_map = {body.case_type_id: ct.get("name", "")} if ct else {}

    return _config_to_response(doc, ct_map)


@router.patch("/configs/{config_id}", response_model=MailConfigResponse)
async def update_mail_config(config_id: str, body: MailConfigUpdate):
    db = get_db()
    existing = await db.mail_configs.find_one({"_id": config_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Mail config not found")

    updates = {}
    if body.enabled is not None:
        updates["enabled"] = body.enabled
    if body.recipient_type is not None:
        updates["recipient_type"] = body.recipient_type.value
    if body.custom_emails is not None:
        updates["custom_emails"] = body.custom_emails
    if body.subject_template is not None:
        updates["subject_template"] = body.subject_template
    if body.template_override is not None:
        updates["template_override"] = body.template_override

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.mail_configs.update_one({"_id": config_id}, {"$set": updates})

    doc = await db.mail_configs.find_one({"_id": config_id})
    ct = await db.case_type_definitions.find_one(
        {"_id": doc.get("case_type_id")}, {"name": 1}
    )
    ct_map = {doc["case_type_id"]: ct.get("name", "")} if ct else {}

    return _config_to_response(doc, ct_map)


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mail_config(config_id: str):
    db = get_db()
    result = await db.mail_configs.delete_one({"_id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mail config not found")


# ── Mail Logs ──────────────────────────────────────────────

@router.get("/logs", response_model=list[MailLogResponse])
async def list_mail_logs(
    case_type_id: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    event: Optional[str] = Query(None),
    mail_status: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=500),
):
    db = get_db()
    query = {}
    if case_type_id:
        query["case_type_id"] = case_type_id
    if case_id:
        query["case_id"] = case_id
    if event:
        query["event"] = event
    if mail_status:
        query["status"] = mail_status

    docs = await db.mail_logs.find(query).sort("sent_at", -1).to_list(length=limit)
    return [_log_to_response(d) for d in docs]


# ── Test Email ─────────────────────────────────────────────

@router.post("/test")
async def send_test_email(body: MailTestRequest):
    settings = get_mail_settings()
    if not settings.mail_enabled:
        raise HTTPException(status_code=400, detail="Mail is disabled. Set MAIL_ENABLED=true")

    html_body = f"""
    <html><body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>Test Email</h2>
    <p>{body.body}</p>
    <hr>
    <p style="color: #999; font-size: 12px;">
      Sent from Workflow Platform Mail Engine at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
    </p>
    </body></html>
    """
    result = await send_email([body.to_email], body.subject, html_body)

    if result["success"]:
        return {"success": True, "message": f"Test email sent to {body.to_email}"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send: {result['error']}")


# ── Templates & Settings ──────────────────────────────────

@router.get("/templates")
async def get_available_templates():
    return {"templates": list_templates()}


@router.get("/settings")
async def get_mail_settings_view():
    settings = get_mail_settings()
    return {
        "mail_enabled": settings.mail_enabled,
        "smtp_host": settings.mail_smtp_host,
        "smtp_port": settings.mail_smtp_port,
        "smtp_user": settings.mail_smtp_user,
        "from_address": settings.mail_from_address,
        "from_name": settings.mail_from_name,
        "log_enabled": settings.mail_log_enabled,
        "configured": bool(settings.mail_smtp_user and settings.mail_smtp_password),
    }


# ── Helpers ────────────────────────────────────────────────

def _config_to_response(doc: dict, ct_map: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "case_type_id": doc.get("case_type_id", ""),
        "case_type_name": ct_map.get(doc.get("case_type_id", ""), ""),
        "event": doc.get("event", ""),
        "enabled": doc.get("enabled", True),
        "recipient_type": doc.get("recipient_type", "owner"),
        "custom_emails": doc.get("custom_emails", []),
        "subject_template": doc.get("subject_template", ""),
        "template_override": doc.get("template_override"),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


def _log_to_response(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "case_id": doc.get("case_id", ""),
        "case_type_id": doc.get("case_type_id", ""),
        "event": doc.get("event", ""),
        "recipients": doc.get("recipients", []),
        "subject": doc.get("subject", ""),
        "status": doc.get("status", ""),
        "error": doc.get("error"),
        "sent_at": doc.get("sent_at", ""),
    }
