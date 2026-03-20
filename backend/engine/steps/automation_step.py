"""Automation step handler — executes actions automatically, no human interaction."""

from datetime import datetime, timezone
from engine.rule_engine import rule_engine


async def activate(case: dict, stage_id: str, process_id: str,
                   step: dict, case_type_def: dict, db) -> dict:
    """Execute automation actions and auto-complete the step."""
    config = step.get("config", {})
    data = case.get("custom_fields", {})
    now = datetime.now(timezone.utc).isoformat()
    results = []

    # Execute direct actions
    for action in config.get("actions", []):
        result = await _execute_action(action, case, data, db, now)
        results.append(result)

    # Evaluate conditional rules
    for rule in config.get("rules", []):
        condition = rule.get("condition", {})
        if not condition or rule_engine.evaluate(condition, data):
            for action in rule.get("actions", []):
                result = await _execute_action(action, case, data, db, now)
                results.append(result)

    return {"auto_complete": True, "action_results": results}


async def _execute_action(action: dict, case: dict, data: dict, db, now: str) -> dict:
    """Execute a single automation action."""
    action_type = action.get("type", "")
    action_config = action.get("config", {})

    if action_type == "set_field":
        field = action_config.get("field", "")
        value = action_config.get("value")
        if field:
            data[field] = value
            await db.cases.update_one(
                {"_id": case["_id"]},
                {"$set": {f"custom_fields.{field}": value, "updated_at": now}}
            )
        return {"type": "set_field", "field": field, "value": value}

    elif action_type == "send_notification":
        notification = {
            "type": action_config.get("notification_type", "info"),
            "title": action_config.get("title", "Notification"),
            "message": action_config.get("message", ""),
            "userId": action_config.get("user_id") or case.get("owner_id"),
            "caseId": case["_id"],
            "read": False,
            "createdAt": now,
        }
        await db.notifications.insert_one(notification)
        return {"type": "send_notification", "title": notification["title"]}

    elif action_type == "change_stage":
        target_stage = action_config.get("target_stage_id")
        if target_stage:
            return {"type": "change_stage", "change_stage_to": target_stage}
        return {"type": "change_stage", "error": "no target_stage_id"}

    elif action_type == "evaluate_rules":
        # Nested rule evaluation (rules within rules)
        return {"type": "evaluate_rules", "note": "evaluated inline"}

    elif action_type == "call_webhook":
        # In production this would make an HTTP call — here we simulate
        return {"type": "call_webhook", "status": "simulated", "url": action_config.get("url", "")}

    return {"type": action_type, "status": "unknown_action"}


async def complete(case: dict, stage_id: str, process_id: str,
                   step: dict, data: dict, user: dict, db) -> dict:
    """Automation steps auto-complete during activation."""
    return {}
