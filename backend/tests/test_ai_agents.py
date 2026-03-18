"""Tests for LLM client, providers, and agent base classes."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from agents.base import BaseAgent
from agents.providers.base import LLMMessage, LLMResponse, LLMConfig
from agents.providers.custom_provider import _extract_by_path, _resolve_template_value


# ── Extract by path tests ────────────────────────────────

class TestExtractByPath:
    def test_simple_key(self):
        assert _extract_by_path({"name": "Alice"}, "name") == "Alice"

    def test_nested(self):
        data = {"choices": [{"message": {"content": "hello"}}]}
        assert _extract_by_path(data, "choices.0.message.content") == "hello"

    def test_missing_key(self):
        assert _extract_by_path({"a": 1}, "b") is None

    def test_deep_missing(self):
        assert _extract_by_path({"a": {"b": 1}}, "a.c.d") is None

    def test_list_index(self):
        assert _extract_by_path({"items": ["a", "b", "c"]}, "items.1") == "b"

    def test_out_of_range_index(self):
        assert _extract_by_path({"items": ["a"]}, "items.5") is None


class TestResolveTemplate:
    def test_simple_string(self):
        result = _resolve_template_value("model: {{model}}", {"model": "gpt-4o"})
        assert result == "model: gpt-4o"

    def test_numeric(self):
        result = _resolve_template_value("{{max_tokens}}", {"max_tokens": 4096})
        assert result == 4096

    def test_boolean(self):
        result = _resolve_template_value("{{stream}}", {"stream": True})
        assert result == True

    def test_dict_template(self):
        template = {"model": "{{model}}", "tokens": "{{max_tokens}}"}
        result = _resolve_template_value(template, {"model": "test", "max_tokens": 100})
        assert result == {"model": "test", "tokens": 100}


# ── BaseAgent tests ──────────────────────────────────────

class TestBaseAgent:
    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError):
            BaseAgent()

    def test_concrete_subclass(self):
        class TestAgentImpl(BaseAgent):
            @property
            def name(self):
                return "test"
            async def run(self, **kwargs):
                return {"ok": True}

        agent = TestAgentImpl()
        assert agent.name == "test"

    @pytest.mark.asyncio
    async def test_run_returns_data(self):
        class TestAgentImpl(BaseAgent):
            @property
            def name(self):
                return "test"
            async def run(self, **kwargs):
                return {"result": kwargs.get("value", 0) * 2}

        agent = TestAgentImpl()
        result = await agent.run(value=21)
        assert result == {"result": 42}


# ── LLM Config loading tests ────────────────────────────

class TestLLMConfigLoading:
    def test_load_yaml_config(self):
        """Verify the YAML config loads and has expected structure."""
        import yaml
        from pathlib import Path
        config_path = Path(__file__).resolve().parent.parent / "config" / "llm_providers.yaml"
        with open(config_path) as f:
            data = yaml.safe_load(f)
        assert "providers" in data
        assert "openai" in data["providers"]
        assert "custom" in data["providers"]
        assert "ollama" in data["providers"]
        # Custom provider has request_template and response_mapping
        custom = data["providers"]["custom"]
        assert "request_template" in custom
        assert "response_mapping" in custom

    def test_provider_factory(self):
        from agents.providers.openai_provider import OpenAIProvider
        from agents.providers.custom_provider import CustomProvider

        openai_config = LLMConfig(
            name="test-openai", type="openai", label="Test",
            base_url="https://api.openai.com/v1", model="gpt-4o",
        )
        provider = OpenAIProvider(openai_config)
        assert provider.name == "test-openai"

        custom_config = LLMConfig(
            name="test-custom", type="custom", label="Custom Test",
            base_url="https://my-llm.example.com/api",
            request_template={"prompt": "{{messages}}"},
            response_mapping={"content": "result.text"},
        )
        provider = CustomProvider(custom_config)
        assert provider.name == "test-custom"


# ── Summarization agent tests ───────────────────────────

class TestSummarizationAgent:
    @pytest.mark.asyncio
    async def test_summarize_missing_case(self, patched_db):
        from agents.summarization import SummarizationAgent
        agent = SummarizationAgent()
        with pytest.raises(ValueError, match="not found"):
            await agent._gather_context(case_id="nonexistent")

    @pytest.mark.asyncio
    async def test_gather_context_populates(self, patched_db):
        from agents.summarization import SummarizationAgent
        # Seed a case
        await patched_db.cases.insert_one({
            "_id": "case-test-1",
            "type": "loan_origination",
            "status": "open",
            "stage": "intake",
            "priority": "high",
            "fields": {"applicantName": "John Doe"},
            "stages": [{"name": "intake", "status": "in_progress", "enteredAt": "2026-01-01"}],
            "sla": {"targetDate": "2026-02-01", "daysRemaining": 30, "escalated": False},
            "ownerId": "user-1", "teamId": "team-1",
            "createdAt": "2026-01-01", "updatedAt": "2026-01-01", "createdBy": "user-1",
        })
        await patched_db.tasks.insert_one({
            "_id": "task-1", "caseId": "case-test-1", "title": "Review docs",
            "status": "todo", "priority": "high", "createdAt": "2026-01-01",
        })
        await patched_db.comments.insert_one({
            "_id": "c-1", "caseId": "case-test-1", "userName": "Alice",
            "text": "Looks good", "createdAt": "2026-01-01",
        })

        agent = SummarizationAgent()
        context = await agent._gather_context(case_id="case-test-1")
        assert context["case_id"] == "case-test-1"
        assert context["type"] == "loan_origination"
        assert len(context["tasks"]) == 1
        assert len(context["comments"]) == 1

    @pytest.mark.asyncio
    async def test_summarize_with_mocked_llm(self, patched_db):
        """End-to-end test with mocked LLM response."""
        from agents.summarization import SummarizationAgent
        import json

        # Seed case
        await patched_db.cases.insert_one({
            "_id": "case-mock-1",
            "type": "loan_origination",
            "status": "open",
            "stage": "intake",
            "priority": "medium",
            "fields": {},
            "stages": [],
            "sla": {"targetDate": "2026-02-01", "daysRemaining": 20, "escalated": False},
            "ownerId": "user-1", "teamId": "team-1",
            "createdAt": "2026-01-01", "updatedAt": "2026-01-01", "createdBy": "user-1",
        })

        mock_llm_response = LLMResponse(
            content=json.dumps({
                "summary": "This is a loan case in intake stage.",
                "key_decisions": ["Case opened for processing"],
                "pending_actions": ["Complete document review"],
                "risk_flags": [],
            }),
            provider="test-mock",
        )

        with patch("agents.summarization.get_llm_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.chat = AsyncMock(return_value=mock_llm_response)
            mock_get_client.return_value = mock_client

            agent = SummarizationAgent()
            result = await agent.run(case_id="case-mock-1")

            assert result["case_id"] == "case-mock-1"
            assert "loan case" in result["summary"]
            assert len(result["key_decisions"]) == 1
            assert len(result["pending_actions"]) == 1
            assert result["generated_by"] == "test-mock"
