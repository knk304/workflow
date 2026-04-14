"""
Mail Engine — Recipient resolver.

Resolves recipient_type + case context → list of email addresses.
Looks up users and teams collections in MongoDB.
"""

import logging

logger = logging.getLogger("mail_engine.recipient_resolver")


async def resolve_recipients(
    recipient_type: str,
    custom_emails: list[str],
    case: dict,
    step: dict | None,
    db,
) -> list[str]:
    """
    Resolve email addresses based on recipient_type.

    recipient_type:
        owner     → case owner's email
        assignee  → step's assigned_to user email
        team_dl   → team's dl_email field, or fallback to all member emails
        custom    → custom_emails list as-is
    """
    emails: list[str] = []

    if recipient_type == "owner":
        owner_id = case.get("owner_id")
        if owner_id:
            email = await _get_user_email(owner_id, db)
            if email:
                emails.append(email)

    elif recipient_type == "assignee":
        assigned_to = None
        if step:
            assigned_to = step.get("assigned_to") or step.get("assignee_user_id")
        if not assigned_to:
            # Fallback: look up latest assignment for this case
            assignment = await db.assignments.find_one(
                {"case_id": case["_id"], "status": {"$in": ["open", "in_progress"]}},
                sort=[("created_at", -1)],
            )
            if assignment:
                assigned_to = assignment.get("assigned_to")
        if assigned_to:
            email = await _get_user_email(assigned_to, db)
            if email:
                emails.append(email)

    elif recipient_type == "team_dl":
        team_id = case.get("team_id")
        if team_id:
            team = await db.teams.find_one({"_id": team_id})
            if team:
                dl_email = team.get("dl_email")
                if dl_email:
                    emails.append(dl_email)
                else:
                    # Fallback: email all team members
                    member_ids = team.get("member_ids", [])
                    for mid in member_ids:
                        email = await _get_user_email(mid, db)
                        if email:
                            emails.append(email)

    elif recipient_type == "custom":
        emails.extend(custom_emails)

    # Deduplicate, preserve order
    seen = set()
    unique = []
    for e in emails:
        if e and e not in seen:
            seen.add(e)
            unique.append(e)

    return unique


async def _get_user_email(user_id: str, db) -> str | None:
    """Look up a user's email by _id."""
    user = await db.users.find_one({"_id": user_id}, {"email": 1})
    if user:
        return user.get("email")
    return None
