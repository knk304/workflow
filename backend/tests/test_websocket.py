"""Tests for WebSocket connection manager logic (unit-level)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from routes.websocket import ConnectionManager


class TestConnectionManager:
    def setup_method(self):
        self.manager = ConnectionManager()

    @pytest.mark.asyncio
    async def test_connect_adds_to_active(self):
        ws = AsyncMock()
        user = {"id": "u1", "name": "Alice", "role": "MANAGER"}
        await self.manager.connect("case-1", ws, user)
        assert "case-1" in self.manager.active_connections
        assert len(self.manager.active_connections["case-1"]) == 1

    @pytest.mark.asyncio
    async def test_connect_broadcasts_user_joined(self):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        user1 = {"id": "u1", "name": "Alice", "role": "MANAGER"}
        user2 = {"id": "u2", "name": "Bob", "role": "WORKER"}
        await self.manager.connect("case-1", ws1, user1)
        await self.manager.connect("case-1", ws2, user2)
        # ws1 should have received broadcast about ws2 joining
        call_args = ws1.send_text.call_args_list
        assert len(call_args) >= 1
        msg = json.loads(call_args[-1][0][0])
        assert msg["type"] == "user_joined"
        assert msg["user"]["id"] == "u2"

    def test_disconnect_removes_from_active(self):
        ws = AsyncMock()
        user = {"id": "u1", "name": "Alice", "role": "MANAGER"}
        self.manager.active_connections["case-1"] = [(ws, user)]
        self.manager.disconnect("case-1", ws)
        assert "case-1" not in self.manager.active_connections

    def test_disconnect_nonexistent_case(self):
        ws = AsyncMock()
        result = self.manager.disconnect("nonexistent", ws)
        assert result is None

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all_except_sender(self):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        ws3 = AsyncMock()
        self.manager.active_connections["case-1"] = [
            (ws1, {"id": "u1"}),
            (ws2, {"id": "u2"}),
            (ws3, {"id": "u3"}),
        ]
        msg = {"type": "task_updated", "payload": {"taskId": "t1"}}
        await self.manager.broadcast("case-1", msg, exclude=ws1)
        ws1.send_text.assert_not_called()
        ws2.send_text.assert_called_once()
        ws3.send_text.assert_called_once()

    def test_get_viewers_deduplicates(self):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        user = {"id": "u1", "name": "Alice", "role": "MANAGER"}
        self.manager.active_connections["case-1"] = [
            (ws1, user),
            (ws2, user),  # same user with two connections
        ]
        viewers = self.manager._get_viewers("case-1")
        assert len(viewers) == 1

    def test_get_viewer_count(self):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        self.manager.active_connections["case-1"] = [
            (ws1, {"id": "u1"}),
            (ws2, {"id": "u2"}),
        ]
        assert self.manager.get_viewer_count("case-1") == 2
        assert self.manager.get_viewer_count("nonexistent") == 0

    @pytest.mark.asyncio
    async def test_broadcast_handles_broken_connections(self):
        ws_ok = AsyncMock()
        ws_broken = AsyncMock()
        ws_broken.send_text.side_effect = Exception("Connection closed")
        self.manager.active_connections["case-1"] = [
            (ws_ok, {"id": "u1"}),
            (ws_broken, {"id": "u2"}),
        ]
        msg = {"type": "test"}
        await self.manager.broadcast("case-1", msg)
        # Broken connection should be cleaned up
        ws_ok.send_text.assert_called_once()
        remaining_ids = [ui["id"] for _, ui in self.manager.active_connections.get("case-1", [])]
        assert "u2" not in remaining_ids
