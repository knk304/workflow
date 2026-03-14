from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
import uuid

from app.models.schemas import (
    UserCreate, UserLogin, UserResponse,
    TokenResponse, RegisterResponse, RefreshRequest,
)
from shared.database import get_db
from shared.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from shared.auth_deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse)
async def register(req: UserCreate):
    db = get_db()

    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user_id = f"user-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    user_doc = {
        "_id": user_id,
        "email": req.email,
        "name": req.name,
        "role": "WORKER",
        "team_ids": [],
        "hashed_password": hash_password(req.password),
        "avatar": None,
        "is_active": True,
        "created_at": now,
    }
    await db.users.insert_one(user_doc)

    token = create_access_token({"sub": user_id, "role": "WORKER"})

    return RegisterResponse(
        user=UserResponse(
            id=user_id,
            email=req.email,
            name=req.name,
            role="WORKER",
            teamIds=[],
            avatar=None,
            createdAt=now,
        ),
        token=token,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": req.email})

    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token({"sub": user["_id"], "role": user["role"]})
    refresh = create_refresh_token({"sub": user["_id"]})

    return TokenResponse(
        user=UserResponse(
            id=user["_id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            teamIds=user.get("team_ids", []),
            avatar=user.get("avatar"),
            createdAt=user.get("created_at", ""),
        ),
        token=token,
        refreshToken=refresh,
    )


@router.post("/refresh")
async def refresh_token(req: RefreshRequest):
    payload = decode_token(req.refreshToken)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_token = create_access_token({"sub": user_id, "role": user["role"]})
    return {"token": new_token}


@router.post("/logout")
async def logout():
    # Stateless JWT — client discards token
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["_id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        teamIds=user.get("team_ids", []),
        avatar=user.get("avatar"),
        createdAt=user.get("created_at", ""),
    )
