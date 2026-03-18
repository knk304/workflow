"""Tests for P3-S3: Command parser, form builder, workflow builder, copilot, routing, new routes."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from tests.conftest import seed_test_user, auth_header, seed_case, seed_case_type


# ═══════════════════════════════════════════════════════════
#  Command Parser
# ═══════════════════════════════════════════════════════════

class TestParseIntentFast:
    """Fast-path regex intent detection."""

    def test_navigate_dashboard(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("go to dashboard")
        assert result is not None
        assert result["intent"] == "navigate"
        assert result["route"] == "/dashboard"

    def test_navigate_cases(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("show cases")
        assert result is not None
        assert result["intent"] == "navigate"
        assert result["route"] == "/cases"

    def test_navigate_case_by_id(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("open case ABC123")
        assert result["intent"] == "navigate"
        assert "/cases/ABC123" == result["route"]

    def test_navigate_tasks(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("navigate to tasks")
        assert result["route"] == "/tasks"

    def test_navigate_documents(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("show documents")
        assert result["route"] == "/documents"

    def test_navigate_approvals(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("go to approvals")
        assert result["route"] == "/approvals"

    def test_navigate_workflows(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("open workflows")
        assert result["route"] == "/workflows"

    def test_navigate_forms(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("go to forms")
        assert result["route"] == "/forms"

    def test_navigate_sla(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("navigate to sla")
        assert result["route"] == "/sla"

    def test_create_form_intent(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("create a new form for onboarding")
        assert result is not None
        assert result["intent"] == "create_form"

    def test_build_form_intent(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("build a form")
        assert result["intent"] == "create_form"

    def test_create_workflow_intent(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("create a workflow for approvals")
        assert result is not None
        assert result["intent"] == "create_workflow"

    def test_generate_workflow_intent(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("generate a new workflow")
        assert result["intent"] == "create_workflow"

    def test_summarize_case(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("summarize case XYZ789")
        assert result is not None
        assert result["intent"] == "summarize"
        assert result["case_id"] == "XYZ789"  # case preserved

    def test_query_intent(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("how many open cases are there?")
        assert result is not None
        assert result["intent"] == "query"

    def test_overdue_query(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("overdue tasks")
        assert result["intent"] == "query"

    def test_unknown_returns_none(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("hello there")
        assert result is None

    def test_case_insensitive(self):
        from agents.command_parser import parse_intent_fast
        result = parse_intent_fast("GO TO DASHBOARD")
        assert result is not None
        assert result["intent"] == "navigate"


class TestCommandParserAgent:
    """LLM-fallback command parser."""

    @pytest.mark.asyncio
    async def test_agent_name(self):
        from agents.command_parser import CommandParser
        parser = CommandParser()
        assert parser.name == "command_parser"

    @pytest.mark.asyncio
    async def test_fast_path_used(self):
        from agents.command_parser import CommandParser
        parser = CommandParser()
        result = await parser.run(message="go to dashboard")
        assert result["intent"] == "navigate"

    @pytest.mark.asyncio
    async def test_llm_fallback(self):
        from agents.command_parser import CommandParser
        from agents.providers.base import LLMResponse
        mock_resp = LLMResponse(
            content='{"intent":"query","action":"none","description":"general question"}',
            provider="mock",
        )
        with patch("agents.command_parser.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            parser = CommandParser()
            result = await parser.run(message="tell me something interesting")
            assert result["intent"] == "query"

    @pytest.mark.asyncio
    async def test_llm_malformed_json_fallback(self):
        from agents.command_parser import CommandParser
        from agents.providers.base import LLMResponse
        mock_resp = LLMResponse(
            content='Some text {"intent":"configure","action":"none","description":"settings"} trailing',
            provider="mock",
        )
        with patch("agents.command_parser.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            parser = CommandParser()
            result = await parser.run(message="change my settings please")
            assert result["intent"] == "configure"


# ═══════════════════════════════════════════════════════════
#  Form Builder Agent
# ═══════════════════════════════════════════════════════════

class TestFormBuilderAgent:
    @pytest.mark.asyncio
    async def test_agent_name(self):
        from agents.form_builder import FormBuilderAgent
        agent = FormBuilderAgent()
        assert agent.name == "form_builder"

    @pytest.mark.asyncio
    async def test_system_prompt_includes_field_types(self):
        from agents.form_builder import FormBuilderAgent
        agent = FormBuilderAgent()
        prompt = agent._build_system_prompt()
        assert "text" in prompt
        assert "email" in prompt
        assert "JSON" in prompt

    @pytest.mark.asyncio
    async def test_successful_generation(self):
        from agents.form_builder import FormBuilderAgent
        from agents.providers.base import LLMResponse
        form_json = json.dumps({
            "name": "Test Form",
            "description": "A test form",
            "sections": [{"id": "s1", "title": "Main", "order": 0}],
            "fields": [
                {"id": "name", "type": "text", "label": "Name",
                 "placeholder": "Enter name", "validation": {"required": True},
                 "order": 0, "section": "s1"},
                {"id": "email", "type": "email", "label": "Email",
                 "placeholder": "email@example.com", "validation": {"required": True},
                 "order": 1, "section": "s1"},
            ],
        })
        mock_resp = LLMResponse(content=form_json, provider="mock")
        with patch("agents.form_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = FormBuilderAgent()
            result = await agent.run(description="simple contact form")
            assert result["name"] == "Test Form"
            assert len(result["fields"]) == 2
            assert result["generated_by"] == "mock"

    @pytest.mark.asyncio
    async def test_invalid_field_type_filtered(self):
        from agents.form_builder import FormBuilderAgent
        from agents.providers.base import LLMResponse
        form_json = json.dumps({
            "name": "Bad Form",
            "sections": [],
            "fields": [
                {"id": "f1", "type": "text", "label": "Good"},
                {"id": "f2", "type": "unicorn_picker", "label": "Bad"},
            ],
        })
        mock_resp = LLMResponse(content=form_json, provider="mock")
        with patch("agents.form_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = FormBuilderAgent()
            result = await agent.run(description="form with bad fields")
            assert len(result["fields"]) == 1
            assert result["fields"][0]["type"] == "text"

    @pytest.mark.asyncio
    async def test_malformed_json_recovery(self):
        from agents.form_builder import FormBuilderAgent
        from agents.providers.base import LLMResponse
        mock_resp = LLMResponse(
            content='Here is a form: {"name":"Recovered","fields":[],"sections":[]} done!',
            provider="mock",
        )
        with patch("agents.form_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = FormBuilderAgent()
            result = await agent.run(description="test recovery")
            assert result["name"] == "Recovered"


# ═══════════════════════════════════════════════════════════
#  Workflow Builder Agent
# ═══════════════════════════════════════════════════════════

class TestWorkflowBuilderAgent:
    @pytest.mark.asyncio
    async def test_agent_name(self):
        from agents.workflow_builder import WorkflowBuilderAgent
        agent = WorkflowBuilderAgent()
        assert agent.name == "workflow_builder"

    @pytest.mark.asyncio
    async def test_system_prompt_includes_node_types(self):
        from agents.workflow_builder import WorkflowBuilderAgent
        agent = WorkflowBuilderAgent()
        prompt = agent._build_system_prompt()
        assert "start" in prompt
        assert "end" in prompt
        assert "task" in prompt
        assert "decision" in prompt
        assert "approval" in prompt

    @pytest.mark.asyncio
    async def test_successful_generation(self):
        from agents.workflow_builder import WorkflowBuilderAgent
        from agents.providers.base import LLMResponse
        wf_json = json.dumps({
            "name": "Leave Approval",
            "description": "Process leave requests",
            "definition": {
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Start", "position": {"x": 0, "y": 200}},
                    {"id": "n2", "type": "task", "label": "Review", "position": {"x": 250, "y": 200}},
                    {"id": "n3", "type": "approval", "label": "Approve", "position": {"x": 500, "y": 200}},
                    {"id": "n4", "type": "end", "label": "End", "position": {"x": 750, "y": 200}},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                    {"id": "e3", "source": "n3", "target": "n4", "label": "Approved"},
                ],
            },
        })
        mock_resp = LLMResponse(content=wf_json, provider="mock")
        with patch("agents.workflow_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = WorkflowBuilderAgent()
            result = await agent.run(description="leave approval workflow")
            assert result["name"] == "Leave Approval"
            assert len(result["definition"]["nodes"]) == 4
            assert len(result["definition"]["edges"]) == 3

    @pytest.mark.asyncio
    async def test_invalid_node_type_filtered(self):
        from agents.workflow_builder import WorkflowBuilderAgent
        from agents.providers.base import LLMResponse
        wf_json = json.dumps({
            "name": "Bad WF",
            "definition": {
                "nodes": [
                    {"id": "n1", "type": "start", "label": "Start", "position": {"x": 0, "y": 0}},
                    {"id": "n2", "type": "magic_node", "label": "Magic", "position": {"x": 100, "y": 0}},
                    {"id": "n3", "type": "end", "label": "End", "position": {"x": 200, "y": 0}},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                    {"id": "e2", "source": "n2", "target": "n3"},
                ],
            },
        })
        mock_resp = LLMResponse(content=wf_json, provider="mock")
        with patch("agents.workflow_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = WorkflowBuilderAgent()
            result = await agent.run(description="bad workflow")
            nodes = result["definition"]["nodes"]
            # magic_node filtered, only start and end remain
            assert all(n["type"] in ("start", "end") for n in nodes)
            # edge referencing n2 should be removed
            edges = result["definition"]["edges"]
            for e in edges:
                assert e["source"] in ("n1", "n3") and e["target"] in ("n1", "n3")

    @pytest.mark.asyncio
    async def test_ensures_start_and_end(self):
        from agents.workflow_builder import WorkflowBuilderAgent
        from agents.providers.base import LLMResponse
        wf_json = json.dumps({
            "name": "No Start/End",
            "definition": {
                "nodes": [
                    {"id": "n1", "type": "task", "label": "Task", "position": {"x": 100, "y": 100}},
                ],
                "edges": [],
            },
        })
        mock_resp = LLMResponse(content=wf_json, provider="mock")
        with patch("agents.workflow_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = WorkflowBuilderAgent()
            result = await agent.run(description="task only")
            types = [n["type"] for n in result["definition"]["nodes"]]
            assert "start" in types
            assert "end" in types


# ═══════════════════════════════════════════════════════════
#  Copilot Agent
# ═══════════════════════════════════════════════════════════

class TestCopilotAgent:
    @pytest.mark.asyncio
    async def test_agent_name(self):
        from agents.copilot import CopilotAgent
        agent = CopilotAgent()
        assert agent.name == "copilot"

    @pytest.mark.asyncio
    async def test_navigate_intent(self):
        from agents.copilot import CopilotAgent
        agent = CopilotAgent()
        result = await agent.run(message="go to dashboard")
        assert result["action"]["action"] == "navigate"
        assert result["action"]["route"] == "/dashboard"
        assert "reply" in result

    @pytest.mark.asyncio
    async def test_create_form_intent(self):
        from agents.copilot import CopilotAgent
        from agents.providers.base import LLMResponse
        form_json = json.dumps({
            "name": "Onboarding",
            "fields": [{"id": "f1", "type": "text", "label": "Name"}],
            "sections": [],
        })
        mock_resp = LLMResponse(content=form_json, provider="mock")
        with patch("agents.form_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = CopilotAgent()
            result = await agent.run(message="create a form for onboarding")
            assert result["action"]["action"] == "create_form"
            assert result["action"]["payload"]["name"] == "Onboarding"

    @pytest.mark.asyncio
    async def test_create_workflow_intent(self):
        from agents.copilot import CopilotAgent
        from agents.providers.base import LLMResponse
        wf_json = json.dumps({
            "name": "Approval WF",
            "definition": {
                "nodes": [
                    {"id": "n1", "type": "start", "label": "S", "position": {"x": 0, "y": 0}},
                    {"id": "n2", "type": "end", "label": "E", "position": {"x": 250, "y": 0}},
                ],
                "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
            },
        })
        mock_resp = LLMResponse(content=wf_json, provider="mock")
        with patch("agents.workflow_builder.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = CopilotAgent()
            result = await agent.run(message="create a workflow for approval")
            assert result["action"]["action"] == "create_workflow"
            assert "Approval" in result["action"]["payload"]["name"]

    @pytest.mark.asyncio
    async def test_summarize_no_case_id(self):
        from agents.copilot import CopilotAgent
        from agents.providers.base import LLMResponse
        # "summarize case" without ID falls to LLM since pattern needs \S+ after case
        mock_resp = LLMResponse(
            content='{"intent":"summarize","action":"none","case_id":null,"description":"summarize"}',
            provider="mock",
        )
        with patch("agents.command_parser.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = CopilotAgent()
            result = await agent.run(message="summarize a case")
        assert "case ID" in result["reply"] or result["action"] is None

    @pytest.mark.asyncio
    async def test_conversation_fallback(self):
        from agents.copilot import CopilotAgent
        from agents.providers.base import LLMResponse
        # "hello there" has no fast-path, so CommandParser also calls LLM
        parser_resp = LLMResponse(
            content='{"intent":"unknown","action":"none","description":"greeting"}',
            provider="mock",
        )
        chat_resp = LLMResponse(content="Hello! How can I help?", provider="mock")
        with patch("agents.command_parser.get_llm_client") as parser_mock, \
             patch("agents.copilot.get_llm_client") as copilot_mock:
            parser_mock.return_value.chat = AsyncMock(return_value=parser_resp)
            copilot_mock.return_value.chat = AsyncMock(return_value=chat_resp)
            agent = CopilotAgent()
            result = await agent.run(message="hello there")
            assert result["reply"] == "Hello! How can I help?"
            assert result["action"] is None


class TestCopilotStreaming:
    @pytest.mark.asyncio
    async def test_stream_navigate(self):
        from agents.copilot import CopilotAgent
        agent = CopilotAgent()
        events = []
        async for line in agent.stream(message="go to dashboard"):
            events.append(json.loads(line))
        types = [e["type"] for e in events]
        assert "action" in types
        assert "done" in types

    @pytest.mark.asyncio
    async def test_stream_conversation(self):
        from agents.copilot import CopilotAgent
        from agents.providers.base import LLMResponse

        parser_resp = LLMResponse(
            content='{"intent":"unknown","action":"none","description":"greeting"}',
            provider="mock",
        )

        async def mock_stream(msgs, **kw):
            for chunk in ["Hello", " world"]:
                yield chunk

        with patch("agents.command_parser.get_llm_client") as parser_mock, \
             patch("agents.copilot.get_llm_client") as copilot_mock:
            parser_mock.return_value.chat = AsyncMock(return_value=parser_resp)
            copilot_mock.return_value.stream = mock_stream
            agent = CopilotAgent()
            events = []
            async for line in agent.stream(message="hi there friend"):
                events.append(json.loads(line))
            types = [e["type"] for e in events]
            assert "delta" in types
            assert "done" in types


# ═══════════════════════════════════════════════════════════
#  Routing Agent
# ═══════════════════════════════════════════════════════════

class TestRoutingAgent:
    @pytest.mark.asyncio
    async def test_agent_name(self):
        from agents.routing import RoutingAgent
        agent = RoutingAgent()
        assert agent.name == "routing"

    @pytest.mark.asyncio
    async def test_missing_case(self, patched_db):
        from agents.routing import RoutingAgent
        agent = RoutingAgent()
        result = await agent.run(case_id="nonexistent")
        assert "error" in result or result.get("suggestions") == []

    @pytest.mark.asyncio
    async def test_routing_with_data(self, patched_db):
        from agents.routing import RoutingAgent
        from agents.providers.base import LLMResponse

        await seed_case_type(patched_db)
        case = await seed_case(patched_db)
        # Seed users
        await patched_db.users.insert_many([
            {"_id": "u1", "name": "Alice", "email": "alice@test.com", "role": "MANAGER", "is_active": True},
            {"_id": "u2", "name": "Bob", "email": "bob@test.com", "role": "AGENT", "is_active": True},
        ])
        # Seed tasks for workload
        await patched_db.tasks.insert_many([
            {"_id": "t1", "assigned_to": "u2", "status": "open"},
            {"_id": "t2", "assigned_to": "u2", "status": "in_progress"},
        ])

        routing_json = json.dumps({
            "suggestions": [
                {"user_id": "u1", "user_name": "Alice", "score": 0.9,
                 "reasons": ["Lower workload", "Manager role"]},
                {"user_id": "u2", "user_name": "Bob", "score": 0.6,
                 "reasons": ["Available agent"]},
            ],
        })
        mock_resp = LLMResponse(content=routing_json, provider="mock")
        with patch("agents.routing.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            agent = RoutingAgent()
            result = await agent.run(case_id=case["_id"])
            assert len(result["suggestions"]) == 2
            assert result["suggestions"][0]["user_id"] == "u1"
            assert result["suggestions"][0]["score"] == 0.9


# ═══════════════════════════════════════════════════════════
#  Route Integration Tests
# ═══════════════════════════════════════════════════════════

class TestCopilotRoutes:
    @pytest.mark.asyncio
    async def test_copilot_chat_endpoint(self, client, patched_db):
        from agents.providers.base import LLMResponse

        await seed_test_user(patched_db)
        parser_resp = LLMResponse(
            content='{"intent":"unknown","action":"none","description":"greeting"}',
            provider="mock",
        )
        chat_resp = LLMResponse(content="I can help with that!", provider="mock")

        with patch("agents.command_parser.get_llm_client") as parser_mock, \
             patch("agents.copilot.get_llm_client") as copilot_mock:
            parser_mock.return_value.chat = AsyncMock(return_value=parser_resp)
            copilot_mock.return_value.chat = AsyncMock(return_value=chat_resp)
            resp = await client.post(
                "/api/ai/copilot",
                json={"message": "hello"},
                headers=auth_header(),
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "reply" in data
        assert "action" in data

    @pytest.mark.asyncio
    async def test_copilot_navigate(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post(
            "/api/ai/copilot",
            json={"message": "go to dashboard"},
            headers=auth_header(),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["action"]["action"] == "navigate"
        assert data["action"]["route"] == "/dashboard"

    @pytest.mark.asyncio
    async def test_copilot_stream_endpoint(self, client, patched_db):
        await seed_test_user(patched_db)
        # Navigation messages complete without LLM call
        resp = await client.post(
            "/api/ai/copilot/stream",
            json={"message": "go to tasks"},
            headers=auth_header(),
        )
        assert resp.status_code == 200
        # SSE response
        assert "text/event-stream" in resp.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_copilot_action_create_form(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post(
            "/api/ai/copilot/action",
            json={
                "action": "create_form",
                "payload": {
                    "name": "Test Form",
                    "description": "desc",
                    "sections": [],
                    "fields": [{"id": "f1", "type": "text", "label": "Name"}],
                },
            },
            headers=auth_header(),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "created"
        assert data["type"] == "form"
        assert data["id"]

    @pytest.mark.asyncio
    async def test_copilot_action_create_workflow(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post(
            "/api/ai/copilot/action",
            json={
                "action": "create_workflow",
                "payload": {
                    "name": "Test WF",
                    "description": "desc",
                    "definition": {"nodes": [], "edges": []},
                },
            },
            headers=auth_header(),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "created"
        assert data["type"] == "workflow"

    @pytest.mark.asyncio
    async def test_copilot_action_unknown(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post(
            "/api/ai/copilot/action",
            json={"action": "magic", "payload": {}},
            headers=auth_header(),
        )
        assert resp.status_code == 400


class TestRoutingRoutes:
    @pytest.mark.asyncio
    async def test_route_suggest(self, client, patched_db):
        from agents.providers.base import LLMResponse

        await seed_test_user(patched_db)
        await seed_case_type(patched_db)
        case = await seed_case(patched_db)
        await patched_db.users.insert_one(
            {"_id": "u1", "name": "Agent A", "email": "a@test.com", "role": "AGENT", "is_active": True}
        )

        routing_json = json.dumps({
            "suggestions": [
                {"user_id": "u1", "user_name": "Agent A", "score": 0.85,
                 "reasons": ["Available"]},
            ],
        })
        mock_resp = LLMResponse(content=routing_json, provider="mock")
        with patch("agents.routing.get_llm_client") as mock_client:
            mock_client.return_value.chat = AsyncMock(return_value=mock_resp)
            resp = await client.post(
                f"/api/ai/route/{case['_id']}",
                headers=auth_header(),
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["case_id"] == case["_id"]
        assert len(data["suggestions"]) == 1

    @pytest.mark.asyncio
    async def test_route_case_not_found(self, client, patched_db):
        from agents.providers.base import LLMResponse

        await seed_test_user(patched_db)
        resp = await client.post(
            "/api/ai/route/nonexistent",
            headers=auth_header(),
        )
        # Either 404 or 502 depending on the error path
        assert resp.status_code in (404, 502)


# ═══════════════════════════════════════════════════════════
#  YAML Palette Loaders
# ═══════════════════════════════════════════════════════════

class TestYAMLPalettes:
    def test_form_field_palette_loads(self):
        from agents.form_builder import _load_field_palette
        fields = _load_field_palette()
        assert len(fields) > 0
        types = {f["type"] for f in fields}
        assert "text" in types
        assert "email" in types

    def test_workflow_node_palette_loads(self):
        from agents.workflow_builder import _load_node_palette
        nodes = _load_node_palette()
        assert len(nodes) > 0
        types = {n["type"] for n in nodes}
        assert "start" in types
        assert "end" in types
        assert "task" in types
        assert "approval" in types

    def test_valid_node_types(self):
        from agents.workflow_builder import _valid_node_types
        types = _valid_node_types()
        assert "start" in types
        assert "decision" in types
