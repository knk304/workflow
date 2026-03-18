"""AI endpoints — summarization, extraction, search, copilot, routing, risk."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from auth_deps import get_current_user, require_roles
from models.ai import (
    SummarizationRequest,
    SummarizationResponse,
    ExtractionResponse,
    SearchRequest,
    SearchResponse,
    SearchResult,
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


# ── Document Extraction (P3-S2) ──────────────────────────

@router.post("/extract/{document_id}", response_model=ExtractionResponse)
async def extract_document(
    document_id: str,
    user: dict = Depends(get_current_user),
):
    """Extract structured fields from a document using the LLM."""
    from agents.extraction import ExtractionAgent

    agent = ExtractionAgent()
    try:
        result = await agent.run(document_id=document_id)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except Exception as e:
        logger.exception(f"Extraction failed for document {document_id}")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"AI extraction failed: {type(e).__name__}: {e}",
        )

    return ExtractionResponse(**result)


# ── Semantic Search (P3-S2) ──────────────────────────────

@router.post("/search", response_model=SearchResponse)
async def ai_search(
    body: SearchRequest,
    user: dict = Depends(get_current_user),
):
    """Natural-language semantic search across cases, tasks, documents."""
    from agents.embeddings import semantic_search

    try:
        results = await semantic_search(
            query=body.query,
            entity_types=body.entity_types,
            limit=body.limit,
        )
    except Exception as e:
        logger.exception("Semantic search failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Search failed: {type(e).__name__}: {e}",
        )

    return SearchResponse(
        query=body.query,
        results=[SearchResult(**r) for r in results],
        total=len(results),
    )


# ── Index Management (P3-S2) ─────────────────────────────

@router.post("/index/rebuild")
async def rebuild_search_index(
    user: dict = Depends(require_roles("ADMIN", "MANAGER")),
):
    """Re-index all entities for semantic search. Admin/Manager only."""
    from agents.embeddings import rebuild_index

    try:
        counts = await rebuild_index()
    except Exception as e:
        logger.exception("Index rebuild failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Index rebuild failed: {type(e).__name__}: {e}",
        )

    return {"status": "ok", "indexed": counts}


@router.post("/index/{entity_type}/{entity_id}")
async def index_single_entity(
    entity_type: str,
    entity_id: str,
    user: dict = Depends(get_current_user),
):
    """Index or re-index a single entity for semantic search."""
    from agents.embeddings import index_case, index_task, index_document

    indexers = {
        "cases": index_case,
        "tasks": index_task,
        "documents": index_document,
    }
    indexer = indexers.get(entity_type)
    if not indexer:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown entity type: {entity_type}. Supported: {list(indexers.keys())}",
        )

    try:
        await indexer(entity_id)
    except Exception as e:
        logger.exception(f"Indexing failed for {entity_type}/{entity_id}")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Indexing failed: {type(e).__name__}: {e}",
        )

    return {"status": "ok", "entity_type": entity_type, "entity_id": entity_id}
    return {"status": "ok" if result["healthy"] else "unreachable", **result}
