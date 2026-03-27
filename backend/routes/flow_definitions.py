"""Flow Definition CRUD + Flow Execution routes.

Independent from /api/workflows — this powers questionnaire flows.
Collections: flow_definitions, flow_executions
"""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone

from auth_deps import get_current_user

logger = logging.getLogger(__name__)


def _indent(text: str, prefix: str) -> str:
    return "\n".join(prefix + line for line in text.splitlines())
from database import get_db
from id_utils import find_by_id, update_by_id, delete_by_id
from models.flow_definitions import (
    FlowDefinitionCreate, FlowDefinitionUpdate, FlowDefinitionResponse,
    FlowDefinitionBody, FlowNode,
    FlowExecutionCreate, FlowExecutionUpdate, FlowExecutionResponse,
    FlowExecutionStatus, FlowAnswer,
)

router = APIRouter(prefix="/api/flow-definitions", tags=["flow-definitions"])


# ─── Helpers ───────────────────────────────────────

def _to_def_response(doc: dict) -> dict:
    defn = doc.get("definition", {})
    body = FlowDefinitionBody(**defn)
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "description": doc.get("description", ""),
        "category": doc.get("category", ""),
        "definition": body.model_dump(by_alias=True, mode="json"),
        "version": doc.get("version", 1),
        "isActive": doc.get("is_active", True),
        "createdBy": doc.get("created_by", ""),
        "createdAt": doc.get("created_at", ""),
        "updatedAt": doc.get("updated_at", doc.get("created_at", "")),
    }


def _to_exec_response(doc: dict, flow_name: str = "") -> dict:
    answers = doc.get("answers", [])
    parsed_answers = []
    for a in answers:
        parsed_answers.append({
            "nodeId": a.get("node_id") or a.get("nodeId", ""),
            "fieldId": a.get("field_id") or a.get("fieldId", ""),
            "value": a.get("value"),
        })
    return {
        "id": str(doc["_id"]),
        "flowDefinitionId": doc.get("flow_definition_id", ""),
        "flowName": flow_name or doc.get("flow_name", ""),
        "currentNodeId": doc.get("current_node_id", ""),
        "visitedNodes": doc.get("visited_nodes", []),
        "answers": parsed_answers,
        "status": doc.get("status", "in_progress"),
        "startedBy": doc.get("started_by", ""),
        "startedAt": doc.get("started_at", ""),
        "completedAt": doc.get("completed_at"),
    }


def _find_start_node(definition: FlowDefinitionBody) -> str | None:
    for node in definition.nodes:
        if node.type == "start":
            return node.id
    return None


def _evaluate_decision(node: FlowNode, answers: list[dict]) -> str | None:
    """Evaluate decision conditions against current answers to determine next node."""
    answer_map: dict[str, dict[str, object]] = {}
    for a in answers:
        nid = a.get("node_id") or a.get("nodeId", "")
        fid = a.get("field_id") or a.get("fieldId", "")
        answer_map.setdefault(nid, {})[fid] = a.get("value")

    for cond in node.conditions:
        field_id = cond.field_id
        # Search across all nodes for the field value

        val = None
        for nid_answers in answer_map.values():
            if field_id in nid_answers:
                val = nid_answers[field_id]
                break

        if val is None:
            continue

        op = cond.operator
        expected = cond.value

        matched = False
        if op == "equals":
            matched = str(val) == str(expected)
        elif op == "not_equals":
            matched = str(val) != str(expected)
        elif op == "contains":
            matched = str(expected).lower() in str(val).lower()
        elif op == "gt":
            try:
                matched = float(val) > float(expected)
            except (ValueError, TypeError):
                pass
        elif op == "lt":
            try:
                matched = float(val) < float(expected)
            except (ValueError, TypeError):
                pass
        elif op == "gte":
            try:
                matched = float(val) >= float(expected)
            except (ValueError, TypeError):
                pass
        elif op == "lte":
            try:
                matched = float(val) <= float(expected)
            except (ValueError, TypeError):
                pass
        elif op == "in":
            if isinstance(expected, list):
                matched = str(val) in [str(e) for e in expected]
            else:
                matched = str(val) == str(expected)

        if matched:
            return cond.target_node_id

    return node.default_target


