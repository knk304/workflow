from fastapi import APIRouter, Depends, Query
from auth_deps import get_current_user
from database import get_db
from models.cases import AuditLogResponse

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    entityType: str | None = None,
    entityId: str | None = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if entityType:
        query["entityType"] = entityType
    if entityId:
        query["entityId"] = entityId
    cursor = db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        results.append(AuditLogResponse(
            id=str(doc["_id"]),
            entityType=doc["entityType"],
            entityId=doc["entityId"],
            action=doc["action"],
            actorId=doc["actorId"],
            actorName=doc["actorName"],
            changes=doc.get("changes", {}),
            timestamp=doc["timestamp"],
        ))
    return results
