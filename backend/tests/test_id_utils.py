"""Tests for id_utils.py — MongoDB ID lookup helpers."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from bson import ObjectId
from id_utils import to_query_id, find_by_id, update_by_id, delete_by_id


class TestToQueryId:
    def test_valid_objectid_string(self):
        oid = str(ObjectId())
        result = to_query_id(oid)
        assert "$or" in result
        assert len(result["$or"]) == 2

    def test_plain_string_id(self):
        result = to_query_id("user-test1")
        assert result == {"_id": "user-test1"}

    def test_empty_string(self):
        result = to_query_id("")
        assert result == {"_id": ""}


class TestFindById:
    @pytest.mark.asyncio
    async def test_find_by_string_id(self, mock_db):
        await mock_db.items.insert_one({"_id": "item-1", "name": "Test"})
        doc = await find_by_id(mock_db.items, "item-1")
        assert doc is not None
        assert doc["name"] == "Test"

    @pytest.mark.asyncio
    async def test_find_by_objectid(self, mock_db):
        oid = ObjectId()
        await mock_db.items.insert_one({"_id": oid, "name": "ObjTest"})
        doc = await find_by_id(mock_db.items, str(oid))
        assert doc is not None
        assert doc["name"] == "ObjTest"

    @pytest.mark.asyncio
    async def test_find_nonexistent_returns_none(self, mock_db):
        doc = await find_by_id(mock_db.items, "nonexistent")
        assert doc is None


class TestUpdateById:
    @pytest.mark.asyncio
    async def test_update_string_id(self, mock_db):
        await mock_db.items.insert_one({"_id": "item-1", "val": 1})
        result = await update_by_id(mock_db.items, "item-1", {"$set": {"val": 2}})
        assert result.modified_count == 1
        doc = await mock_db.items.find_one({"_id": "item-1"})
        assert doc["val"] == 2


class TestDeleteById:
    @pytest.mark.asyncio
    async def test_delete_string_id(self, mock_db):
        await mock_db.items.insert_one({"_id": "item-1", "val": 1})
        result = await delete_by_id(mock_db.items, "item-1")
        assert result.deleted_count == 1
        doc = await mock_db.items.find_one({"_id": "item-1"})
        assert doc is None
