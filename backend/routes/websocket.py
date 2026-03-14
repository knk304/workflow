"""WebSocket real-time collaboration — per-case channels with presence."""

import json
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from security import decode_token

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Manages WebSocket connections per case."""

    def __init__(self):
        # case_id -> list of (websocket, user_info) tuples
        self.active_connections: dict[str, list[tuple[WebSocket, dict]]] = {}

    async def connect(self, case_id: str, websocket: WebSocket, user_info: dict):
        await websocket.accept()
        if case_id not in self.active_connections:
            self.active_connections[case_id] = []
        self.active_connections[case_id].append((websocket, user_info))

        # Broadcast presence join
        await self.broadcast(case_id, {
            "type": "user_joined",
            "user": user_info,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "viewers": self._get_viewers(case_id),
        }, exclude=websocket)

    def disconnect(self, case_id: str, websocket: WebSocket):
        if case_id in self.active_connections:
            user_info = None
            self.active_connections[case_id] = [
                (ws, ui) for ws, ui in self.active_connections[case_id]
                if ws != websocket or not (user_info := ui) is None  # capture user_info
            ]
            # Find the user_info of the disconnected socket
            # (captured above is unreliable, re-scan)
            if not self.active_connections[case_id]:
                del self.active_connections[case_id]
            return user_info
        return None

    async def broadcast(self, case_id: str, message: dict, exclude: WebSocket | None = None):
        if case_id not in self.active_connections:
            return
        data = json.dumps(message)
        disconnected = []
        for ws, ui in self.active_connections[case_id]:
            if ws == exclude:
                continue
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        # Clean up broken connections
        for ws in disconnected:
            self.disconnect(case_id, ws)

    def _get_viewers(self, case_id: str) -> list[dict]:
        if case_id not in self.active_connections:
            return []
        seen = set()
        viewers = []
        for _, ui in self.active_connections[case_id]:
            if ui["id"] not in seen:
                seen.add(ui["id"])
                viewers.append(ui)
        return viewers

    def get_viewer_count(self, case_id: str) -> int:
        return len(self.active_connections.get(case_id, []))


manager = ConnectionManager()


@router.websocket("/ws/cases/{case_id}")
async def case_websocket(
    websocket: WebSocket,
    case_id: str,
    token: str = Query(...),
):
    # Authenticate via token
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_info = {
        "id": payload.get("sub", ""),
        "name": payload.get("name", "Unknown"),
        "role": payload.get("role", "WORKER"),
    }

    await manager.connect(case_id, websocket, user_info)

    # Send initial presence list
    try:
        await websocket.send_text(json.dumps({
            "type": "presence",
            "viewers": manager._get_viewers(case_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }))
    except Exception:
        manager.disconnect(case_id, websocket)
        return

    # Message loop with heartbeat
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60)
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_text(json.dumps({"type": "heartbeat"}))
                except Exception:
                    break
                continue

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type", "")

            if msg_type == "heartbeat":
                continue
            elif msg_type == "task_updated":
                await manager.broadcast(case_id, {
                    "type": "task_updated",
                    "payload": message.get("payload", {}),
                    "user": user_info,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }, exclude=websocket)
            elif msg_type == "comment_added":
                await manager.broadcast(case_id, {
                    "type": "comment_added",
                    "payload": message.get("payload", {}),
                    "user": user_info,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }, exclude=websocket)
            elif msg_type == "case_updated":
                await manager.broadcast(case_id, {
                    "type": "case_updated",
                    "payload": message.get("payload", {}),
                    "user": user_info,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }, exclude=websocket)

    except WebSocketDisconnect:
        pass
    finally:
        user_info_disconnected = user_info
        manager.disconnect(case_id, websocket)
        await manager.broadcast(case_id, {
            "type": "user_left",
            "user": user_info_disconnected,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "viewers": manager._get_viewers(case_id),
        })
