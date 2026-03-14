"""Approval chain routes — multi-level approvals with delegation."""

from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone

from auth_deps import get_current_user
from database import get_db
from models.phase2 import (
    ApprovalChainCreate, ApprovalChainResponse, ApprovalDecision,
    ApprovalDelegation, Approver, ApprovalStatus, ApprovalMode,
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
    doc = await db.approval_chains.find_one({"_id": ObjectId(approval_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval chain not found")
    return _to_response(doc)


@router.post("/{approval_id}/approve", response_model=ApprovalChainResponse)
async def approve(approval_id: str, body: ApprovalDecision, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.approval_chains.find_one({"_id": ObjectId(approval_id)})
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

    await db.approval_chains.update_one(
        {"_id": ObjectId(approval_id)},
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

    updated_doc = await db.approval_chains.find_one({"_id": ObjectId(approval_id)})
    return _to_response(updated_doc)


@router.post("/{approval_id}/reject", response_model=ApprovalChainResponse)
async def reject(approval_id: str, body: ApprovalDecision, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.approval_chains.find_one({"_id": ObjectId(approval_id)})
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

    await db.approval_chains.update_one(
        {"_id": ObjectId(approval_id)},
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

    updated_doc = await db.approval_chains.find_one({"_id": ObjectId(approval_id)})
    return _to_response(updated_doc)


@router.post("/{approval_id}/delegate", response_model=ApprovalChainResponse)
async def delegate(approval_id: str, body: ApprovalDelegation, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.approval_chains.find_one({"_id": ObjectId(approval_id)})
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

    await db.approval_chains.update_one(
        {"_id": ObjectId(approval_id)},
        {"$set": {"approvers": approvers}},
    )

    await _notify_approver(db, body.delegate_to, doc["case_id"], approval_id)

    updated_doc = await db.approval_chains.find_one({"_id": ObjectId(approval_id)})
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
