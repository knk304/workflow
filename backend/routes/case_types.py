"""
Pega-Lite Case Type Definition routes — hierarchical CRUD per §8.1.

Endpoints:
  POST   /api/case-types                                          Create
  GET    /api/case-types                                          List
  GET    /api/case-types/{id}                                     Get with full hierarchy
  PATCH  /api/case-types/{id}                                     Update (bumps version)
  DELETE /api/case-types/{id}                                     Soft delete
  POST   /api/case-types/{id}/stages                              Add stage
  PATCH  /api/case-types/{id}/stages/{sid}                        Update stage
  DELETE /api/case-types/{id}/stages/{sid}                        Remove stage
  POST   /api/case-types/{id}/stages/{sid}/processes              Add process
  PATCH  /api/case-types/{id}/stages/{sid}/processes/{pid}        Update process
  DELETE /api/case-types/{id}/stages/{sid}/processes/{pid}        Remove process
  POST   /api/case-types/{id}/stages/{sid}/processes/{pid}/steps  Add step
  PATCH  /api/case-types/{id}/stages/{sid}/processes/{pid}/steps/{step_id}  Update step
  DELETE /api/case-types/{id}/stages/{sid}/processes/{pid}/steps/{step_id}  Remove step
  POST   /api/case-types/{id}/validate                            Validate definition
  POST   /api/case-types/{id}/duplicate                           Clone definition
"""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from copy import deepcopy

from auth_deps import get_current_user
from database import get_db
from models.case_types import (
    CaseTypeDefinitionCreate, CaseTypeDefinitionUpdate, CaseTypeDefinitionResponse,
    StageDefinition, ProcessDefinition, StepDefinition,
)

router = APIRouter(prefix="/api/case-types", tags=["case-types"])

COLL = "case_type_definitions"


# ── Helpers ────────────────────────────────────────────────

def _to_response(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "slug": doc.get("slug", ""),
        "description": doc.get("description"),
        "icon": doc.get("icon", "folder"),
        "prefix": doc.get("prefix", "CASE"),
        "field_schema": doc.get("field_schema", {}),
        "stages": doc.get("stages", []),
        "attachment_categories": doc.get("attachment_categories", []),
        "case_wide_actions": doc.get("case_wide_actions", []),
        "created_by": doc.get("created_by"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "version": doc.get("version", 1),
        "is_active": doc.get("is_active", True),
    }


def _find_stage(stages: list, stage_id: str) -> dict | None:
    for s in stages:
        if s.get("id") == stage_id:
            return s
    return None


def _find_process(stage: dict, process_id: str) -> dict | None:
    for p in stage.get("processes", []):
        if p.get("id") == process_id:
            return p
    return None


def _find_step(process: dict, step_id: str) -> dict | None:
    for st in process.get("steps", []):
        if st.get("id") == step_id:
            return st
    return None


async def _load_or_404(db, ct_id: str) -> dict:
    doc = await db[COLL].find_one({"_id": ct_id})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case type not found")
    return doc


async def _save_stages(db, ct_id: str, stages: list):
    now = datetime.now(timezone.utc).isoformat()
    await db[COLL].update_one(
        {"_id": ct_id},
        {"$set": {"stages": stages, "updated_at": now}, "$inc": {"version": 1}},
    )


# ── Top-level CRUD ─────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case_type(body: CaseTypeDefinitionCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db[COLL].find_one({"slug": body.slug})
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug already exists")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": body.slug,  # use slug as _id for readability
        "name": body.name,
        "slug": body.slug,
        "description": body.description,
        "icon": body.icon,
        "prefix": body.prefix,
        "field_schema": body.field_schema,
        "stages": [s.model_dump() for s in body.stages],
        "attachment_categories": [c.model_dump() for c in body.attachment_categories],
        "case_wide_actions": body.case_wide_actions,
        "created_by": str(user["_id"]),
        "created_at": now,
        "updated_at": now,
        "version": 1,
        "is_active": True,
    }
    await db[COLL].insert_one(doc)
    return _to_response(doc)


