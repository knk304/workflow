"""Case-level activities — thin wrappers around the existing engine functions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from temporalio import activity

from database import get_db


@dataclass
class GetCaseParams:
    case_id: str


@dataclass
class ResolveCaseParams:
    case_id: str
    resolution_status: str  # "resolved" | "rejected" | "withdrawn"
    resolved_by: str


@dataclass
class AdvanceStageParams:
    case_id: str
    target_stage_id: str | None = None  # None = advance to next primary stage


# ── Read ─────────────────────────────────────────────────────────────

@activity.defn
async def get_case_activity(params: GetCaseParams) -> dict | None:
    db = get_db()
    doc = await db.cases.find_one({"_id": params.case_id})
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


@activity.defn
async def get_case_type_activity(case_type_id: str) -> dict | None:
    db = get_db()
    doc = await db.case_type_definitions.find_one({"_id": case_type_id})
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ── Stage advance ────────────────────────────────────────────────────

@activity.defn
async def advance_stage_activity(params: AdvanceStageParams) -> dict:
    """Advance a case to the next primary stage using the existing lifecycle engine."""
    from engine.lifecycle import _get_next_primary_stage, _enter_stage

    db = get_db()
    case = await db.cases.find_one({"_id": params.case_id})
    if not case:
        raise ValueError(f"Case {params.case_id} not found")

    stages = case.get("stages", [])

    if params.target_stage_id:
        target = next((s for s in stages if s["definition_id"] == params.target_stage_id), None)
    else:
        current_id = case.get("current_stage_id")
        target = _get_next_primary_stage(stages, current_id)

    if not target:
        return {"advanced": False, "reason": "no_next_stage"}

    await _enter_stage(params.case_id, target, db)
    return {"advanced": True, "stage_id": target["definition_id"], "stage_name": target["name"]}


# ── Resolve ──────────────────────────────────────────────────────────

@activity.defn
async def resolve_case_activity(params: ResolveCaseParams) -> dict:
    """Mark a case as resolved/rejected."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.cases.update_one(
        {"_id": params.case_id},
        {"$set": {
            "status": "resolved",
            "resolution_status": params.resolution_status,
            "resolved_at": now,
            "updated_at": now,
        }}
    )
    from engine.audit_logger import log_case_resolved
    await log_case_resolved(db, params.case_id, params.resolution_status, params.resolved_by)
    return {"case_id": params.case_id, "resolution_status": params.resolution_status}
