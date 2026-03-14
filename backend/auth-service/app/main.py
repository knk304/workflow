from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from shared.config import get_settings
from shared.database import connect_db, close_db
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.teams import router as teams_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await _seed_default_data()
    yield
    await close_db()


app = FastAPI(
    title="Workflow Auth Service",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(teams_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth"}


async def _seed_default_data():
    """Seed default users and teams if the database is empty."""
    from shared.database import get_db
    from shared.security import hash_password

    db = get_db()
    count = await db.users.count_documents({})
    if count > 0:
        return

    users = [
        {
            "_id": "user-1",
            "email": "alice@example.com",
            "name": "Alice Johnson",
            "role": "MANAGER",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("demo123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-01-01T00:00:00.000Z",
        },
        {
            "_id": "user-2",
            "email": "bob@example.com",
            "name": "Bob Smith",
            "role": "WORKER",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("demo123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-02-15T00:00:00.000Z",
        },
        {
            "_id": "user-3",
            "email": "carol@example.com",
            "name": "Carol Davis",
            "role": "WORKER",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("demo123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-03-10T00:00:00.000Z",
        },
        {
            "_id": "user-admin",
            "email": "admin@example.com",
            "name": "Admin User",
            "role": "ADMIN",
            "team_ids": ["team-1"],
            "hashed_password": hash_password("admin123"),
            "avatar": None,
            "is_active": True,
            "created_at": "2025-01-01T00:00:00.000Z",
        },
    ]

    teams = [
        {
            "_id": "team-1",
            "name": "Loan Processing",
            "description": "Handles all loan origination cases",
            "member_ids": ["user-1", "user-2", "user-3", "user-admin"],
            "created_at": "2025-01-01T00:00:00.000Z",
        },
    ]

    await db.users.insert_many(users)
    await db.teams.insert_many(teams)
