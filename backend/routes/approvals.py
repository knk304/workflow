"""Approval chain routes — multi-level approvals with delegation."""

from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone

from auth_deps import get_current_user
from database import get_db
from id_utils import find_by_id, update_by_id, delete_by_id
from models.phase2 import (
    ApprovalChainCreate, ApprovalChainResponse, ApprovalDecision,
    ApprovalDelegation, Approver, ApprovalStatus, ApprovalMode,
    ApprovalRoutingRule, ApprovalRoutingRuleResponse, ApprovalRoutingCondition,
)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


def _to_response(doc: dict) -> ApprovalChainResponse:
    return ApprovalChainResponse(
        id=str(doc["_id"]),
        case_id=doc["case_id"],
        workflow_id=doc.get("workflow_id"),
        mode=doc.get("mode", "sequential"),
        approvers=[Approver(**a) for a in doc.get("approvers", [])],
        status=doc.get("status", "pending"),
        created_at=doc["created_at"],
        completed_at=doc.get("completed_at"),
    )


def _compute_chain_status(approvers: list[dict], mode: str) -> str:
    """Compute the overall approval chain status."""
    statuses = [a.get("status", "pending") for a in approvers]
    if any(s == "rejected" for s in statuses):
        return "rejected"
    if all(s == "approved" for s in statuses):
        return "approved"
    if mode == "parallel" and any(s == "approved" for s in statuses):
        return "in_progress"
    return "pending"


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApprovalChainResponse)
async def create_approval_chain(body: ApprovalChainCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "case_id": body.case_id,
        "workflow_id": body.workflow_id,
        "mode": body.mode.value,
        "approvers": [a.model_dump() for a in body.approvers],
        "status": "pending",
        "created_at": now,
        "completed_at": None,
    }
    result = await db.approval_chains.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Create notification for first approver (sequential) or all (parallel)
    if body.mode == ApprovalMode.sequential and body.approvers:
        await _notify_approver(db, body.approvers[0].user_id, body.case_id, str(result.inserted_id))
    elif body.mode == ApprovalMode.parallel:
        for approver in body.approvers:
            await _notify_approver(db, approver.user_id, body.case_id, str(result.inserted_id))

    return _to_response(doc)


