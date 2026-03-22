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
            # Apply field_mapping so decision table input names can differ
            # from case custom_field names, e.g. {"loan_amount": "f-amount"}
            eval_data = _map_fields(data, config.get("field_mapping"))
            output, _ = decision_table_engine.evaluate(table, eval_data)
            branch_label = f"decision_table:{output}"

            # Store result in case custom_fields using the table's output_field
            output_field = table.get("output_field", "decision_result")
            if output_field:
                from datetime import datetime, timezone
                await db.cases.update_one(
                    {"_id": case["_id"]},
                    {"$set": {
                        f"custom_fields.{output_field}": output,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )

            # If output_mapping is configured, translate output to a step ID.
            # Otherwise let the process flow naturally to the next step.
            output_mapping = config.get("output_mapping")
            if output_mapping and output in output_mapping:
                next_step_id = output_mapping[output]
            elif output_mapping:
                next_step_id = output_mapping.get("_default")
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


def _map_fields(data: dict, field_mapping: dict | None) -> dict:
    """
    Build evaluation data.  ``field_mapping`` maps decision-table input names
    to case custom_field names, e.g. {"loan_amount": "f-amount"}.
    Unmapped keys pass through from the original data.
    """
    if not field_mapping:
        return data
    mapped = dict(data)
    for table_key, case_key in field_mapping.items():
        if case_key in data:
            mapped[table_key] = data[case_key]
    return mapped
