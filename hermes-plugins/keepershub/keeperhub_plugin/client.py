"""KeeperHub MCP HTTP client (sync). Mirrors openclaw-plugins/keepershub/src/client.ts."""

from __future__ import annotations

import json
import logging
import threading
from typing import Any

import httpx

logger = logging.getLogger(__name__)

MCP_URL = "https://app.keeperhub.com/mcp"
MCP_PROTOCOL_VERSION = "2024-11-05"
CLIENT_NAME = "hermes-plugin-keepershub"
CLIENT_VERSION = "1.0.0"


class KeeperHubClient:
    """Maintains one MCP session per API key; lazy init; re-init on 401 / session 404."""

    __slots__ = (
        "api_key",
        "_http",
        "_lock",
        "session_id",
        "request_id",
        "org_context",
    )

    def __init__(self, api_key: str, timeout: float = 120.0) -> None:
        if not api_key or not api_key.strip():
            raise ValueError("KeeperHubClient requires a non-empty apiKey")
        self.api_key = api_key.strip()
        self._http = httpx.Client(timeout=timeout)
        self._lock = threading.RLock()
        self.session_id: str | None = None
        self.request_id = 0
        self.org_context: dict[str, Any] = {"orgId": None, "workflowCount": 0}

    def close(self) -> None:
        self._http.close()

    def reset_session(self) -> None:
        self.session_id = None

    def headers_base(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {self.api_key}",
        }

    def _ensure_session_unlocked(self) -> None:
        if self.session_id:
            return
        self.request_id += 1
        body = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "initialize",
            "params": {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": CLIENT_NAME, "version": CLIENT_VERSION},
            },
        }
        res = self._http.post(MCP_URL, headers=self.headers_base(), json=body)
        if not res.is_success:
            raise RuntimeError(f"KeeperHub initialize failed ({res.status_code}): {res.text}")
        sid = res.headers.get("mcp-session-id")
        if not sid:
            raise RuntimeError("KeeperHub did not return mcp-session-id")
        self.session_id = sid
        logger.info("[KeeperHub] MCP session established")

    def _post_mcp_unlocked(self, body: dict[str, Any]) -> Any:
        if not self.session_id:
            raise RuntimeError("No active MCP session")
        hdrs = {**self.headers_base(), "mcp-session-id": self.session_id}
        res = self._http.post(MCP_URL, headers=hdrs, json=body)

        if res.status_code == 401:
            logger.warning("[KeeperHub] Session unauthorized, re-initializing")
            self.session_id = None
            self._ensure_session_unlocked()
            return self._post_mcp_unlocked(body)

        if res.status_code == 404:
            text = res.text or ""
            if "session" in text.lower():
                logger.warning("[KeeperHub] Session expired, re-initializing")
                self.session_id = None
                self._ensure_session_unlocked()
                return self._post_mcp_unlocked(body)
            raise RuntimeError(f"KeeperHub MCP error (404): {text}")

        if not res.is_success:
            raise RuntimeError(f"KeeperHub MCP error ({res.status_code}): {res.text}")

        payload = res.json()
        if payload.get("error"):
            msg = payload["error"].get("message", str(payload["error"]))
            raise RuntimeError(f"KeeperHub RPC error: {msg}")
        return payload.get("result")

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        """Issue tools/call; parse JSON from result.content[0].text when present."""
        args = arguments if arguments is not None else {}
        with self._lock:
            self._ensure_session_unlocked()
            self.request_id += 1
            body = {
                "jsonrpc": "2.0",
                "id": self.request_id,
                "method": "tools/call",
                "params": {"name": name, "arguments": args},
            }
            result = self._post_mcp_unlocked(body)

        typed = result if isinstance(result, dict) else {}
        if typed.get("isError"):
            msg = "Unknown KeeperHub error"
            content = typed.get("content")
            if isinstance(content, list) and content:
                block = content[0]
                if isinstance(block, dict) and isinstance(block.get("text"), str):
                    msg = block["text"]
            raise RuntimeError(f"KeeperHub tool error ({name}): {msg}")

        content = typed.get("content") if isinstance(typed, dict) else None
        if isinstance(content, list) and content:
            block = content[0]
            if isinstance(block, dict):
                txt = block.get("text")
                if isinstance(txt, str):
                    try:
                        return json.loads(txt)
                    except json.JSONDecodeError:
                        return txt
        return result

    def refresh_org_context(self) -> dict[str, Any]:
        """Best-effort workflow list for org id + count."""
        try:
            workflows = self.call_tool("list_workflows", {})
            lst = workflows if isinstance(workflows, list) else []
            org_id = None
            if lst and isinstance(lst[0], dict):
                org_id = lst[0].get("organizationId")
            self.org_context = {"orgId": org_id, "workflowCount": len(lst)}
        except Exception:
            pass
        return self.org_context


_cached_client: KeeperHubClient | None = None
_cached_key: str | None = None


def get_client(api_key: str) -> KeeperHubClient:
    global _cached_client, _cached_key
    if _cached_client is None or _cached_key != api_key:
        if _cached_client is not None:
            try:
                _cached_client.close()
            except Exception:
                pass
        _cached_client = KeeperHubClient(api_key)
        _cached_key = api_key
    return _cached_client


def reset_client_for_tests() -> None:
    global _cached_client, _cached_key
    if _cached_client is not None:
        try:
            _cached_client.close()
        except Exception:
            pass
    _cached_client = None
    _cached_key = None
