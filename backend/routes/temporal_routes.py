"""
Temporal proxy routes — expose Temporal server data to the Angular frontend.

All endpoints require authentication and proxy queries through the Temporal SDK
(not direct HTTP) to avoid exposing gRPC internals.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from temporalio.api.enums.v1 import WorkflowExecutionStatus
from temporalio.client import WorkflowExecutionStatus as SDKStatus

from auth_deps import get_current_user
from temporal_worker.client import get_temporal_client

router = APIRouter(prefix="/api/temporal", tags=["temporal"])


# ── Helper ───────────────────────────────────────────────────────────

def _status_label(status: int) -> str:
    labels = {
        1: "running",
        2: "completed",
        3: "failed",
        4: "cancelled",
        5: "terminated",
        6: "continued_as_new",
        7: "timed_out",
    }
    return labels.get(status, "unknown")


# ── Cluster health ───────────────────────────────────────────────────

@router.get("/health")
async def temporal_health(_user=Depends(get_current_user)):
    """Ping the Temporal cluster and return namespace info."""
    try:
        client = await get_temporal_client()
        desc = await client.describe_namespace()
        return {
            "status": "ok",
            "namespace": desc.namespace_info.name,
            "state": str(desc.namespace_info.state),
            "history_archival": str(desc.config.history_archival_state),
        }
    except Exception as exc:
        return {"status": "unavailable", "error": str(exc)}


# ── Workflow list ────────────────────────────────────────────────────

@router.get("/workflows")
async def list_workflows(
    status: str | None = Query(None, description="running|completed|failed|timed_out"),
    page_size: int = Query(20, le=100),
    next_page_token: str | None = Query(None),
    _user=Depends(get_current_user),
):
    """List workflow executions, optionally filtered by status."""
    client = await get_temporal_client()

    query_parts = []
    if status == "running":
        query_parts.append("ExecutionStatus = 'Running'")
    elif status == "completed":
        query_parts.append("ExecutionStatus = 'Completed'")
    elif status == "failed":
        query_parts.append("ExecutionStatus = 'Failed'")
    elif status == "timed_out":
        query_parts.append("ExecutionStatus = 'TimedOut'")

    query = " AND ".join(query_parts) if query_parts else ""

    results = []
    async for exec_ in client.list_workflows(query=query or None):
        results.append({
            "workflow_id": exec_.id,
            "run_id": exec_.run_id,
            "workflow_type": exec_.workflow_type,
            "status": _status_label(exec_.status.value if exec_.status else 0),
            "start_time": exec_.start_time.isoformat() if exec_.start_time else None,
            "close_time": exec_.close_time.isoformat() if exec_.close_time else None,
            "task_queue": exec_.task_queue,
        })
        if len(results) >= page_size:
            break

    return {"workflows": results, "count": len(results)}


# ── Workflow detail ──────────────────────────────────────────────────

@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    run_id: str | None = Query(None),
    _user=Depends(get_current_user),
):
    """Get execution detail + event history for a single workflow."""
    client = await get_temporal_client()
    try:
        handle = client.get_workflow_handle(workflow_id, run_id=run_id)
        desc = await handle.describe()

        # Collect up to 200 history events
        history_events = []
        async for event in handle.fetch_history_events():
            history_events.append({
                "event_id": event.event_id,
                "event_type": event.event_type.name,
                "event_time": event.event_time.isoformat() if event.event_time else None,
            })
            if len(history_events) >= 200:
                break

        return {
            "workflow_id": desc.id,
            "run_id": desc.run_id,
            "workflow_type": desc.workflow_type,
            "status": _status_label(desc.status.value if desc.status else 0),
            "start_time": desc.start_time.isoformat() if desc.start_time else None,
            "close_time": desc.close_time.isoformat() if desc.close_time else None,
            "task_queue": desc.task_queue,
            "history_length": desc.history_length,
            "history_events": history_events,
        }
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ── Start CaseWorkflow for an existing case ──────────────────────────

@router.post("/cases/{case_id}/start")
async def start_case_workflow(
    case_id: str,
    _user=Depends(get_current_user),
):
    """Manually start a CaseWorkflow for a case that already exists in MongoDB."""
    from database import get_db
    from temporal_worker.workflows.case_workflow import CaseWorkflow

    db = get_db()
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if case.get("temporal_workflow_id"):
        return {"workflow_id": case["temporal_workflow_id"], "already_running": True}

    client = await get_temporal_client()
    from config import get_settings
    settings = get_settings()

    handle = await client.start_workflow(
        CaseWorkflow.run,
        case_id,
        id=f"case-{case_id}",
        task_queue=settings.temporal_task_queue,
        execution_timeout=timedelta(days=365),
    )

    await db.cases.update_one(
        {"_id": case_id},
        {"$set": {"temporal_workflow_id": handle.id}},
    )

    return {"workflow_id": handle.id, "run_id": handle.result_run_id}


# ── Worker / namespace info ──────────────────────────────────────────

@router.get("/workers")
async def get_worker_info(_user=Depends(get_current_user)):
    """Return task queue poller info (active workers)."""
    from config import get_settings
    client = await get_temporal_client()
    settings = get_settings()
    try:
        resp = await client.service_client.task_queue_service.describe_task_queue(
            namespace=settings.temporal_namespace,
            name=settings.temporal_task_queue,
        )
        pollers = [
            {
                "identity": p.identity,
                "last_access_time": p.last_access_time.isoformat()
                if p.last_access_time else None,
            }
            for p in (resp.pollers or [])
        ]
        return {"task_queue": settings.temporal_task_queue, "pollers": pollers}
    except Exception as exc:
        return {"task_queue": settings.temporal_task_queue, "pollers": [], "error": str(exc)}