async def _execute_api_call(node: FlowNode, existing_answers: list[dict]) -> dict:
    """Execute the HTTP request configured on an api_call node.

    Returns a dict with status_code, body (parsed JSON or text),
    and any mapped response variables.
    """
    cfg = node.config
    method = (cfg.get("apiMethod") or "GET").upper()
    url = cfg.get("apiUrl") or ""
    if not url:
        return {"error": "No API URL configured", "status_code": 0}

    # Build answer lookup for template substitution
    answer_map: dict[str, str] = {}
    for a in existing_answers:
        nid = a.get("node_id") or a.get("nodeId", "")
        fid = a.get("field_id") or a.get("fieldId", "")
        answer_map[f"{nid}::{fid}"] = str(a.get("value", ""))
        # Also store by field id only for convenience
        answer_map[fid] = str(a.get("value", ""))

    def _substitute(text: str) -> str:
        """Replace {{fieldId}} placeholders with answer values."""
        import re
        def _replacer(m: re.Match) -> str:
            key = m.group(1).strip()
            return answer_map.get(key, m.group(0))
        return re.sub(r"\{\{(.+?)\}\}", _replacer, text)

    url = _substitute(url)

    # Headers
    headers: dict[str, str] = {}
    for h in cfg.get("apiHeaders") or []:
        key = h.get("key", "")
        val = _substitute(h.get("value", ""))
        if key:
            headers[key] = val

    # Body
    body_raw = cfg.get("apiBody") or ""
    body_text = _substitute(body_raw) if body_raw else None

    timeout = float(cfg.get("apiTimeout") or 30)

    result: dict = {"method": method, "url": url}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.request(
                method=method,
                url=url,
                headers=headers,
                content=body_text.encode("utf-8") if body_text else None,
            )
        result["status_code"] = resp.status_code
        try:
            result["body"] = resp.json()
        except Exception:
            result["body"] = resp.text[:4000]
    except httpx.TimeoutException:
        result["status_code"] = 0
        result["error"] = "Request timed out"
    except httpx.RequestError as exc:
        result["status_code"] = 0
        result["error"] = str(exc)[:500]

    import json as _json
    sep = "─" * 60
    print(f"\n{sep}")
    print(f"[API CALL] node={node.id}  {method} {url}")
    print(f"  Status : {result.get('status_code', 'N/A')}")
    if headers:
        print("  Headers sent:")
        for k, v in headers.items():
            print(f"    {k}: {v}")
    if body_text:
        print(f"  Request body:\n    {body_text}")
    if result.get("error"):
        print(f"  ERROR: {result['error']}")
    else:
        body = result.get("body")
        body_str = _json.dumps(body, indent=2) if isinstance(body, (dict, list)) else str(body)
        print(f"  Response body:\n{_indent(body_str, '    ')}")
    print(sep)
    logger.info("api_call node=%s method=%s url=%s status=%s",
                node.id, method, url, result.get("status_code"))

    # Apply response mappings  →  stored as synthetic answers
    mapped_answers: list[dict] = []
    for mapping in cfg.get("apiResponseMappings") or []:
        expr = mapping.get("expression", "")
        var_name = mapping.get("variableName", "")
        if not var_name:
            continue
        # Simple dot-path extraction from JSON body
        value = result.get("body")
        if isinstance(value, dict) and expr:
            for part in expr.strip().split("."):
                if isinstance(value, dict):
                    value = value.get(part)
                else:
                    value = None
                    break
        mapped_answers.append({
            "nodeId": node.id,
            "fieldId": var_name,
            "value": value,
        })

    result["mapped_answers"] = mapped_answers
    return result


# ─── Flow Definition CRUD ─────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_flow_definition(body: FlowDefinitionCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": body.name,
        "description": body.description,
        "category": body.category,
        "definition": body.definition.model_dump(by_alias=True),
        "version": 1,
        "is_active": True,
        "created_by": str(user["_id"]),
        "created_at": now,
        "updated_at": now,
    }
    result = await db.flow_definitions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_def_response(doc)


