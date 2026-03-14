from fastapi import APIRouter, Depends
from models.auth import TeamResponse
from database import get_db
from auth_deps import get_current_user

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=list[TeamResponse])
async def list_teams(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.teams.find()
    teams = []
    async for doc in cursor:
        teams.append(TeamResponse(
            id=doc["_id"],
            name=doc["name"],
            description=doc.get("description"),
            memberIds=doc.get("member_ids", []),
            createdAt=doc.get("created_at", ""),
        ))
    return teams
