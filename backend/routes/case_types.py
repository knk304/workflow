"""Case type routes — CRUD for case type management."""

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from auth_deps import get_current_user
from database import get_db
from models.cases import CaseTypeResponse, CaseTypeCreate, CaseTypeUpdate
from id_utils import find_by_id, update_by_id

router = APIRouter(prefix="/api/case-types", tags=["case-types"])


async def _build_response(db, doc: dict) -> CaseTypeResponse:
    """Build CaseTypeResponse, deriving stages/transitions from linked workflow if present."""
    stages = doc.get("stages", [])
    transitions = doc.get("transitions", [])
    workflow_id = doc.get("workflowId")

    # If linked to a workflow, derive stages from workflow task nodes
    stage_form_map: dict[str, str] = {}
    if workflow_id:
        wf_doc = await find_by_id(db.workflows, workflow_id)
        if wf_doc:
            definition = wf_doc.get("definition", {})
            nodes = definition.get("nodes", [])
            edges = definition.get("edges", [])
            # Extract task node labels as stages (in topological/positional order)
            task_nodes = [n for n in nodes if n.get("type") in ("task", "subprocess")]
            task_nodes.sort(key=lambda n: n.get("position", {}).get("x", 0))
            stages = [n["label"] for n in task_nodes]
            # Build stage → formId mapping (handle both camelCase and snake_case keys)
            for n in task_nodes:
                fid = n.get("formId") or n.get("form_id")
                if fid:
                    stage_form_map[n["label"]] = fid
            # Build transitions from edges between task nodes
            node_map = {n["id"]: n for n in nodes}
            derived_transitions = []
            for edge in edges:
                src = node_map.get(edge["source"], {})
                tgt = node_map.get(edge["target"], {})
                if src.get("type") in ("task", "subprocess", "start") and tgt.get("type") in ("task", "subprocess", "end"):
                    derived_transitions.append({
                        "from": src.get("label", src.get("id")),
                        "action": edge.get("label", f"to_{tgt.get('label', '').lower().replace(' ', '_')}"),
                        "to": tgt.get("label", tgt.get("id")),
                    })
            if derived_transitions:
                transitions = derived_transitions

    return CaseTypeResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        slug=doc.get("slug", ""),
        description=doc.get("description", ""),
        stages=stages,
        transitions=transitions,
        fieldsSchema=doc.get("fieldsSchema", {}),
        workflowId=workflow_id,
        stageFormMap=stage_form_map,
    )


@router.get("", response_model=list[CaseTypeResponse])
async def list_case_types(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.case_types.find()
    results = []
    async for doc in cursor:
        results.append(await _build_response(db, doc))
    return results


@router.get("/{case_type_id}", response_model=CaseTypeResponse)
async def get_case_type(case_type_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.case_types, case_type_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case type not found")
    return await _build_response(db, doc)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CaseTypeResponse)
async def create_case_type(body: CaseTypeCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    # Check slug uniqueness
    existing = await db.case_types.find_one({"slug": body.slug})
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Case type with this slug already exists")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": body.name,
        "slug": body.slug,
        "description": body.description,
        "workflowId": body.workflowId,
        "stages": [],
        "transitions": [],
        "fieldsSchema": body.fieldsSchema,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.case_types.insert_one(doc)
    doc["_id"] = result.inserted_id
    return await _build_response(db, doc)


@router.patch("/{case_type_id}", response_model=CaseTypeResponse)
async def update_case_type(case_type_id: str, body: CaseTypeUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.case_types, case_type_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case type not found")

    update: dict = {"updatedAt": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        update["name"] = body.name
    if body.slug is not None:
        # Check slug uniqueness (skip self)
        existing = await db.case_types.find_one({"slug": body.slug})
        if existing and str(existing["_id"]) != case_type_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Slug already in use")
        update["slug"] = body.slug
    if body.description is not None:
        update["description"] = body.description
    if body.workflowId is not None:
        update["workflowId"] = body.workflowId
    if body.fieldsSchema is not None:
        update["fieldsSchema"] = body.fieldsSchema

    await update_by_id(db.case_types, case_type_id, {"$set": update})
    doc.update(update)
    return await _build_response(db, doc)


@router.delete("/{case_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case_type(case_type_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.case_types, case_type_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case type not found")
    await db.case_types.delete_one({"_id": doc["_id"]})
    return None
