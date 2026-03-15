from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

from models.auth import TeamResponse
from database import get_db
from auth_deps import get_current_user

router = APIRouter(prefix="/api/teams", tags=["teams"])


class CreateTeam(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    memberIds: list[str] = []


class UpdateTeam(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    memberIds: Optional[list[str]] = None


def _team_response(doc: dict) -> TeamResponse:
    return TeamResponse(
        id=doc["_id"],
        name=doc["name"],
        description=doc.get("description"),
        memberIds=doc.get("member_ids", []),
        createdAt=doc.get("created_at", ""),
    )


@router.get("", response_model=list[TeamResponse])
async def list_teams(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.teams.find()
    teams = []
    async for doc in cursor:
        teams.append(_team_response(doc))
    return teams


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(req: CreateTeam, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("ADMIN", "MANAGER"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or Manager only")

    db = get_db()
    team_id = f"team-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "_id": team_id,
        "name": req.name,
        "description": req.description,
        "member_ids": req.memberIds,
        "created_at": now,
    }
    await db.teams.insert_one(doc)

    # sync user team_ids
    for uid in req.memberIds:
        await db.users.update_one({"_id": uid}, {"$addToSet": {"team_ids": team_id}})

    return _team_response(doc)


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(team_id: str, req: UpdateTeam, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("ADMIN", "MANAGER"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or Manager only")

    db = get_db()
    doc = await db.teams.find_one({"_id": team_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    updates: dict = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.description is not None:
        updates["description"] = req.description
    if req.memberIds is not None:
        old_members = set(doc.get("member_ids", []))
        new_members = set(req.memberIds)
        updates["member_ids"] = req.memberIds
        # remove team from removed users
        for uid in old_members - new_members:
            await db.users.update_one({"_id": uid}, {"$pull": {"team_ids": team_id}})
        # add team to new users
        for uid in new_members - old_members:
            await db.users.update_one({"_id": uid}, {"$addToSet": {"team_ids": team_id}})

    if updates:
        await db.teams.update_one({"_id": team_id}, {"$set": updates})

    updated = await db.teams.find_one({"_id": team_id})
    return _team_response(updated)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(team_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    db = get_db()
    doc = await db.teams.find_one({"_id": team_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # remove team from all users
    await db.users.update_many({}, {"$pull": {"team_ids": team_id}})
    # delete the team
    await db.teams.delete_one({"_id": team_id})