@router.get("", response_model=list[ApprovalChainResponse])
async def list_approvals(
    case_id: str | None = None,
    status_filter: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if case_id:
        query["case_id"] = case_id
    if status_filter:
        query["status"] = status_filter
    cursor = db.approval_chains.find(query).sort("created_at", -1)
    return [_to_response(doc) async for doc in cursor]


@router.get("/{approval_id}", response_model=ApprovalChainResponse)
async def get_approval(approval_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.approval_chains, approval_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval chain not found")
    return _to_response(doc)


@router.post("/{approval_id}/approve", response_model=ApprovalChainResponse)
async def approve(approval_id: str, body: ApprovalDecision, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.approval_chains, approval_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval chain not found")

    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    approvers = doc.get("approvers", [])

    updated = False
    for a in approvers:
        target_id = a.get("delegated_to") or a["user_id"]
        if target_id == user_id and a["status"] == "pending":
            a["status"] = "approved"
            a["decision_at"] = now
            a["decision_notes"] = body.notes
            updated = True
            break

    if not updated:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not an active approver for this chain")

    chain_status = _compute_chain_status(approvers, doc.get("mode", "sequential"))
    completed_at = now if chain_status == "approved" else None

    # For sequential: notify next pending approver
    if doc.get("mode") == "sequential" and chain_status == "pending":
        for a in approvers:
            if a["status"] == "pending":
                await _notify_approver(db, a["user_id"], doc["case_id"], approval_id)
                break

    await update_by_id(db.approval_chains, approval_id,
        {"$set": {"approvers": approvers, "status": chain_status, "completed_at": completed_at}},
    )

    # Write audit log
    await db.audit_logs.insert_one({
        "entityType": "approval",
        "entityId": approval_id,
        "action": "approved",
        "actorId": user_id,
        "actorName": user.get("name", user.get("email", "")),
        "changes": {"case_id": doc["case_id"], "notes": body.notes},
        "timestamp": now,
    })

    updated_doc = await find_by_id(db.approval_chains, approval_id)
    return _to_response(updated_doc)


@router.post("/{approval_id}/reject", response_model=ApprovalChainResponse)
async def reject(approval_id: str, body: ApprovalDecision, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.approval_chains, approval_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval chain not found")

    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    approvers = doc.get("approvers", [])

    updated = False
    for a in approvers:
        target_id = a.get("delegated_to") or a["user_id"]
        if target_id == user_id and a["status"] == "pending":
            a["status"] = "rejected"
            a["decision_at"] = now
            a["decision_notes"] = body.notes
            updated = True
            break

    if not updated:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not an active approver for this chain")

    await update_by_id(db.approval_chains, approval_id,
        {"$set": {"approvers": approvers, "status": "rejected", "completed_at": now}},
    )

    await db.audit_logs.insert_one({
        "entityType": "approval",
        "entityId": approval_id,
        "action": "rejected",
        "actorId": user_id,
        "actorName": user.get("name", user.get("email", "")),
        "changes": {"case_id": doc["case_id"], "notes": body.notes},
        "timestamp": now,
    })

    updated_doc = await find_by_id(db.approval_chains, approval_id)
    return _to_response(updated_doc)


@router.post("/{approval_id}/delegate", response_model=ApprovalChainResponse)
async def delegate(approval_id: str, body: ApprovalDelegation, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.approval_chains, approval_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval chain not found")

    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    approvers = doc.get("approvers", [])

    updated = False
    for a in approvers:
        if a["user_id"] == user_id and a["status"] == "pending":
            a["status"] = "delegated"
            a["delegated_to"] = body.delegate_to
            a["decision_at"] = now
            a["decision_notes"] = body.notes
            updated = True
            break

    if not updated:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not an active approver for this chain")

    await update_by_id(db.approval_chains, approval_id,
        {"$set": {"approvers": approvers}},
    )

    await _notify_approver(db, body.delegate_to, doc["case_id"], approval_id)

    updated_doc = await find_by_id(db.approval_chains, approval_id)
    return _to_response(updated_doc)


async def _notify_approver(db, user_id: str, case_id: str, approval_id: str):
    await db.notifications.insert_one({
        "userId": user_id,
        "type": "assignment",
        "title": "Approval Required",
        "message": f"Your approval is needed for case {case_id}",
        "entityType": "case",
        "entityId": case_id,
        "isRead": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })


# ─── Approval Routing Rules ─────────────────────


def _rule_to_response(doc: dict) -> ApprovalRoutingRuleResponse:
    return ApprovalRoutingRuleResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        case_type_id=doc["case_type_id"],
        conditions=[ApprovalRoutingCondition(**c) for c in doc.get("conditions", [])],
        approver_user_ids=doc.get("approver_user_ids", []),
        mode=doc.get("mode", "sequential"),
        priority=doc.get("priority", 0),
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
    )


def _evaluate_condition(condition: dict, fields: dict) -> bool:
    """Evaluate a single routing condition against case fields."""
    field_val = fields.get(condition["field"])
    if field_val is None:
        return False
    op = condition["operator"]
    target = condition["value"]
    # numeric coercion
    try:
        field_val_num = float(field_val)
        target_num = float(target)
    except (ValueError, TypeError):
        field_val_num = target_num = None

    if op == "eq":
        return str(field_val) == str(target)
    elif op == "neq":
        return str(field_val) != str(target)
    elif op in ("gt", "gte", "lt", "lte") and field_val_num is not None:
        if op == "gt":
            return field_val_num > target_num
        elif op == "gte":
            return field_val_num >= target_num
        elif op == "lt":
            return field_val_num < target_num
        elif op == "lte":
            return field_val_num <= target_num
    elif op == "contains":
        return str(target).lower() in str(field_val).lower()
    return False


@router.get("/rules", response_model=list[ApprovalRoutingRuleResponse])
async def list_routing_rules(
    case_type_id: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if case_type_id:
        query["case_type_id"] = case_type_id
    cursor = db.approval_routing_rules.find(query).sort("priority", -1)
    return [_rule_to_response(doc) async for doc in cursor]


@router.post("/rules", status_code=status.HTTP_201_CREATED, response_model=ApprovalRoutingRuleResponse)
async def create_routing_rule(body: ApprovalRoutingRule, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    doc["mode"] = doc["mode"].value if hasattr(doc["mode"], "value") else doc["mode"]
    for c in doc["conditions"]:
        c["operator"] = c["operator"].value if hasattr(c["operator"], "value") else c["operator"]
    doc["created_at"] = now
    result = await db.approval_routing_rules.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _rule_to_response(doc)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routing_rule(rule_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await delete_by_id(db.approval_routing_rules, rule_id)
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Routing rule not found")


@router.post("/rules/evaluate")
async def evaluate_routing_rules(
    case_type_id: str,
    case_fields: dict,
    user: dict = Depends(get_current_user),
):
    """Evaluate all active rules for a case type and return matching approver chains."""
    db = get_db()
    cursor = db.approval_routing_rules.find({
        "case_type_id": case_type_id,
        "is_active": True,
    }).sort("priority", -1)

    matched: list[dict] = []
    async for doc in cursor:
        conditions = doc.get("conditions", [])
        if all(_evaluate_condition(c, case_fields) for c in conditions):
            matched.append({
                "rule_id": str(doc["_id"]),
                "rule_name": doc["name"],
                "approver_user_ids": doc.get("approver_user_ids", []),
                "mode": doc.get("mode", "sequential"),
                "priority": doc.get("priority", 0),
            })

    return {"case_type_id": case_type_id, "matched_rules": matched}
