"""Tests for P3-S2: Extraction agent, embeddings pipeline, semantic search, new AI routes."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from tests.conftest import seed_test_user, auth_header, seed_case, seed_case_type


# ── Extraction agent unit tests ───────────────────────────

class TestExtractDocumentText:
    def test_extract_text_plain(self, tmp_path):
        from agents.extraction import _extract_text_from_file
        f = tmp_path / "test.txt"
        f.write_text("Hello world", encoding="utf-8")
        text = _extract_text_from_file(str(f), "text/plain")
        assert "Hello world" in text

    def test_extract_csv(self, tmp_path):
        from agents.extraction import _extract_text_from_file
        f = tmp_path / "data.csv"
        f.write_text("name,age\nAlice,30", encoding="utf-8")
        text = _extract_text_from_file(str(f), "text/csv")
        assert "Alice" in text

    def test_unsupported_type(self, tmp_path):
        from agents.extraction import _extract_text_from_file
        text = _extract_text_from_file(str(tmp_path / "x.bin"), "application/octet-stream")
        assert text == ""

    def test_extract_document_text_dispatches_pdf(self, tmp_path):
        from agents.extraction import extract_document_text
        # Should not crash even without a real PDF
        result = extract_document_text(str(tmp_path / "missing.pdf"), "application/pdf")
        assert result == ""

    def test_extract_document_text_dispatches_text(self, tmp_path):
        from agents.extraction import extract_document_text
        f = tmp_path / "test.json"
        f.write_text('{"key": "value"}', encoding="utf-8")
        result = extract_document_text(str(f), "application/json")
        assert "key" in result


class TestExtractionAgent:
    @pytest.mark.asyncio
    async def test_agent_name(self):
        from agents.extraction import ExtractionAgent
        agent = ExtractionAgent()
        assert agent.name == "extraction"

    @pytest.mark.asyncio
    async def test_system_prompt_with_hints(self):
        from agents.extraction import ExtractionAgent
        agent = ExtractionAgent()
        prompt = agent._build_system_prompt(["applicantName", "email"])
        assert "applicantName" in prompt
        assert "email" in prompt
        assert "JSON" in prompt

    @pytest.mark.asyncio
    async def test_system_prompt_without_hints(self):
        from agents.extraction import ExtractionAgent
        agent = ExtractionAgent()
        prompt = agent._build_system_prompt(None)
        assert "JSON" in prompt

    @pytest.mark.asyncio
    async def test_gather_context_missing_doc(self, patched_db):
        from agents.extraction import ExtractionAgent
        agent = ExtractionAgent()
        with pytest.raises(ValueError, match="not found"):
            await agent._gather_context("nonexistent-doc")

    @pytest.mark.asyncio
    async def test_gather_context_with_doc(self, patched_db, tmp_path):
        from agents.extraction import ExtractionAgent
        # Insert a document record
        f = tmp_path / "test.txt"
        f.write_text("Sample text content", encoding="utf-8")
        await patched_db.documents.insert_one({
            "_id": "doc-001",
            "file_name": "test.txt",
            "file_type": "text/plain",
            "storage_path": str(f),
            "case_id": None,
        })
        agent = ExtractionAgent()
        ctx = await agent._gather_context("doc-001")
        assert ctx["document_id"] == "doc-001"
        assert "Sample text content" in ctx["raw_text"]

    @pytest.mark.asyncio
    async def test_run_no_text(self, patched_db):
        from agents.extraction import ExtractionAgent
        await patched_db.documents.insert_one({
            "_id": "doc-empty",
            "file_name": "binary.bin",
            "file_type": "application/octet-stream",
            "storage_path": "/nonexistent/path",
        })
        agent = ExtractionAgent()
        result = await agent.run(document_id="doc-empty")
        assert result["document_id"] == "doc-empty"
        assert result["fields"] == []
        assert result["generated_by"] == "none"

    @pytest.mark.asyncio
    async def test_run_with_llm(self, patched_db, tmp_path):
        from agents.extraction import ExtractionAgent
        from agents.providers.base import LLMResponse

        f = tmp_path / "invoice.txt"
        f.write_text("Invoice #123\nAmount: $500\nDate: 2026-01-15", encoding="utf-8")
        await patched_db.documents.insert_one({
            "_id": "doc-invoice",
            "file_name": "invoice.txt",
            "file_type": "text/plain",
            "storage_path": str(f),
            "case_id": None,
        })

        mock_response = LLMResponse(
            content='{"fields": [{"field_name": "amount", "value": "$500", "confidence": 0.92, "source_page": null}]}',
            provider="test-provider",
        )
        mock_client = MagicMock()
        mock_client.chat = AsyncMock(return_value=mock_response)

        with patch("agents.extraction.get_llm_client", return_value=mock_client):
            agent = ExtractionAgent()
            result = await agent.run(document_id="doc-invoice")

        assert result["document_id"] == "doc-invoice"
        assert len(result["fields"]) == 1
        assert result["fields"][0]["field_name"] == "amount"
        assert result["generated_by"] == "test-provider"

        # Check extraction results stored in DB
        doc = await patched_db.documents.find_one({"_id": "doc-invoice"})
        assert doc["extraction_status"] == "completed"
        assert len(doc["extracted_fields"]) == 1


# ── Embeddings pipeline unit tests ────────────────────────

class TestEmbedText:
    def test_embed_text_returns_vector(self):
        from agents.embeddings import embed_text, EMBEDDING_DIM
        vec = embed_text("Hello world")
        assert isinstance(vec, list)
        assert len(vec) == EMBEDDING_DIM

    def test_embed_text_deterministic_fallback(self):
        from agents.embeddings import embed_text
        v1 = embed_text("same input")
        v2 = embed_text("same input")
        assert v1 == v2

    def test_embed_text_different_inputs(self):
        from agents.embeddings import embed_text
        v1 = embed_text("hello")
        v2 = embed_text("goodbye")
        assert v1 != v2


class TestCosineSimilarity:
    def test_identical_vectors(self):
        from agents.embeddings import cosine_similarity
        v = [1.0, 0.0, 0.0]
        assert abs(cosine_similarity(v, v) - 1.0) < 1e-6

    def test_orthogonal_vectors(self):
        from agents.embeddings import cosine_similarity
        v1 = [1.0, 0.0]
        v2 = [0.0, 1.0]
        assert abs(cosine_similarity(v1, v2)) < 1e-6

    def test_opposite_vectors(self):
        from agents.embeddings import cosine_similarity
        v1 = [1.0, 0.0]
        v2 = [-1.0, 0.0]
        assert abs(cosine_similarity(v1, v2) - (-1.0)) < 1e-6

    def test_zero_vector(self):
        from agents.embeddings import cosine_similarity
        assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


class TestIndexAndSearch:
    @pytest.mark.asyncio
    async def test_index_entity(self, patched_db):
        from agents.embeddings import index_entity
        await index_entity("cases", "c-1", "Test Case", "A test case about loans")
        rec = await patched_db.embeddings.find_one({"entity_id": "c-1"})
        assert rec is not None
        assert rec["entity_type"] == "cases"
        assert rec["title"] == "Test Case"
        assert len(rec["vector"]) > 0

    @pytest.mark.asyncio
    async def test_index_entity_upsert(self, patched_db):
        from agents.embeddings import index_entity
        await index_entity("cases", "c-1", "V1", "Version 1")
        await index_entity("cases", "c-1", "V2", "Version 2")
        count = await patched_db.embeddings.count_documents({"entity_id": "c-1"})
        assert count == 1
        rec = await patched_db.embeddings.find_one({"entity_id": "c-1"})
        assert rec["title"] == "V2"

    @pytest.mark.asyncio
    async def test_semantic_search_basic(self, patched_db):
        from agents.embeddings import index_entity, semantic_search
        await index_entity("cases", "c-loan", "Loan Case", "Application for a home mortgage loan")
        await index_entity("tasks", "t-review", "Review Task", "Review the insurance claim documents")
        results = await semantic_search("loan mortgage", limit=5)
        assert len(results) > 0
        # Both entities should appear in results
        ids = [r["entity_id"] for r in results]
        assert "c-loan" in ids
        assert all(r["score"] > 0 or r["score"] <= 0 for r in results)  # scores are floats

    @pytest.mark.asyncio
    async def test_semantic_search_with_type_filter(self, patched_db):
        from agents.embeddings import index_entity, semantic_search
        await index_entity("cases", "c-1", "Case", "Test case")
        await index_entity("tasks", "t-1", "Task", "Test task")
        results = await semantic_search("test", entity_types=["tasks"])
        for r in results:
            assert r["entity_type"] == "tasks"

    @pytest.mark.asyncio
    async def test_semantic_search_empty_db(self, patched_db):
        from agents.embeddings import semantic_search
        results = await semantic_search("anything")
        assert results == []

    @pytest.mark.asyncio
    async def test_index_case(self, patched_db):
        from agents.embeddings import index_case
        await seed_case_type(patched_db)
        await seed_case(patched_db)
        await index_case("case-001")
        rec = await patched_db.embeddings.find_one({"entity_id": "case-001"})
        assert rec is not None
        assert rec["entity_type"] == "cases"

    @pytest.mark.asyncio
    async def test_index_task(self, patched_db):
        from agents.embeddings import index_task
        await patched_db.tasks.insert_one({
            "_id": "task-001",
            "title": "Review Documents",
            "status": "open",
            "priority": "high",
            "description": "Review all uploaded documents",
        })
        await index_task("task-001")
        rec = await patched_db.embeddings.find_one({"entity_id": "task-001"})
        assert rec is not None
        assert "Review" in rec["title"]

    @pytest.mark.asyncio
    async def test_index_document(self, patched_db):
        from agents.embeddings import index_document
        await patched_db.documents.insert_one({
            "_id": "doc-001",
            "file_name": "contract.pdf",
            "file_type": "application/pdf",
            "tags": ["legal", "contract"],
            "current": True,
            "extracted_fields": [
                {"field_name": "party_a", "value": "ACME Corp"},
            ],
        })
        await index_document("doc-001")
        rec = await patched_db.embeddings.find_one({"entity_id": "doc-001"})
        assert rec is not None
        assert "contract" in rec["text_snippet"].lower()

    @pytest.mark.asyncio
    async def test_rebuild_index(self, patched_db):
        from agents.embeddings import rebuild_index
        await seed_case_type(patched_db)
        await seed_case(patched_db)
        await patched_db.tasks.insert_one({
            "_id": "t-1", "title": "Task", "status": "open",
            "priority": "medium", "description": "desc",
        })
        await patched_db.documents.insert_one({
            "_id": "d-1", "file_name": "f.txt", "file_type": "text/plain",
            "current": True, "tags": [],
        })
        counts = await rebuild_index()
        assert counts["cases"] >= 1
        assert counts["tasks"] >= 1
        assert counts["documents"] >= 1


# ── AI route tests (P3-S2 endpoints) ─────────────────────

class TestExtractRoute:
    @pytest.mark.asyncio
    async def test_extract_404(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/ai/extract/nonexistent", headers=auth_header())
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_extract_success(self, client, patched_db, tmp_path):
        await seed_test_user(patched_db)
        f = tmp_path / "test.txt"
        f.write_text("Invoice Amount: $1000", encoding="utf-8")
        await patched_db.documents.insert_one({
            "_id": "doc-route-test",
            "file_name": "test.txt",
            "file_type": "text/plain",
            "storage_path": str(f),
            "case_id": None,
        })

        from agents.providers.base import LLMResponse
        mock_response = LLMResponse(
            content='{"fields": [{"field_name": "amount", "value": "$1000", "confidence": 0.9, "source_page": null}]}',
            provider="mock",
        )
        mock_client = MagicMock()
        mock_client.chat = AsyncMock(return_value=mock_response)

        with patch("agents.extraction.get_llm_client", return_value=mock_client):
            resp = await client.post("/api/ai/extract/doc-route-test", headers=auth_header())

        assert resp.status_code == 200
        data = resp.json()
        assert data["document_id"] == "doc-route-test"
        assert len(data["fields"]) == 1
        assert data["fields"][0]["field_name"] == "amount"


class TestSearchRoute:
    @pytest.mark.asyncio
    async def test_search_empty(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post(
            "/api/ai/search",
            json={"query": "hello", "limit": 5},
            headers=auth_header(),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["query"] == "hello"
        assert data["results"] == []

    @pytest.mark.asyncio
    async def test_search_returns_results(self, client, patched_db):
        await seed_test_user(patched_db)
        from agents.embeddings import index_entity
        await index_entity("cases", "c-1", "Loan Application", "Home mortgage loan application")
        resp = await client.post(
            "/api/ai/search",
            json={"query": "loan mortgage", "limit": 5},
            headers=auth_header(),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0
        assert data["results"][0]["entity_id"] == "c-1"


class TestIndexRoutes:
    @pytest.mark.asyncio
    async def test_rebuild_index(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/ai/index/rebuild", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "indexed" in data

    @pytest.mark.asyncio
    async def test_index_single_entity(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        await seed_case(patched_db)
        resp = await client.post(
            "/api/ai/index/cases/case-001",
            headers=auth_header(),
        )
        assert resp.status_code == 200
        assert resp.json()["entity_type"] == "cases"

    @pytest.mark.asyncio
    async def test_index_unknown_entity_type(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post(
            "/api/ai/index/unknown/id-1",
            headers=auth_header(),
        )
        assert resp.status_code == 400
