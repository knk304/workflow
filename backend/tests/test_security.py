"""Tests for security.py — password hashing and JWT tokens."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("secret123")
        assert hashed != "secret123"
        assert verify_password("secret123", hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_different_hashes_each_time(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt salts differ


class TestJWT:
    def test_access_token_roundtrip(self):
        token = create_access_token({"sub": "user-1", "role": "ADMIN"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"
        assert payload["role"] == "ADMIN"
        assert payload["type"] == "access"

    def test_refresh_token_roundtrip(self):
        token = create_refresh_token({"sub": "user-2"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-2"
        assert payload["type"] == "refresh"

    def test_invalid_token_returns_none(self):
        assert decode_token("garbage.token.value") is None
        assert decode_token("") is None

    def test_access_token_has_expiry(self):
        token = create_access_token({"sub": "u1"})
        payload = decode_token(token)
        assert "exp" in payload

    def test_tampered_token_fails(self):
        token = create_access_token({"sub": "u1"})
        tampered = token[:-5] + "XXXXX"
        assert decode_token(tampered) is None