@router.get("")
async def list_flow_definitions(
    category: str | None = None,
    is_active: bool | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active
    cursor = db.flow_definitions.find(query).sort("updated_at", -1)
    return [_to_def_response(doc) async for doc in cursor]


@router.get("/{flow_id}")
async def get_flow_definition(flow_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.flow_definitions, flow_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow definition not found")
    return _to_def_response(doc)


@router.patch("/{flow_id}")
async def update_flow_definition(
    flow_id: str,
    body: FlowDefinitionUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await find_by_id(db.flow_definitions, flow_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow definition not found")

    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.description is not None:
        updates["description"] = body.description
    if body.category is not None:
        updates["category"] = body.category
    if body.definition is not None:
        updates["definition"] = body.definition.model_dump(by_alias=True, mode="json")
    if body.is_active is not None:
        updates["is_active"] = body.is_active

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["version"] = doc.get("version", 1) + 1

    await update_by_id(db.flow_definitions, flow_id, {"$set": updates})
    updated = await find_by_id(db.flow_definitions, flow_id)
    return _to_def_response(updated)


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow_definition(flow_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await delete_by_id(db.flow_definitions, flow_id)
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow definition not found")


# ─── Flow Execution (questionnaire runtime) ───────

exec_router = APIRouter(prefix="/api/flow-executions", tags=["flow-executions"])


@exec_router.post("", status_code=status.HTTP_201_CREATED)
async def start_flow_execution(body: FlowExecutionCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    flow_def = await find_by_id(db.flow_definitions, body.flow_definition_id)
    if not flow_def:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow definition not found")

    definition = FlowDefinitionBody(**flow_def.get("definition", {}))
    start_id = _find_start_node(definition)
    if not start_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Flow has no start node")

    # Find the first connected node from start
    first_node_id = start_id
    for edge in definition.edges:
        if edge.source == start_id:
            first_node_id = edge.target
            break

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "flow_definition_id": body.flow_definition_id,
        "flow_name": flow_def.get("name", ""),
        "current_node_id": first_node_id,
        "visited_nodes": [start_id, first_node_id],
        "answers": [],
        "status": "in_progress",
        "started_by": str(user["_id"]),
        "started_at": now,
        "completed_at": None,
    }
    result = await db.flow_executions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_exec_response(doc, flow_def.get("name", ""))


@exec_router.get("")
async def list_flow_executions(
    flow_definition_id: str | None = None,
    status_filter: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if flow_definition_id:
        query["flow_definition_id"] = flow_definition_id
    if status_filter:
        query["status"] = status_filter
    # Only show user's own executions unless admin
    if user.get("role") not in ("ADMIN", "MANAGER"):
        query["started_by"] = str(user["_id"])
    cursor = db.flow_executions.find(query).sort("started_at", -1)
    return [_to_exec_response(doc) async for doc in cursor]


@exec_router.get("/{exec_id}")
async def get_flow_execution(exec_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.flow_executions, exec_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow execution not found")
    return _to_exec_response(doc)


@exec_router.post("/{exec_id}/answer")
async def submit_answer_and_advance(
    exec_id: str,
    body: FlowExecutionUpdate,
    user: dict = Depends(get_current_user),
):
    """Submit answers for the current node and advance to next node."""
    db = get_db()
    exec_doc = await find_by_id(db.flow_executions, exec_id)
    if not exec_doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow execution not found")
    if exec_doc.get("status") != "in_progress":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Flow is not in progress")

    flow_def = await find_by_id(db.flow_definitions, exec_doc["flow_definition_id"])
    if not flow_def:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow definition not found")

    definition = FlowDefinitionBody(**flow_def.get("definition", {}))
    current_id = exec_doc["current_node_id"]

    # Merge new answers
    existing_answers = exec_doc.get("answers", [])
    if body.answers:
        for new_a in body.answers:
            new_a_dict = new_a.model_dump(by_alias=True)
            # Replace existing answer for same node+field
            found = False
            for i, ea in enumerate(existing_answers):
                ea_nid = ea.get("node_id") or ea.get("nodeId", "")
                ea_fid = ea.get("field_id") or ea.get("fieldId", "")
                if ea_nid == new_a.node_id and ea_fid == new_a.field_id:
                    existing_answers[i] = new_a_dict
                    found = True
                    break
            if not found:
                existing_answers.append(new_a_dict)

    # Determine next node
    node_map = {n.id: n for n in definition.nodes}
    current_node = node_map.get(current_id)
    next_node_id: str | None = None

    # ── Execute API callout when advancing FROM an api_call node ──
    if current_node and current_node.type == "api_call":
        api_result = await _execute_api_call(current_node, existing_answers)
        # Store the API response as a synthetic answer
        existing_answers.append({
            "nodeId": current_node.id,
            "fieldId": "__api_response__",
            "value": {
                "status_code": api_result.get("status_code"),
                "body": api_result.get("body"),
                "error": api_result.get("error"),
            },
        })
        # Merge mapped response variables into answers
        for ma in api_result.get("mapped_answers", []):
            existing_answers.append(ma)

    if current_node and current_node.type == "decision":
        next_node_id = _evaluate_decision(current_node, existing_answers)
    elif current_node and current_node.type == "end":
        # Already at end
        pass
    else:
        # Follow edges from current node
        for edge in definition.edges:
            if edge.source == current_id:
                target_node = node_map.get(edge.target)
                if target_node and target_node.type == "decision":
                    # Auto-evaluate decision
                    next_node_id = _evaluate_decision(target_node, existing_answers)
                    if next_node_id:
                        # Record we visited the decision node
                        visited = exec_doc.get("visited_nodes", [])
                        if edge.target not in visited:
                            visited.append(edge.target)
                        exec_doc["visited_nodes"] = visited
                    else:
                        next_node_id = edge.target
                else:
                    next_node_id = edge.target
                break

    if not next_node_id:
        next_node_id = current_id

    visited = exec_doc.get("visited_nodes", [])
    if next_node_id not in visited:
        visited.append(next_node_id)

    # ── Auto-advance through automatic api_call nodes ──
    target_node = node_map.get(next_node_id)
    if (target_node and target_node.type == "api_call"
            and target_node.config.get("apiMode") == "automatic"):
        # Execute the API call immediately
        api_result = await _execute_api_call(target_node, existing_answers)
        existing_answers.append({
            "nodeId": target_node.id,
            "fieldId": "__api_response__",
            "value": {
                "status_code": api_result.get("status_code"),
                "body": api_result.get("body"),
                "error": api_result.get("error"),
            },
        })
        for ma in api_result.get("mapped_answers", []):
            existing_answers.append(ma)
        # Advance past this api_call node
        for edge in definition.edges:
            if edge.source == next_node_id:
                if next_node_id not in visited:
                    visited.append(next_node_id)
                next_node_id = edge.target
                if next_node_id not in visited:
                    visited.append(next_node_id)
                break

    # Check completion
    is_end = False
    end_node = node_map.get(next_node_id)
    if end_node and end_node.type == "end":
        is_end = True

    updates = {
        "current_node_id": next_node_id,
        "visited_nodes": visited,
        "answers": existing_answers,
    }
    if is_end:
        updates["status"] = "completed"
        updates["completed_at"] = datetime.now(timezone.utc).isoformat()

    await update_by_id(db.flow_executions, exec_id, {"$set": updates})
    updated = await find_by_id(db.flow_executions, exec_id)
    return _to_exec_response(updated, flow_def.get("name", ""))


@exec_router.post("/{exec_id}/back")
async def go_back(exec_id: str, user: dict = Depends(get_current_user)):
    """Go back to previous node."""
    db = get_db()
    exec_doc = await find_by_id(db.flow_executions, exec_id)
    if not exec_doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flow execution not found")

    visited = exec_doc.get("visited_nodes", [])
    current = exec_doc.get("current_node_id")

    # Find previous non-decision node
    if len(visited) > 1 and current in visited:
        idx = visited.index(current)
        if idx > 0:
            prev_id = visited[idx - 1]
            # Skip decision nodes when going back
            flow_def = await find_by_id(db.flow_definitions, exec_doc["flow_definition_id"])
            if flow_def:
                definition = FlowDefinitionBody(**flow_def.get("definition", {}))
                node_map = {n.id: n for n in definition.nodes}
                while idx > 1 and node_map.get(prev_id, None) and node_map[prev_id].type in ("decision", "start"):
                    idx -= 1
                    prev_id = visited[idx - 1]

            await update_by_id(db.flow_executions, exec_id, {
                "$set": {"current_node_id": prev_id}
            })

    updated = await find_by_id(db.flow_executions, exec_id)
    return _to_exec_response(updated)
