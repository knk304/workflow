"""Configuration API — serves YAML palette configs and LLM provider settings."""

import os
import yaml
from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status

from auth_deps import get_current_user, require_roles

router = APIRouter(prefix="/api/config", tags=["config"])

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def _load_yaml(filename: str) -> dict:
    """Load and parse a YAML config file from the config directory."""
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Config file {filename} not found")
    with open(filepath, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _resolve_env_vars(obj):
    """Recursively resolve ${ENV_VAR} and ${ENV_VAR:-default} placeholders."""
    if isinstance(obj, str):
        import re
        def _replace(match):
            var = match.group(1)
            if ":-" in var:
                name, default = var.split(":-", 1)
                return os.environ.get(name, default)
            return os.environ.get(var, match.group(0))
        return re.sub(r"\$\{([^}]+)\}", _replace, obj)
    elif isinstance(obj, dict):
        return {k: _resolve_env_vars(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_resolve_env_vars(item) for item in obj]
    return obj


# ── Form Fields Palette ──────────────────────────────────

@router.get("/form-fields")
async def get_form_fields(user: dict = Depends(get_current_user)):
    """Return form field palette config for UI and AI agents."""
    data = _load_yaml("form_fields.yaml")
    return data


# ── Workflow Nodes Palette ───────────────────────────────

@router.get("/workflow-nodes")
async def get_workflow_nodes(user: dict = Depends(get_current_user)):
    """Return workflow node palette config for UI and AI agents."""
    data = _load_yaml("workflow_nodes.yaml")
    return data


# ── LLM Provider Config ─────────────────────────────────

def _get_llm_config() -> dict:
    """Load LLM config with env vars resolved."""
    raw = _load_yaml("llm_providers.yaml")
    return _resolve_env_vars(raw)


@router.get("/llm")
async def get_llm_config(user: dict = Depends(require_roles("ADMIN", "MANAGER"))):
    """Return LLM provider configuration (admin only).

    Sensitive fields (API keys) are masked in the response.
    """
    config = _get_llm_config()
    # Mask secrets in response
    safe = _mask_secrets(config)
    return safe


@router.get("/llm/active")
async def get_active_provider(user: dict = Depends(get_current_user)):
    """Return just the active provider name and label."""
    config = _get_llm_config()
    active_name = config.get("active_provider", "openai")
    provider = config.get("providers", {}).get(active_name, {})
    return {
        "active_provider": active_name,
        "label": provider.get("label", active_name),
        "type": provider.get("type", "unknown"),
        "model": provider.get("model"),
        "streaming": provider.get("streaming", False),
    }


@router.patch("/llm/active")
async def set_active_provider(
    body: dict,
    user: dict = Depends(require_roles("ADMIN")),
):
    """Switch the active LLM provider (admin only).

    Updates the YAML config file. Body: { "provider": "openai" | "azure" | "ollama" | "custom" }
    """
    provider_name = body.get("provider")
    if not provider_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "provider field required")

    config = _load_yaml("llm_providers.yaml")
    if provider_name not in config.get("providers", {}):
        available = list(config.get("providers", {}).keys())
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown provider '{provider_name}'. Available: {available}",
        )

    # Update the YAML file
    filepath = CONFIG_DIR / "llm_providers.yaml"
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace active_provider line
    import re
    content = re.sub(
        r"^active_provider:.*$",
        f"active_provider: {provider_name}",
        content,
        flags=re.MULTILINE,
    )
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    return {"active_provider": provider_name, "status": "updated"}


def _mask_secrets(config: dict) -> dict:
    """Mask API keys and tokens in the config for safe display."""
    import copy
    safe = copy.deepcopy(config)
    for name, provider in safe.get("providers", {}).items():
        env_key = provider.get("env_key")
        if env_key:
            val = os.environ.get(env_key, "")
            provider["api_key_set"] = bool(val)
            provider["api_key_preview"] = f"{val[:4]}...{val[-4:]}" if len(val) > 8 else ("***" if val else "NOT SET")
        # Remove raw template details from non-custom providers
        if provider.get("type") != "custom":
            provider.pop("request_template", None)
            provider.pop("response_mapping", None)
            provider.pop("stream_mapping", None)
        # Remove headers values
        if "headers" in provider:
            provider["headers"] = {k: "***" for k in provider["headers"]}
    return safe
