"""
Mail Engine — Seed data for mail_configs collection.

Creates sample mail configurations for existing case types.
Can run standalone: python seed_mail_configs.py
Or imported by seed.py: from seed_mail_configs import seed_mail_configs
"""

import asyncio
from datetime import datetime, timezone
from bson import ObjectId


MAIL_CONFIG_SEEDS = [
    # ── Loan Origination (ct-loan) ──────────────────
    {
        "_id": "mc-loan-created",
        "case_type_id": "ct-loan",
        "event": "case_created",
        "enabled": True,
        "recipient_type": "owner",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] New Loan Case Created — {{case_title}}",
        "template_override": None,
    },
    {
        "_id": "mc-loan-created-team",
        "case_type_id": "ct-loan",
        "event": "case_created",
        "enabled": True,
        "recipient_type": "team_dl",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] New Loan Case Created — {{case_title}}",
        "template_override": None,
    },
    {
        "_id": "mc-loan-assigned",
        "case_type_id": "ct-loan",
        "event": "step_assigned",
        "enabled": True,
        "recipient_type": "assignee",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] You have been assigned — {{step_name}}",
        "template_override": None,
    },
    {
        "_id": "mc-loan-status",
        "case_type_id": "ct-loan",
        "event": "case_status_changed",
        "enabled": True,
        "recipient_type": "owner",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] Status Updated — {{new_status}}",
        "template_override": None,
    },
    {
        "_id": "mc-loan-resolved",
        "case_type_id": "ct-loan",
        "event": "case_resolved",
        "enabled": True,
        "recipient_type": "owner",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] Case Resolved — {{resolution_status}}",
        "template_override": None,
    },
    {
        "_id": "mc-loan-step-done",
        "case_type_id": "ct-loan",
        "event": "step_completed",
        "enabled": True,
        "recipient_type": "owner",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] Step Completed — {{step_name}}",
        "template_override": None,
    },

    # ── KYC Onboarding (ct-kyc) ─────────────────────
    {
        "_id": "mc-kyc-created",
        "case_type_id": "ct-kyc",
        "event": "case_created",
        "enabled": True,
        "recipient_type": "owner",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] New KYC Case — {{case_title}}",
        "template_override": None,
    },
    {
        "_id": "mc-kyc-assigned",
        "case_type_id": "ct-kyc",
        "event": "step_assigned",
        "enabled": True,
        "recipient_type": "assignee",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] KYC Step Assigned — {{step_name}}",
        "template_override": None,
    },
    {
        "_id": "mc-kyc-resolved",
        "case_type_id": "ct-kyc",
        "event": "case_resolved",
        "enabled": True,
        "recipient_type": "team_dl",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] KYC Case Resolved — {{resolution_status}}",
        "template_override": None,
    },

    # ── Claims (ct-claims) ──────────────────────────
    {
        "_id": "mc-claims-created",
        "case_type_id": "ct-claims",
        "event": "case_created",
        "enabled": True,
        "recipient_type": "team_dl",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] New Claim Filed — {{case_title}}",
        "template_override": None,
    },
    {
        "_id": "mc-claims-assigned",
        "case_type_id": "ct-claims",
        "event": "step_assigned",
        "enabled": True,
        "recipient_type": "assignee",
        "custom_emails": [],
        "subject_template": "[{{case_id}}] Claim Step Assigned — {{step_name}}",
        "template_override": None,
    },

    # ── Custom email example (ct-cc-stolen) ─────────
    {
        "_id": "mc-cc-stolen-created",
        "case_type_id": "ct-cc-stolen",
        "event": "case_created",
        "enabled": True,
        "recipient_type": "custom",
        "custom_emails": ["fraud-team@example.com", "security@example.com"],
        "subject_template": "[URGENT] [{{case_id}}] Stolen Card Report — {{case_title}}",
        "template_override": None,
    },
]

# Sample mail logs for demo
MAIL_LOG_SEEDS = [
    {
        "_id": "ml-1",
        "case_id": "LOAN-001",
        "case_type_id": "ct-loan",
        "event": "case_created",
        "recipients": ["alice@example.com"],
        "subject": "[LOAN-001] New Loan Case Created — Home Loan Application",
        "status": "sent",
        "error": None,
        "sent_at": "2026-04-10T09:00:00.000Z",
    },
    {
        "_id": "ml-2",
        "case_id": "LOAN-001",
        "case_type_id": "ct-loan",
        "event": "step_assigned",
        "recipients": ["bob@example.com"],
        "subject": "[LOAN-001] You have been assigned — Document Upload",
        "status": "sent",
        "error": None,
        "sent_at": "2026-04-10T09:01:00.000Z",
    },
    {
        "_id": "ml-3",
        "case_id": "LOAN-002",
        "case_type_id": "ct-loan",
        "event": "case_status_changed",
        "recipients": ["alice@example.com"],
        "subject": "[LOAN-002] Status Updated — in_progress",
        "status": "sent",
        "error": None,
        "sent_at": "2026-04-11T14:30:00.000Z",
    },
    {
        "_id": "ml-4",
        "case_id": "KYC-001",
        "case_type_id": "ct-kyc",
        "event": "step_assigned",
        "recipients": ["carol@example.com"],
        "subject": "[KYC-001] KYC Step Assigned — Identity Verification",
        "status": "failed",
        "error": "SMTP connection timeout",
        "sent_at": "2026-04-12T10:15:00.000Z",
    },
    {
        "_id": "ml-5",
        "case_id": "CLM-001",
        "case_type_id": "ct-claims",
        "event": "case_created",
        "recipients": ["bob@example.com", "carol@example.com"],
        "subject": "[CLM-001] New Claim Filed — Vehicle Damage Claim",
        "status": "sent",
        "error": None,
        "sent_at": "2026-04-13T08:45:00.000Z",
    },
]


async def seed_mail_configs(db=None):
    """Seed mail_configs and mail_logs collections. Idempotent (upsert)."""
    if db is None:
        from database import connect_db, get_db
        await connect_db()
        db = get_db()

    now = datetime.now(timezone.utc).isoformat()

    # Seed mail configs
    for config in MAIL_CONFIG_SEEDS:
        doc = {**config, "created_at": now, "updated_at": now}
        await db.mail_configs.replace_one({"_id": config["_id"]}, doc, upsert=True)

    # Seed mail logs
    for log in MAIL_LOG_SEEDS:
        await db.mail_logs.replace_one({"_id": log["_id"]}, log, upsert=True)

    print(f"  ✓ mail_configs: {len(MAIL_CONFIG_SEEDS)} configs seeded")
    print(f"  ✓ mail_logs: {len(MAIL_LOG_SEEDS)} sample logs seeded")


# Allow standalone execution
if __name__ == "__main__":
    asyncio.run(seed_mail_configs())
