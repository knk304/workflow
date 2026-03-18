"""AI endpoints — summarization, extraction, search, copilot, routing, risk."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from auth_deps import get_current_user
from models.ai import (
    SummarizationRequest,
    SummarizationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


# ── Summarization (P3-S1) ────────────────────────────────

@router.post("/summarize/{case_id}", response_model=SummarizationResponse)
async def summarize_case(
    case_id: str,
    body: SummarizationRequest | None = None,
    user: dict = Depends(get_current_user),
):
    """Generate an AI-powered summary of a case.

    Gathers case metadata, stage history, tasks, comments, and audit trail,
    then sends to the configured LLM for structured summarization.
    """
    from agents.summarization import SummarizationAgent

    body = body or SummarizationRequest()

    agent = SummarizationAgent()
    try:
        result = await agent.run(
            case_id=case_id,
            include_audit=body.include_audit,
            include_comments=body.include_comments,
            include_tasks=body.include_tasks,
            max_length=body.max_length,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except Exception as e:
        logger.exception(f"Summarization failed for case {case_id}")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"AI summarization failed: {type(e).__name__}: {e}",
        )

    return SummarizationResponse(**result)


# ── Health Check for AI subsystem ─────────────────────────

@router.get("/health")
async def ai_health(user: dict = Depends(get_current_user)):
    """Check if the AI subsystem (LLM provider) is reachable."""
    from agents.llm_client import get_llm_client

    client = get_llm_client()
    try:
        result = await client.health_check()
    except Exception as e:
        return {"status": "error", "detail": str(e)}
    return {"status": "ok" if result["healthy"] else "unreachable", **result}
