from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

logger = logging.getLogger(__name__)

from config import get_settings
from database import connect_db, close_db
from seed import seed_all
from routes.sla import check_sla_breaches

from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.teams import router as teams_router
from routes.cases import router as cases_router
from routes.case_types import router as case_types_router
from routes.comments import router as comments_router
from routes.audit_logs import router as audit_logs_router
from routes.tasks import router as tasks_router
from routes.notifications import router as notifications_router

# Phase 2 routers
from routes.workflows import router as workflows_router
from routes.approvals import router as approvals_router
from routes.documents import router as documents_router
from routes.sla import router as sla_router
from routes.forms import router as forms_router
from routes.websocket import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await seed_all()

    # Start SLA background checker (every 15 minutes)
    sla_task = asyncio.create_task(_sla_scheduler())
    yield
    sla_task.cancel()
    await close_db()


async def _sla_scheduler():
    """Run SLA breach checks every 15 minutes."""
    while True:
        try:
            await asyncio.sleep(900)  # 15 minutes
            await check_sla_breaches()
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("SLA breach check failed")


app = FastAPI(
    title="Workflow Platform API",
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

# Register all route modules
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(teams_router)
app.include_router(cases_router)
app.include_router(case_types_router)
app.include_router(comments_router)
app.include_router(audit_logs_router)
app.include_router(tasks_router)
app.include_router(notifications_router)

# Phase 2 routers
app.include_router(workflows_router)
app.include_router(approvals_router)
app.include_router(documents_router)
app.include_router(sla_router)
app.include_router(forms_router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "workflow-api"}
