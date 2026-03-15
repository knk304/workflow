from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

from models.auth import UserResponse
from database import get_db
from auth_deps import get_current_user
from security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"ADMIN", "MANAGER", "WORKER", "VIEWER"}


class AdminCreateUser(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1)
    role: str = "WORKER"
    teamIds: list[str] = []


class AdminUpdateUser(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    teamIds: Optional[list[str]] = None
    is_active: Optional[bool] = None


def _user_response(doc: dict) -> UserResponse:
    return UserResponse(
        id=doc["_id"],
        email=doc["email"],
        name=doc["name"],
        role=doc["role"],
        teamIds=doc.get("team_ids", []),
        avatar=doc.get("avatar"),
        createdAt=doc.get("created_at", ""),
    )


@router.get("", response_model=list[UserResponse])
async def list_users(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.users.find({"is_active": True})
    users = []
    async for doc in cursor:
        users.append(_user_response(doc))
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.users.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _user_response(doc)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(req: AdminCreateUser, user: dict = Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    db = get_db()
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user_id = f"user-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "_id": user_id,
        "email": req.email,
        "name": req.name,
        "role": req.role,
        "team_ids": req.teamIds,
        "hashed_password": hash_password(req.password),
        "avatar": None,
        "is_active": True,
        "created_at": now,
    }
    await db.users.insert_one(doc)

    # sync team memberships
    if req.teamIds:
        for tid in req.teamIds:
            await db.teams.update_one({"_id": tid}, {"$addToSet": {"member_ids": user_id}})

    return _user_response(doc)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, req: AdminUpdateUser, user: dict = Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    db = get_db()
    doc = await db.users.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updates: dict = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.role is not None:
        if req.role not in VALID_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        updates["role"] = req.role
    if req.is_active is not None:
        updates["is_active"] = req.is_active
    if req.teamIds is not None:
        old_teams = set(doc.get("team_ids", []))
        new_teams = set(req.teamIds)
        updates["team_ids"] = req.teamIds
        # remove user from old teams
        for tid in old_teams - new_teams:
            await db.teams.update_one({"_id": tid}, {"$pull": {"member_ids": user_id}})
        # add user to new teams
        for tid in new_teams - old_teams:
            await db.teams.update_one({"_id": tid}, {"$addToSet": {"member_ids": user_id}})

    if updates:
        await db.users.update_one({"_id": user_id}, {"$set": updates})

    updated = await db.users.find_one({"_id": user_id})
    return _user_response(updated)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    if user.get("sub") == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")

    db = get_db()
    doc = await db.users.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # soft-delete
    await db.users.update_one({"_id": user_id}, {"$set": {"is_active": False}})
    # remove from all teams
    await db.teams.update_many({}, {"$pull": {"member_ids": user_id}})
