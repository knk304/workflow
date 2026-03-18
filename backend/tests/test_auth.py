"""Integration tests for auth endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from tests.conftest import seed_test_user, auth_header


class TestRegister:
    @pytest.mark.asyncio
    async def test_register_success(self, client):
        resp = await client.post("/api/auth/register", json={
            "email": "new@test.com",
            "password": "secret123",
            "name": "New User",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["email"] == "new@test.com"
        assert data["user"]["role"] == "WORKER"
        assert "token" in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client, patched_db):
        await seed_test_user(patched_db, email="dup@test.com")
        resp = await client.post("/api/auth/register", json={
            "email": "dup@test.com",
            "password": "secret123",
            "name": "Dup User",
        })
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_register_short_password(self, client):
        resp = await client.post("/api/auth/register", json={
            "email": "x@test.com",
            "password": "abc",
            "name": "Short",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client):
        resp = await client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "secret123",
            "name": "Bad Email",
        })
        assert resp.status_code == 422


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_success(self, client, patched_db):
        await seed_test_user(patched_db, email="alice@test.com", password="demo123")
        resp = await client.post("/api/auth/login", json={
            "email": "alice@test.com",
            "password": "demo123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "refreshToken" in data
        assert data["user"]["email"] == "alice@test.com"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client, patched_db):
        await seed_test_user(patched_db, email="alice@test.com", password="demo123")
        resp = await client.post("/api/auth/login", json={
            "email": "alice@test.com",
            "password": "wrongpass",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        resp = await client.post("/api/auth/login", json={
            "email": "ghost@test.com",
            "password": "anything",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_inactive_user(self, client, patched_db):
        from security import hash_password
        await patched_db.users.insert_one({
            "_id": "user-inactive",
            "email": "inactive@test.com",
            "name": "Inactive",
            "role": "WORKER",
            "team_ids": [],
            "hashed_password": hash_password("demo123"),
            "is_active": False,
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        resp = await client.post("/api/auth/login", json={
            "email": "inactive@test.com",
            "password": "demo123",
        })
        assert resp.status_code == 403


class TestRefresh:
    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client, patched_db):
        await seed_test_user(patched_db)
        from security import create_refresh_token
        refresh = create_refresh_token({"sub": "user-test1"})
        resp = await client.post("/api/auth/refresh", json={
            "refreshToken": refresh,
        })
        assert resp.status_code == 200
        assert "token" in resp.json()

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_fails(self, client, patched_db):
        await seed_test_user(patched_db)
        from security import create_access_token
        access = create_access_token({"sub": "user-test1", "role": "MANAGER"})
        resp = await client.post("/api/auth/refresh", json={
            "refreshToken": access,
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token(self, client):
        resp = await client.post("/api/auth/refresh", json={
            "refreshToken": "invalid.token.here",
        })
        assert resp.status_code == 401


class TestMe:
    @pytest.mark.asyncio
    async def test_get_me_authenticated(self, client, patched_db):
        await seed_test_user(patched_db)
        resp = await client.get("/api/auth/me", headers=auth_header())
        assert resp.status_code == 200
        assert resp.json()["email"] == "alice@test.com"

    @pytest.mark.asyncio
    async def test_get_me_no_token(self, client):
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 403  # HTTPBearer returns 403 when no token


class TestLogout:
    @pytest.mark.asyncio
    async def test_logout(self, client):
        resp = await client.post("/api/auth/logout")
        assert resp.status_code == 200