@router.get("")
async def list_case_types(
    is_active: bool | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if is_active is not None:
        query["is_active"] = is_active
    cursor = db[COLL].find(query).sort("name", 1)
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


@router.get("/{ct_id}")
async def get_case_type(ct_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    return _to_response(doc)


@router.patch("/{ct_id}")
async def update_case_type(ct_id: str, body: CaseTypeDefinitionUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_or_404(db, ct_id)

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field_name, value in body.model_dump(exclude_none=True).items():
        if field_name == "slug":
            existing = await db[COLL].find_one({"slug": value})
            if existing and str(existing["_id"]) != ct_id:
                raise HTTPException(status.HTTP_409_CONFLICT, "Slug already in use")
        if field_name == "stages":
            updates["stages"] = [s if isinstance(s, dict) else s.model_dump() for s in value]
        elif field_name == "attachment_categories":
            updates["attachment_categories"] = [c if isinstance(c, dict) else c.model_dump() for c in value]
        else:
            updates[field_name] = value

    await db[COLL].update_one({"_id": ct_id}, {"$set": updates, "$inc": {"version": 1}})
    updated = await db[COLL].find_one({"_id": ct_id})
    return _to_response(updated)


@router.delete("/{ct_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case_type(ct_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    await _load_or_404(db, ct_id)
    now = datetime.now(timezone.utc).isoformat()
    await db[COLL].update_one({"_id": ct_id}, {"$set": {"is_active": False, "updated_at": now}})
    return None


# ── Stage sub-resource ─────────────────────────────────────

@router.post("/{ct_id}/stages", status_code=status.HTTP_201_CREATED)
async def add_stage(ct_id: str, body: StageDefinition, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    if _find_stage(stages, body.id):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Stage '{body.id}' already exists")
    stages.append(body.model_dump())
    await _save_stages(db, ct_id, stages)
    return body.model_dump()


@router.patch("/{ct_id}/stages/{stage_id}")
async def update_stage(ct_id: str, stage_id: str, body: dict, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stage = _find_stage(stages, stage_id)
    if not stage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    stage.update(body)
    await _save_stages(db, ct_id, stages)
    return stage


@router.delete("/{ct_id}/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_stage(ct_id: str, stage_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stages = [s for s in stages if s.get("id") != stage_id]
    await _save_stages(db, ct_id, stages)
    return None


# ── Process sub-resource ───────────────────────────────────

@router.post("/{ct_id}/stages/{stage_id}/processes", status_code=status.HTTP_201_CREATED)
async def add_process(
    ct_id: str, stage_id: str, body: ProcessDefinition, user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stage = _find_stage(stages, stage_id)
    if not stage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    procs = stage.setdefault("processes", [])
    if _find_process(stage, body.id):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Process '{body.id}' already exists")
    procs.append(body.model_dump())
    await _save_stages(db, ct_id, stages)
    return body.model_dump()


@router.patch("/{ct_id}/stages/{stage_id}/processes/{process_id}")
async def update_process(
    ct_id: str, stage_id: str, process_id: str, body: dict,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stage = _find_stage(stages, stage_id)
    if not stage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    proc = _find_process(stage, process_id)
    if not proc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Process not found")
    proc.update(body)
    await _save_stages(db, ct_id, stages)
    return proc


@router.delete("/{ct_id}/stages/{stage_id}/processes/{process_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_process(
    ct_id: str, stage_id: str, process_id: str, user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stage = _find_stage(stages, stage_id)
    if not stage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    stage["processes"] = [p for p in stage.get("processes", []) if p.get("id") != process_id]
    await _save_stages(db, ct_id, stages)
    return None


# ── Step sub-resource ──────────────────────────────────────

@router.post("/{ct_id}/stages/{stage_id}/processes/{process_id}/steps", status_code=status.HTTP_201_CREATED)
async def add_step(
    ct_id: str, stage_id: str, process_id: str, body: StepDefinition,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stage = _find_stage(stages, stage_id)
    if not stage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    proc = _find_process(stage, process_id)
    if not proc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Process not found")
    steps = proc.setdefault("steps", [])
    if _find_step(proc, body.id):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Step '{body.id}' already exists")
    steps.append(body.model_dump())
    await _save_stages(db, ct_id, stages)
    return body.model_dump()


@router.patch("/{ct_id}/stages/{stage_id}/processes/{process_id}/steps/{step_id}")
async def update_step(
    ct_id: str, stage_id: str, process_id: str, step_id: str, body: dict,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stage = _find_stage(stages, stage_id)
    if not stage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    proc = _find_process(stage, process_id)
    if not proc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Process not found")
    step = _find_step(proc, step_id)
    if not step:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")
    step.update(body)
    await _save_stages(db, ct_id, stages)
    return step


@router.delete("/{ct_id}/stages/{stage_id}/processes/{process_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_step(
    ct_id: str, stage_id: str, process_id: str, step_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await _load_or_404(db, ct_id)
    stages = doc.get("stages", [])
    stage = _find_stage(stages, stage_id)
    if not stage:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    proc = _find_process(stage, process_id)
    if not proc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Process not found")
    proc["steps"] = [st for st in proc.get("steps", []) if st.get("id") != step_id]
    await _save_stages(db, ct_id, stages)
    return None


# ── Validate & Duplicate ──────────────────────────────────

@router.post("/{ct_id}/validate")
async def validate_case_type(ct_id: str, user: dict = Depends(get_current_user)):
    """Validate a case type definition for completeness."""
    db = get_db()
    doc = await _load_or_404(db, ct_id)

    errors: list[str] = []
    stages = doc.get("stages", [])
    if not stages:
        errors.append("No stages defined")
    else:
        primary_stages = [s for s in stages if s.get("stage_type") == "primary"]
        if not primary_stages:
            errors.append("No primary stages defined")

        # Check each stage has at least one process with steps
        for s in stages:
            processes = s.get("processes", [])
            if not processes:
                errors.append(f"Stage '{s.get('name', s.get('id'))}' has no processes")
            for p in processes:
                if not p.get("steps"):
                    errors.append(f"Process '{p.get('name', p.get('id'))}' in '{s.get('name')}' has no steps")

        # Check resolve stages have resolution_status
        for s in stages:
            if s.get("on_complete") == "resolve_case" and not s.get("resolution_status"):
                errors.append(f"Stage '{s.get('name')}' resolves case but has no resolution_status")

    valid = len(errors) == 0
    return {"valid": valid, "errors": errors}


@router.post("/{ct_id}/duplicate", status_code=status.HTTP_201_CREATED)
async def duplicate_case_type(ct_id: str, user: dict = Depends(get_current_user)):
    """Clone a case type definition."""
    db = get_db()
    doc = await _load_or_404(db, ct_id)

    now = datetime.now(timezone.utc).isoformat()
    new_slug = f"{doc['slug']}-copy-{int(datetime.now(timezone.utc).timestamp())}"
    new_doc = {
        "_id": new_slug,
        "name": f"{doc['name']} (Copy)",
        "slug": new_slug,
        "description": doc.get("description"),
        "icon": doc.get("icon", "folder"),
        "prefix": doc.get("prefix", "CASE"),
        "field_schema": deepcopy(doc.get("field_schema", {})),
        "stages": deepcopy(doc.get("stages", [])),
        "attachment_categories": deepcopy(doc.get("attachment_categories", [])),
        "case_wide_actions": list(doc.get("case_wide_actions", [])),
        "created_by": str(user["_id"]),
        "created_at": now,
        "updated_at": now,
        "version": 1,
        "is_active": True,
    }
    await db[COLL].insert_one(new_doc)
    return _to_response(new_doc)
