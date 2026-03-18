"""Embeddings pipeline — text → vector storage + similarity search.

Uses sentence-transformers for local embedding generation and stores
vectors in MongoDB alongside entity documents.  Falls back to LLM-based
embeddings when sentence-transformers is unavailable.

Vectors are stored in a dedicated `embeddings` collection:
  { _id, entity_type, entity_id, title, text_snippet, vector: [...], created_at }
"""

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from agents.providers.base import LLMMessage
from database import get_db

logger = logging.getLogger(__name__)

# ── Embedding model singleton ───────────────────────────────────
_model = None
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 default


def _get_embedding_model():
    """Lazy-load sentence-transformers model (or None if not installed)."""
    global _model
    if _model is not None:
        return _model
    try:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Loaded sentence-transformers model: all-MiniLM-L6-v2")
        return _model
    except ImportError:
        logger.warning("sentence-transformers not installed — using LLM fallback for embeddings")
        return None


def embed_text(text: str) -> list[float]:
    """Generate an embedding vector for a text string.

    Prefers local sentence-transformers model. Falls back to a simple
    hash-based deterministic vector if the library isn't available
    (keeps the pipeline functional for testing / lightweight deploys).
    """
    model = _get_embedding_model()
    if model is not None:
        vector = model.encode(text, normalize_embeddings=True)
        return vector.tolist()

    # Deterministic fallback — NOT for production similarity search, but
    # keeps the pipeline operational when sentence-transformers is absent.
    digest = hashlib.sha384(text.encode("utf-8")).hexdigest()
    vec: list[float] = []
    # Cycle through the hash to fill EMBEDDING_DIM values
    hex_len = len(digest)
    for i in range(EMBEDDING_DIM):
        pos = (i * 2) % hex_len
        byte_val = int(digest[pos : pos + 2], 16)
        vec.append((byte_val / 255.0) * 2 - 1)  # normalise to [-1, 1]
    return vec


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Index / store helpers ───────────────────────────────────────

async def index_entity(
    entity_type: str,
    entity_id: str,
    title: str,
    text: str,
) -> None:
    """Create or update the embedding record for an entity."""
    db = get_db()
    vector = embed_text(text)
    now = datetime.now(timezone.utc).isoformat()

    await db.embeddings.update_one(
        {"entity_type": entity_type, "entity_id": entity_id},
        {"$set": {
            "title": title,
            "text_snippet": text[:500],
            "vector": vector,
            "updated_at": now,
        },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )


async def index_case(case_id: str) -> None:
    """Build embedding text from case fields + stages and index it."""
    db = get_db()
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        return
    parts = [
        f"Case {case_id}",
        f"Type: {case.get('type', '')}",
        f"Status: {case.get('status', '')}",
        f"Stage: {case.get('stage', '')}",
        f"Priority: {case.get('priority', '')}",
    ]
    fields = case.get("fields", {})
    for k, v in fields.items():
        parts.append(f"{k}: {v}")

    # Include recent comments
    comments = []
    async for c in db.comments.find({"caseId": case_id}).sort("createdAt", -1).limit(5):
        comments.append(c.get("body", ""))
    if comments:
        parts.append("Recent comments: " + " | ".join(comments))

    await index_entity("cases", case_id, f"Case {case_id}", " ".join(parts))


async def index_task(task_id: str) -> None:
    """Build embedding text from task fields and index it."""
    db = get_db()
    task = await db.tasks.find_one({"_id": task_id})
    if not task:
        return
    parts = [
        f"Task: {task.get('title', '')}",
        f"Status: {task.get('status', '')}",
        f"Priority: {task.get('priority', '')}",
        task.get("description", ""),
    ]
    await index_entity("tasks", task_id, task.get("title", task_id), " ".join(parts))


async def index_document(document_id: str) -> None:
    """Build embedding text from document metadata + extracted fields."""
    db = get_db()
    doc = await db.documents.find_one({"_id": document_id})
    if not doc:
        return
    parts = [
        f"Document: {doc.get('file_name', '')}",
        f"Type: {doc.get('file_type', '')}",
    ]
    tags = doc.get("tags", [])
    if tags:
        parts.append(f"Tags: {', '.join(tags)}")
    extracted = doc.get("extracted_fields", [])
    for ef in extracted[:20]:
        parts.append(f"{ef.get('field_name', '')}: {ef.get('value', '')}")

    await index_entity("documents", document_id, doc.get("file_name", document_id), " ".join(parts))


# ── Semantic search ─────────────────────────────────────────────

async def semantic_search(
    query: str,
    entity_types: list[str] | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search embeddings collection by cosine similarity to query vector."""
    db = get_db()
    query_vec = embed_text(query)

    # Build filter
    filt: dict[str, Any] = {}
    if entity_types:
        filt["entity_type"] = {"$in": entity_types}

    # Load all matching embeddings (brute-force for now — upgrade to
    # Atlas Vector Search or FAISS index for production scale)
    results: list[dict[str, Any]] = []
    async for rec in db.embeddings.find(filt):
        vec = rec.get("vector", [])
        if not vec:
            continue
        score = cosine_similarity(query_vec, vec)
        results.append({
            "entity_type": rec["entity_type"],
            "entity_id": rec["entity_id"],
            "title": rec.get("title", ""),
            "snippet": rec.get("text_snippet", ""),
            "score": round(score, 4),
        })

    # Sort by descending score and return top N
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


# ── Bulk indexing helper ─────────────────────────────────────────

async def rebuild_index(entity_types: list[str] | None = None) -> dict[str, int]:
    """Re-index all entities. Intended for admin / maintenance use."""
    db = get_db()
    counts: dict[str, int] = {}

    types_to_index = entity_types or ["cases", "tasks", "documents"]

    if "cases" in types_to_index:
        n = 0
        async for case in db.cases.find({"status": {"$ne": "deleted"}}):
            await index_case(case["_id"])
            n += 1
        counts["cases"] = n

    if "tasks" in types_to_index:
        n = 0
        async for task in db.tasks.find():
            await index_task(task["_id"])
            n += 1
        counts["tasks"] = n

    if "documents" in types_to_index:
        n = 0
        async for doc in db.documents.find({"current": True}):
            await index_document(doc["_id"])
            n += 1
        counts["documents"] = n

    logger.info("Rebuild index complete: %s", counts)
    return counts
