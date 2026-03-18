"""Integration tests for notification and comment endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import seed_test_user, auth_header


class TestNotifications:
    @pytest.mark.asyncio
    async def test_create_notification(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/notifications", json={
            "userId": "user-test1",
            "type": "assignment",
            "title": "New task",
            "message": "You have a new task",
            "entityType": "task",
            "entityId": "task-001",
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        assert data["isRead"] is False
        assert data["type"] == "assignment"

    @pytest.mark.asyncio
    async def test_list_own_notifications(self, client, patched_db):
        await seed_test_user(patched_db)
        # Insert directly
        await patched_db.notifications.insert_one({
            "_id": "n1", "userId": "user-test1", "type": "mention",
            "title": "Mentioned", "message": "You were mentioned",
            "entityType": "case", "entityId": "case-1",
            "isRead": False, "readAt": None,
            "createdAt": "2026-01-01T00:00:00+00:00",
        })
        await patched_db.notifications.insert_one({
            "_id": "n2", "userId": "other-user", "type": "mention",
            "title": "Other", "message": "Not yours",
            "entityType": "case", "entityId": "case-2",
            "isRead": False, "readAt": None,
            "createdAt": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.get("/api/notifications", headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        # Should only see own notifications
        assert len(data) == 1
        assert data[0]["userId"] == "user-test1"

    @pytest.mark.asyncio
    async def test_mark_as_read(self, client, patched_db):
        await seed_test_user(patched_db)
        await patched_db.notifications.insert_one({
            "_id": "n1", "userId": "user-test1", "type": "mention",
            "title": "Mentioned", "message": "You were mentioned",
            "entityType": "case", "entityId": "case-1",
            "isRead": False, "readAt": None,
            "createdAt": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.patch("/api/notifications/n1/read",
                                   headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["isRead"] is True
        assert resp.json()["readAt"] is not None


class TestComments:
    @pytest.mark.asyncio
    async def test_add_comment(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/comments", json={
            "caseId": "case-001",
            "userId": "user-test1",
            "userName": "Alice Test",
            "text": "This is a test comment",
            "mentions": [],
        }, headers=auth_header())
        assert resp.status_code == 201
        assert resp.json()["text"] == "This is a test comment"

    @pytest.mark.asyncio
    async def test_comment_ignores_body_user_identity(self, client, patched_db):
        """Verify the impersonation fix: userId/userName come from auth, not body."""
        await seed_test_user(patched_db)
        resp = await client.post("/api/comments", json={
            "caseId": "case-001",
            "userId": "attacker-id",
            "userName": "Evil Hacker",
            "text": "Trying to impersonate",
            "mentions": [],
        }, headers=auth_header())
        assert resp.status_code == 201
        data = resp.json()
        # Should use authenticated user, NOT the body values
        assert data["userId"] == "user-test1"
        assert data["userName"] == "Alice Test"

    @pytest.mark.asyncio
    async def test_list_comments_by_case(self, client, patched_db):
        await seed_test_user(patched_db)
        await patched_db.comments.insert_one({
            "_id": "c1", "caseId": "case-001", "taskId": None,
            "userId": "user-test1", "userName": "Alice",
            "text": "Comment 1", "mentions": [],
            "createdAt": "2026-01-01T00:00:00+00:00",
            "updatedAt": "2026-01-01T00:00:00+00:00",
        })
        await patched_db.comments.insert_one({
            "_id": "c2", "caseId": "case-002", "taskId": None,
            "userId": "user-test1", "userName": "Alice",
            "text": "Comment 2", "mentions": [],
            "createdAt": "2026-01-01T00:00:00+00:00",
            "updatedAt": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.get("/api/comments?caseId=case-001",
                                 headers=auth_header())
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @pytest.mark.asyncio
    async def test_comment_with_mentions(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.post("/api/comments", json={
            "caseId": "case-001",
            "userId": "user-test1",
            "userName": "Alice Test",
            "text": "Hey @bob check this",
            "mentions": [{"id": "user-bob", "name": "Bob"}],
        }, headers=auth_header())
        assert resp.status_code == 201
        assert len(resp.json()["mentions"]) == 1
