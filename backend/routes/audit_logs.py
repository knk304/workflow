from fastapi import APIRouter, Depends, Query
from auth_deps import get_current_user
from database import get_db
from models.cases import AuditLogResponse

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


def _doc_to_response(doc: dict) -> AuditLogResponse:
    return AuditLogResponse(
        id=str(doc["_id"]),
        entityType=doc.get("entityType", ""),
        entityId=doc.get("entityId", ""),
        category=doc.get("category", ""),
        action=doc.get("action", ""),
        actorId=doc.get("actorId", ""),
        actorName=doc.get("actorName", ""),
        details=doc.get("details", {}),
        changes=doc.get("changes", {}),
        correlationId=doc.get("correlationId", ""),
        timestamp=doc.get("timestamp", ""),
    )


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    entityType: str | None = None,
    entityId: str | None = None,
    category: str | None = None,
    action: str | None = None,
    skip: int = 0,
    limit: int = 100,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if entityType:
        query["entityType"] = entityType
    if entityId:
        query["entityId"] = entityId
    if category:
        # Support comma-separated categories for multi-filter
        cats = [c.strip() for c in category.split(",") if c.strip()]
        if len(cats) == 1:
            query["category"] = cats[0]
        elif cats:
            query["category"] = {"$in": cats}
    if action:
        query["action"] = action
    cursor = db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        results.append(_doc_to_response(doc))
    return results


@router.get("/count")
async def count_audit_logs(
    entityId: str | None = None,
    category: str | None = None,
    user: dict = Depends(get_current_user),
):
    """Return count of audit logs, useful for pagination."""
    db = get_db()
    query: dict = {}
    if entityId:
        query["entityId"] = entityId
    if category:
        cats = [c.strip() for c in category.split(",") if c.strip()]
        if len(cats) == 1:
            query["category"] = cats[0]
        elif cats:
            query["category"] = {"$in": cats}
    count = await db.audit_logs.count_documents(query)
    return {"count": count}
