"""Tests for YAML palette config API and LLM config endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import seed_test_user, auth_header


class TestFormFieldsConfig:
    @pytest.mark.asyncio
    async def test_get_form_fields(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/config/form-fields", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert "fields" in data
        assert "categories" in data
        assert len(data["fields"]) > 0
        # Verify expected field types exist
        types = [f["type"] for f in data["fields"]]
        assert "text" in types
        assert "select" in types
        assert "file" in types
        assert "email" in types

    @pytest.mark.asyncio
    async def test_form_fields_have_required_keys(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/config/form-fields", headers=auth_header())
        for field in resp.json()["fields"]:
            assert "type" in field
            assert "label" in field
            assert "icon" in field
            assert "category" in field
            assert "defaultProps" in field

    @pytest.mark.asyncio
    async def test_form_fields_categories_ordered(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/config/form-fields", headers=auth_header())
        categories = resp.json()["categories"]
        orders = [c["order"] for c in categories]
        assert orders == sorted(orders)


class TestWorkflowNodesConfig:
    @pytest.mark.asyncio
    async def test_get_workflow_nodes(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/config/workflow-nodes", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data
        assert "categories" in data
        types = [n["type"] for n in data["nodes"]]
        assert "start" in types
        assert "end" in types
        assert "task" in types
        assert "decision" in types

    @pytest.mark.asyncio
    async def test_workflow_nodes_have_required_keys(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/config/workflow-nodes", headers=auth_header())
        for node in resp.json()["nodes"]:
            assert "type" in node
            assert "label" in node
            assert "category" in node
            assert "allowedNext" in node
            assert "properties" in node

    @pytest.mark.asyncio
    async def test_start_node_is_singleton(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/config/workflow-nodes", headers=auth_header())
        start_node = [n for n in resp.json()["nodes"] if n["type"] == "start"][0]
        assert start_node["singleton"] is True


class TestLLMConfig:
    @pytest.mark.asyncio
    async def test_get_active_provider(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/config/llm/active", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert "active_provider" in data
        assert "label" in data
        assert "type" in data

    @pytest.mark.asyncio
    async def test_get_full_llm_config_requires_admin(self, client, patched_db):
        # Seed a WORKER user — should be denied
        await seed_test_user(patched_db, user_id="worker-1", email="worker@test.com",
                              name="Bob Worker", role="WORKER")
        from tests.conftest import make_token
        worker_token = make_token("worker-1")
        resp = await client.get("/api/config/llm",
                                 headers={"Authorization": f"Bearer {worker_token}"})
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_get_full_llm_config_as_manager(self, client, patched_db):
        await seed_test_user(patched_db)  # default is MANAGER
        resp = await client.get("/api/config/llm", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert "providers" in data
        assert "active_provider" in data
