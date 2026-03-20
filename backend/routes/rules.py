"""Rule evaluation and validation endpoints."""

from fastapi import APIRouter, HTTPException

from models.rules import RuleEvaluateRequest, RuleEvaluateResponse
from engine.rule_engine import rule_engine, RuleEngineError

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.post("/evaluate")
async def evaluate_rule(body: RuleEvaluateRequest):
    """Evaluate a condition against data. Useful for testing rules in the admin UI."""
    trace: list[str] = []
    try:
        result = rule_engine.evaluate(body.condition, body.data, trace=trace)
    except RuleEngineError as e:
        raise HTTPException(400, str(e))

    # Extract matched conditions from trace
    matched = [line for line in trace if "→ True" in line and "group" not in line and "short-circuit" not in line]

    return RuleEvaluateResponse(
        result=result,
        matched_conditions=matched,
        evaluation_path=trace,
    ).model_dump()


@router.post("/validate")
async def validate_rule(body: dict):
    """
    Validate a condition structure without evaluating.
    Returns { "valid": true/false, "errors": [...] }
    """
    condition = body.get("condition", {})
    errors = _validate_condition(condition)
    return {"valid": len(errors) == 0, "errors": errors}


def _validate_condition(condition: dict, path: str = "root") -> list[str]:
    errors: list[str] = []

    if not condition:
        return errors

    if "all" in condition:
        items = condition["all"]
        if not isinstance(items, list):
            errors.append(f"{path}.all must be a list")
        else:
            for i, item in enumerate(items):
                if not isinstance(item, dict):
                    errors.append(f"{path}.all[{i}] must be a dict")
                else:
                    errors.extend(_validate_condition(item, f"{path}.all[{i}]"))
        return errors

    if "any" in condition:
        items = condition["any"]
        if not isinstance(items, list):
            errors.append(f"{path}.any must be a list")
        else:
            for i, item in enumerate(items):
                if not isinstance(item, dict):
                    errors.append(f"{path}.any[{i}] must be a dict")
                else:
                    errors.extend(_validate_condition(item, f"{path}.any[{i}]"))
        return errors

    # Simple condition
    if "field" not in condition:
        errors.append(f"{path}: missing 'field'")
    if "operator" not in condition:
        errors.append(f"{path}: missing 'operator'")
    else:
        valid_ops = {
            "eq", "neq", "gt", "gte", "lt", "lte",
            "contains", "not_contains", "in", "not_in",
            "is_empty", "is_not_empty",
            "starts_with", "ends_with", "between", "matches",
        }
        if condition["operator"] not in valid_ops:
            errors.append(f"{path}: unknown operator '{condition['operator']}'")

        op = condition["operator"]
        if op == "between":
            val = condition.get("value")
            if not isinstance(val, list) or len(val) != 2:
                errors.append(f"{path}: 'between' requires value as [min, max]")
        if op in ("in", "not_in"):
            val = condition.get("value")
            if not isinstance(val, list):
                errors.append(f"{path}: '{op}' requires value as a list")

    return errors
