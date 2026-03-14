from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    teamIds: list[str] = []
    avatar: Optional[str] = None
    createdAt: str


class TokenResponse(BaseModel):
    user: UserResponse
    token: str
    refreshToken: str


class RegisterResponse(BaseModel):
    user: UserResponse
    token: str


class RefreshRequest(BaseModel):
    refreshToken: str


class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    memberIds: list[str] = []
    createdAt: str
