"""Workflow CRUD, validation, and import/export routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone

from auth_deps import get_current_user, require_roles
from database import get_db
from id_utils import find_by_id, update_by_id, delete_by_id
from models.workflows import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse,
    WorkflowDefinition, WorkflowValidationResponse, ValidationError as ValError,
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _to_response(doc: dict) -> WorkflowResponse:
    return WorkflowResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        description=doc.get("description", ""),
        case_type=doc.get("case_type") or doc.get("case_type_id"),
        definition=WorkflowDefinition(**doc.get("definition", {})),
        version=doc.get("version", 1),
        is_active=doc.get("is_active", True),
        created_by=doc.get("created_by", ""),
        created_at=doc["created_at"],
        updated_at=doc.get("updated_at", doc.get("created_at", "")),
    )


def _validate_definition(definition: WorkflowDefinition) -> list[ValError]:
    """Validate a workflow definition for correctness."""
    errors: list[ValError] = []
    node_ids = {n.id for n in definition.nodes}

    # Must have at least one start and one end node
    start_nodes = [n for n in definition.nodes if n.type == "start"]
    end_nodes = [n for n in definition.nodes if n.type == "end"]

    if len(start_nodes) == 0:
        errors.append(ValError(type="missing_start", message="Workflow must have at least one Start node"))
    if len(start_nodes) > 1:
        errors.append(ValError(type="multiple_starts", message="Workflow should have only one Start node"))
    if len(end_nodes) == 0:
        errors.append(ValError(type="missing_end", message="Workflow must have at least one End node"))

    # Validate edge references
    for edge in definition.edges:
        if edge.source not in node_ids:
            errors.append(ValError(
                type="invalid_edge_source",
                message=f"Edge '{edge.id}' references non-existent source node '{edge.source}'",
                node_id=edge.source,
            ))
        if edge.target not in node_ids:
            errors.append(ValError(
                type="invalid_edge_target",
                message=f"Edge '{edge.id}' references non-existent target node '{edge.target}'",
                node_id=edge.target,
            ))

    # Check for unreachable nodes (nodes with no incoming edges, except start)
    targets = {e.target for e in definition.edges}
    sources = {e.source for e in definition.edges}
    for node in definition.nodes:
        if node.type != "start" and node.id not in targets:
            errors.append(ValError(
                type="unreachable_node",
                message=f"Node '{node.label}' has no incoming edges and is unreachable",
                node_id=node.id,
            ))
        if node.type != "end" and node.id not in sources:
            errors.append(ValError(
                type="dead_end_node",
                message=f"Node '{node.label}' has no outgoing edges (dead end)",
                node_id=node.id,
            ))

    # Decision nodes should have at least 2 outgoing edges
    for node in definition.nodes:
        if node.type == "decision":
            outgoing = [e for e in definition.edges if e.source == node.id]
            if len(outgoing) < 2:
                errors.append(ValError(
                    type="decision_needs_branches",
                    message=f"Decision node '{node.label}' should have at least 2 outgoing branches",
                    node_id=node.id,
                ))

    return errors


# ---------- CRUD ----------

@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkflowResponse)
async def create_workflow(body: WorkflowCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": body.name,
        "description": body.description,
        "case_type": body.case_type,
        "definition": body.definition.model_dump(),
        "version": 1,
        "is_active": True,
        "created_by": str(user["_id"]),
        "created_at": now,
        "updated_at": now,
    }
    result = await db.workflows.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(
    case_type: str | None = None,
    is_active: bool | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if case_type:
        query["case_type"] = case_type
    if is_active is not None:
        query["is_active"] = is_active
    cursor = db.workflows.find(query).sort("updated_at", -1)
    return [_to_response(doc) async for doc in cursor]


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.workflows, workflow_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")
    return _to_response(doc)


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await find_by_id(db.workflows, workflow_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")

    updates: dict = {}
    for field_name, value in body.model_dump(exclude_none=True).items():
        if field_name == "definition" and value is not None:
            updates["definition"] = value
        else:
            updates[field_name] = value

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["version"] = doc.get("version", 1) + 1

    await update_by_id(db.workflows, workflow_id, {"$set": updates})
    updated = await find_by_id(db.workflows, workflow_id)
    return _to_response(updated)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    user: dict = Depends(require_roles("ADMIN", "MANAGER")),
):
    db = get_db()
    result = await delete_by_id(db.workflows, workflow_id)
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")


# ---------- Validation ----------

@router.post("/{workflow_id}/validate", response_model=WorkflowValidationResponse)
async def validate_workflow(workflow_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.workflows, workflow_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")

    definition = WorkflowDefinition(**doc.get("definition", {}))
    errors = _validate_definition(definition)
    return WorkflowValidationResponse(valid=len(errors) == 0, errors=errors)


@router.post("/validate", response_model=WorkflowValidationResponse)
async def validate_workflow_inline(
    body: WorkflowDefinition,
    user: dict = Depends(get_current_user),
):
    errors = _validate_definition(body)
    return WorkflowValidationResponse(valid=len(errors) == 0, errors=errors)


# ---------- Export / Import ----------

@router.get("/{workflow_id}/export")
async def export_workflow(workflow_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.workflows, workflow_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")
    return {
        "name": doc["name"],
        "description": doc.get("description", ""),
        "case_type": doc.get("case_type"),
        "definition": doc.get("definition", {}),
    }


@router.post("/import", status_code=status.HTTP_201_CREATED, response_model=WorkflowResponse)
async def import_workflow(body: WorkflowCreate, user: dict = Depends(get_current_user)):
    return await create_workflow(body, user)
