"""Cached Temporal client — shared by the API and, when run locally, the worker."""

from __future__ import annotations

from temporalio.client import Client

from config import get_settings

_client: Client | None = None


async def get_temporal_client() -> Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = await Client.connect(
            settings.temporal_host,
            namespace=settings.temporal_namespace,
        )
    return _client


async def close_temporal_client() -> None:
    global _client
    # temporalio Client does not require explicit close, but we reset the reference
    _client = None
