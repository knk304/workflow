"""Tests for routes/case_types.py — hierarchical CRUD (Sprint B)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import seed_test_user, seed_case_type_definition, auth_header


class TestCaseTypeCRUD:
    @pytest.mark.asyncio
    async def test_create_case_type(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/case-types", json={
            "name": "New Type",
            "slug": "new-type",
            "prefix": "NT",
            "stages": [{
                "id": "s1", "name": "Stage 1", "stage_type": "primary", "order": 1,
                "on_complete": "resolve_case", "resolution_status": "resolved_completed",
                "processes": [{
                    "id": "p1", "name": "Process 1", "type": "sequential", "order": 1,
                    "steps": [{
                        "id": "st1", "name": "Step 1", "type": "assignment", "order": 1,
                    }],
                }],
            }],
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New Type"
        assert data["prefix"] == "NT"
        assert len(data["stages"]) == 1
        assert data["version"] == 1

    @pytest.mark.asyncio
    async def test_create_duplicate_slug(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post("/api/case-types", json={
            "name": "Dup", "slug": "test-loan",
        }, headers=auth_header())
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_list_case_types(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.get("/api/case-types", headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    @pytest.mark.asyncio
    async def test_get_case_type(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.get("/api/case-types/test-loan", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Loan"
        assert len(data["stages"]) == 3

    @pytest.mark.asyncio
    async def test_get_case_type_not_found(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/case-types/nonexistent", headers=auth_header())
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_case_type(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.patch("/api/case-types/test-loan", json={
            "name": "Updated Loan",
            "description": "Updated description",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Loan"
        assert resp.json()["version"] == 2

    @pytest.mark.asyncio
    async def test_soft_delete(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.delete("/api/case-types/test-loan", headers=auth_header())
        assert resp.status_code == 204
        # Should still exist but is_active=False
        doc = await patched_db.case_type_definitions.find_one({"_id": "test-loan"})
        assert doc is not None
        assert doc["is_active"] is False


class TestStageSubResource:
    @pytest.mark.asyncio
    async def test_add_stage(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post("/api/case-types/test-loan/stages", json={
            "id": "stage-new", "name": "New Stage", "stage_type": "alternate",
            "order": 99, "on_complete": "resolve_case",
            "resolution_status": "resolved_completed", "processes": [],
        }, headers=auth_header())
        assert resp.status_code == 201
        assert resp.json()["id"] == "stage-new"

    @pytest.mark.asyncio
    async def test_add_duplicate_stage(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post("/api/case-types/test-loan/stages", json={
            "id": "stage-create", "name": "Dup", "stage_type": "primary",
            "order": 1, "on_complete": "auto_advance", "processes": [],
        }, headers=auth_header())
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_update_stage(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.patch("/api/case-types/test-loan/stages/stage-create", json={
            "name": "Renamed Create",
        }, headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed Create"

    @pytest.mark.asyncio
    async def test_delete_stage(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.delete("/api/case-types/test-loan/stages/stage-create", headers=auth_header())
        assert resp.status_code == 204
        doc = await patched_db.case_type_definitions.find_one({"_id": "test-loan"})
        stage_ids = [s["id"] for s in doc["stages"]]
        assert "stage-create" not in stage_ids


class TestProcessSubResource:
    @pytest.mark.asyncio
    async def test_add_process(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post("/api/case-types/test-loan/stages/stage-create/processes", json={
            "id": "proc-new", "name": "New Proc", "type": "sequential",
            "order": 2, "steps": [],
        }, headers=auth_header())
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_delete_process(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.delete(
            "/api/case-types/test-loan/stages/stage-create/processes/proc-intake",
            headers=auth_header(),
        )
        assert resp.status_code == 204


class TestStepSubResource:
    @pytest.mark.asyncio
    async def test_add_step(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post(
            "/api/case-types/test-loan/stages/stage-create/processes/proc-intake/steps",
            json={"id": "step-new", "name": "New Step", "type": "assignment", "order": 2},
            headers=auth_header(),
        )
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_delete_step(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.delete(
            "/api/case-types/test-loan/stages/stage-create/processes/proc-intake/steps/step-fill-form",
            headers=auth_header(),
        )
        assert resp.status_code == 204


class TestValidateAndDuplicate:
    @pytest.mark.asyncio
    async def test_validate_valid_type(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post("/api/case-types/test-loan/validate", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        # stage-complete has on_complete=resolve_case with resolution_status set
        assert data["valid"] is True
        assert data["errors"] == []

    @pytest.mark.asyncio
    async def test_validate_empty_type(self, client, patched_db):
        await seed_test_user(patched_db)
        # Create a type with no stages
        await client.post("/api/case-types", json={
            "name": "Empty", "slug": "empty-type", "stages": [],
        }, headers=auth_header())
        resp = await client.post("/api/case-types/empty-type/validate", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["valid"] is False

    @pytest.mark.asyncio
    async def test_duplicate(self, client, patched_db):
        await seed_test_user(patched_db)
        await seed_case_type_definition(patched_db)
        resp = await client.post("/api/case-types/test-loan/duplicate", headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert "Copy" in data["name"]
        assert data["id"] != "test-loan"
        assert len(data["stages"]) == 3
