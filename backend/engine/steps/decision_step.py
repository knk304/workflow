"""Decision step handler — fully automatic, evaluates conditions and branches."""

from engine.rule_engine import rule_engine
from engine.decision_tables import decision_table_engine


async def activate(case: dict, stage_id: str, process_id: str,
                   step: dict, case_type_def: dict, db) -> dict:
    """
    Evaluate decision branches against case data.
    Returns {"next_step_id": ...} to tell the step engine where to jump.
    """
    config = step.get("config", {})
    mode = config.get("mode", "first_match")
    data = case.get("custom_fields", {})

    next_step_id = None
    branch_label = None

    if mode == "decision_table" and config.get("decision_table_id"):
        table = await db.decision_tables.find_one({"_id": config["decision_table_id"]})
        if table:
            output, _ = decision_table_engine.evaluate(table, data)
            next_step_id = output  # output is expected to be a step_id
            branch_label = f"decision_table:{output}"
    else:
        # first_match mode: evaluate branches in order
        for branch in config.get("branches", []):
            condition = branch.get("condition", {})
            if not condition or rule_engine.evaluate(condition, data):
                next_step_id = branch.get("next_step_id")
                branch_label = branch.get("label", branch.get("id"))
                break

    if not next_step_id:
        next_step_id = config.get("default_step_id")
        branch_label = "default"

    return {
        "auto_complete": True,
        "next_step_id": next_step_id,
        "decision_branch_taken": branch_label,
    }


async def complete(case: dict, stage_id: str, process_id: str,
                   step: dict, data: dict, user: dict, db) -> dict:
    """Decision steps auto-complete during activation — no manual completion."""
    return {}
