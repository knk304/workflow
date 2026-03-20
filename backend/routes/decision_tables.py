"""Decision table CRUD + evaluate endpoints."""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from database import get_db
from id_utils import to_query_id, find_by_id, update_by_id
from models.rules import (
    DecisionTableCreate,
    DecisionTableUpdate,
    DecisionTableResponse,
    DecisionTableEvaluateRequest,
    DecisionTableEvaluateResponse,
)
from engine.decision_tables import decision_table_engine, DecisionTableError

router = APIRouter(prefix="/api/decision-tables", tags=["decision-tables"])


def _to_response(doc: dict) -> dict:
    return DecisionTableResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc.get("description"),
        inputs=doc.get("inputs", []),
        output_field=doc.get("output_field", ""),
        rows=doc.get("rows", []),
        default_output=doc.get("default_output"),
        created_by=doc.get("created_by"),
        created_at=doc.get("created_at", ""),
        updated_at=doc.get("updated_at", ""),
        version=doc.get("version", 1),
    ).model_dump()


@router.get("")
async def list_decision_tables():
    db = get_db()
    cursor = db.decision_tables.find().sort("name", 1)
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


@router.get("/{table_id}")
async def get_decision_table(table_id: str):
    doc = await find_by_id(get_db().decision_tables, table_id)
    if not doc:
        raise HTTPException(404, "Decision table not found")
    return _to_response(doc)


@router.post("", status_code=201)
async def create_decision_table(body: DecisionTableCreate):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **body.model_dump(),
        "created_at": now,
        "updated_at": now,
        "version": 1,
    }
    result = await db.decision_tables.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.put("/{table_id}")
async def update_decision_table(table_id: str, body: DecisionTableUpdate):
    db = get_db()
    doc = await find_by_id(db.decision_tables, table_id)
    if not doc:
        raise HTTPException(404, "Decision table not found")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        return _to_response(doc)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["version"] = doc.get("version", 1) + 1
    await update_by_id(db.decision_tables, table_id, {"$set": updates})
    updated = await find_by_id(db.decision_tables, table_id)
    return _to_response(updated)


@router.delete("/{table_id}", status_code=204)
async def delete_decision_table(table_id: str):
    db = get_db()
    doc = await find_by_id(db.decision_tables, table_id)
    if not doc:
        raise HTTPException(404, "Decision table not found")
    await db.decision_tables.delete_one(to_query_id(table_id))
    return None


@router.post("/{table_id}/evaluate")
async def evaluate_decision_table(table_id: str, body: DecisionTableEvaluateRequest):
    """Evaluate a saved decision table against provided data."""
    db = get_db()
    doc = await find_by_id(db.decision_tables, table_id)
    if not doc:
        raise HTTPException(404, "Decision table not found")

    try:
        output, matched_row = decision_table_engine.evaluate(doc, body.data)
        all_matches = decision_table_engine.evaluate_all(doc, body.data)
    except DecisionTableError as e:
        raise HTTPException(400, str(e))

    return DecisionTableEvaluateResponse(
        output=output,
        matched_row=matched_row,
        all_matches=all_matches,
    ).model_dump()


@router.post("/evaluate-inline")
async def evaluate_inline(body: dict):
    """
    Evaluate a decision table definition inline (not saved).
    Body: { "table": { ... DecisionTableCreate fields ... }, "data": { ... } }
    """
    table = body.get("table")
    data = body.get("data")
    if not table or not isinstance(data, dict):
        raise HTTPException(400, "Body must contain 'table' and 'data' objects")

    try:
        output, matched_row = decision_table_engine.evaluate(table, data)
        all_matches = decision_table_engine.evaluate_all(table, data)
    except DecisionTableError as e:
        raise HTTPException(400, str(e))

    return DecisionTableEvaluateResponse(
        output=output,
        matched_row=matched_row,
        all_matches=all_matches,
    ).model_dump()
