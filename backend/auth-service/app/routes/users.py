from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import UserResponse
from shared.database import get_db
from shared.auth_deps import get_current_user, require_roles

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.users.find({"is_active": True})
    users = []
    async for doc in cursor:
        users.append(UserResponse(
            id=doc["_id"],
            email=doc["email"],
            name=doc["name"],
            role=doc["role"],
            teamIds=doc.get("team_ids", []),
            avatar=doc.get("avatar"),
            createdAt=doc.get("created_at", ""),
        ))
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.users.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(
        id=doc["_id"],
        email=doc["email"],
        name=doc["name"],
        role=doc["role"],
        teamIds=doc.get("team_ids", []),
        avatar=doc.get("avatar"),
        createdAt=doc.get("created_at", ""),
    )
