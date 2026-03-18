"""Integration tests for document upload/download/versioning."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import io
import tempfile
import pytest
from unittest.mock import patch
from tests.conftest import seed_test_user, auth_header


class TestDocumentUpload:
    @pytest.mark.asyncio
    async def test_upload_document(self, client, patched_db):
        await seed_test_user(patched_db)
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("routes.documents.UPLOAD_DIR", tmpdir):
                resp = await client.post("/api/documents",
                    data={"case_id": "case-001", "tags": "review,important"},
                    files={"file": ("test.pdf", b"fake-pdf-content", "application/pdf")},
                    headers=auth_header(),
                )
                assert resp.status_code == 201
                data = resp.json()
                assert data["file_name"] == "test.pdf"
                assert data["version"] == 1
                assert data["case_id"] == "case-001"
                assert data["current"] is True

    @pytest.mark.asyncio
    async def test_upload_creates_new_version(self, client, patched_db):
        await seed_test_user(patched_db)
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("routes.documents.UPLOAD_DIR", tmpdir):
                # Upload v1
                resp1 = await client.post("/api/documents",
                    data={"case_id": "case-001"},
                    files={"file": ("report.pdf", b"v1-content", "application/pdf")},
                    headers=auth_header(),
                )
                assert resp1.status_code == 201
                assert resp1.json()["version"] == 1

                # Upload v2 (same filename + case_id)
                resp2 = await client.post("/api/documents",
                    data={"case_id": "case-001"},
                    files={"file": ("report.pdf", b"v2-content", "application/pdf")},
                    headers=auth_header(),
                )
                assert resp2.status_code == 201
                assert resp2.json()["version"] == 2

    @pytest.mark.asyncio
    async def test_upload_writes_audit(self, client, patched_db):
        await seed_test_user(patched_db)
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("routes.documents.UPLOAD_DIR", tmpdir):
                await client.post("/api/documents",
                    data={"case_id": "case-001"},
                    files={"file": ("doc.pdf", b"content", "application/pdf")},
                    headers=auth_header(),
                )
                audit = await patched_db.audit_logs.find_one({"action": "uploaded"})
                assert audit is not None
                assert audit["entityType"] == "document"


class TestDocumentList:
    @pytest.mark.asyncio
    async def test_list_documents_by_case(self, client, patched_db):
        await seed_test_user(patched_db)
        await patched_db.documents.insert_one({
            "_id": "d1", "case_id": "case-001", "task_id": None,
            "file_name": "a.pdf", "file_type": "application/pdf",
            "file_size": 100, "version": 1, "uploaded_by": "user-test1",
            "tags": [], "storage_path": "/tmp/a.pdf", "current": True,
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.get("/api/documents?case_id=case-001",
                                 headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert "storage_path" not in data[0]  # Internal path must not leak


class TestDocumentValidation:
    @pytest.mark.asyncio
    async def test_reject_disallowed_file_type(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/documents",
            data={"case_id": "case-001"},
            files={"file": ("malware.exe", b"bad-content", "application/octet-stream")},
            headers=auth_header(),
        )
        assert resp.status_code == 400
        assert "not allowed" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_reject_oversized_file(self, client, patched_db):
        await seed_test_user(patched_db)
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("routes.documents.UPLOAD_DIR", tmpdir):
                with patch("routes.documents.MAX_FILE_SIZE", 100):
                    resp = await client.post("/api/documents",
                        data={"case_id": "case-001"},
                        files={"file": ("big.pdf", b"x" * 200, "application/pdf")},
                        headers=auth_header(),
                    )
                    assert resp.status_code == 413


class TestDocumentDownload:
    @pytest.mark.asyncio
    async def test_download_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/documents/nonexistent/download",
                                 headers=auth_header())
        assert resp.status_code == 404
