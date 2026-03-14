"""Case type routes — separate from cases to match frontend /api/case-types."""

from fastapi import APIRouter, Depends
from auth_deps import get_current_user
from database import get_db
from models.cases import CaseTypeResponse

router = APIRouter(prefix="/api/case-types", tags=["case-types"])


@router.get("", response_model=list[CaseTypeResponse])
async def list_case_types(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.case_types.find()
    results = []
    async for doc in cursor:
        results.append(CaseTypeResponse(
            id=str(doc["_id"]),
            name=doc["name"],
            description=doc.get("description", ""),
            stages=doc.get("stages", []),
            fieldsSchema=doc.get("fieldsSchema", {}),
        ))
    return results
