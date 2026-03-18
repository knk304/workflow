"""Tests for AI route endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from agents.providers.base import LLMResponse
from tests.conftest import seed_test_user, auth_header


class TestSummarizeEndpoint:
    @pytest.mark.asyncio
    async def test_summarize_case_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/ai/summarize/nonexistent",
                                  json={}, headers=auth_header())
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_summarize_success(self, client, patched_db):
        await seed_test_user(patched_db)
        await patched_db.cases.insert_one({
            "_id": "case-ai-1",
            "type": "loan_origination",
            "status": "open",
            "stage": "intake",
            "priority": "medium",
            "fields": {"applicantName": "Test"},
            "stages": [],
            "sla": {"targetDate": "2026-02-01", "daysRemaining": 20, "escalated": False},
            "ownerId": "user-1", "teamId": "team-1",
            "createdAt": "2026-01-01", "updatedAt": "2026-01-01", "createdBy": "user-1",
        })

        mock_response = LLMResponse(
            content=json.dumps({
                "summary": "A medium-priority loan case in intake.",
                "key_decisions": [],
                "pending_actions": ["Begin intake review"],
                "risk_flags": [],
            }),
            provider="test-mock",
        )

        with patch("agents.summarization.get_llm_client") as mock_get:
            mock_client = MagicMock()
            mock_client.chat = AsyncMock(return_value=mock_response)
            mock_get.return_value = mock_client

            resp = await client.post("/api/ai/summarize/case-ai-1",
                                      json={"include_audit": False},
                                      headers=auth_header())
            assert resp.status_code == 200
            data = resp.json()
            assert data["case_id"] == "case-ai-1"
            assert "loan case" in data["summary"]
            assert data["generated_by"] == "test-mock"


class TestAIHealth:
    @pytest.mark.asyncio
    async def test_ai_health_endpoint(self, client, patched_db):
        await seed_test_user(patched_db)

        with patch("agents.llm_client.get_llm_client") as mock_get:
            mock_client = MagicMock()
            mock_client.health_check = AsyncMock(return_value={
                "provider": "test", "healthy": True,
            })
            mock_get.return_value = mock_client

            resp = await client.get("/api/ai/health", headers=auth_header())
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
