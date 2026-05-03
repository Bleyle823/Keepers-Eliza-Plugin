"""Shared JSON responses and MCP invocation helpers."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Callable

from keeperhub_plugin.client import KeeperHubClient, get_client
from keeperhub_plugin.config import resolve_api_key

logger = logging.getLogger(__name__)

TOOLSET = "keepershub"


def ok_json(text: str) -> str:
    return json.dumps({"ok": True, "text": text})


def err_json(message: str) -> str:
    return json.dumps({"ok": False, "error": message})


def compact(obj: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in obj.items():
        if v is None or v == "":
            continue
        out[k] = v
    return out


def as_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def fenced_json(value: Any) -> str:
    return "```json\n" + json.dumps(value, indent=2) + "\n```"


def resolve_client() -> tuple[KeeperHubClient | None, str | None]:
    key = resolve_api_key()
    if not key:
        return None, None
    return get_client(key), key


def run_mcp(
    mcp_tool: str,
    args: dict[str, Any],
    format_result: Callable[[Any], str],
    *,
    client: KeeperHubClient | None = None,
) -> str:
    """Call MCP tool and return JSON string for Hermes."""
    try:
        c = client
        if c is None:
            rk = resolve_api_key()
            if not rk:
                return err_json(
                    "KH_API_KEY is not configured. Set KH_API_KEY (or KEEPERHUB_API_KEY / "
                    "KEEPERSHUB_API_KEY) or complete hermes plugins install prompts."
                )
            c = get_client(rk)
        raw = c.call_tool(mcp_tool, args)
        return ok_json(format_result(raw))
    except Exception as e:
        logger.exception("[KeeperHub] %s failed", mcp_tool)
        msg = str(e) if str(e) else type(e).__name__
        label = msg if msg.startswith("KeeperHub") else f"KeeperHub error: {msg}"
        return err_json(label)


NOT_FOUND_RE = re.compile(r"workflow not found|404\s*not\s*found", re.IGNORECASE)


def looks_like_workflow_id(value: str) -> bool:
    """Opaque org workflow id (no dashes in slug sense)."""
    return bool(re.match(r"^[a-z0-9]{16,}$", value, re.I))
