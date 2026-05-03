"""KeeperHubClient MCP transport with mocked HTTP."""

from __future__ import annotations

import json

import httpx
import pytest

from keeperhub_plugin.client import KeeperHubClient, reset_client_for_tests


def test_initialize_and_tools_call_roundtrip():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("authorization", "").startswith("Bearer ")
        body = json.loads(request.content.decode())
        calls["n"] += 1
        rid = body["id"]
        if body["method"] == "initialize":
            return httpx.Response(
                200,
                headers={"mcp-session-id": "test-session"},
                json={"jsonrpc": "2.0", "id": rid, "result": {}},
            )
        if body["method"] == "tools/call":
            assert request.headers.get("mcp-session-id") == "test-session"
            payload = {"answer": 42}
            return httpx.Response(
                200,
                json={
                    "jsonrpc": "2.0",
                    "id": rid,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(payload)}],
                    },
                },
            )
        return httpx.Response(400, json={"error": "unknown method"})

    transport = httpx.MockTransport(handler)
    client = KeeperHubClient("kh_test_fake_key_for_unit_tests")
    client._http.close()
    client._http = httpx.Client(transport=transport, timeout=10.0)

    try:
        out = client.call_tool("demo_tool", {"x": 1})
        assert out == {"answer": 42}
        assert calls["n"] == 2
    finally:
        client.close()
        reset_client_for_tests()


def test_401_triggers_reinitialize_and_retries():
    phase = {"initialize": 0, "tools": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode())
        rid = body["id"]
        if body["method"] == "initialize":
            phase["initialize"] += 1
            return httpx.Response(
                200,
                headers={"mcp-session-id": f"sess-{phase['initialize']}"},
                json={"jsonrpc": "2.0", "id": rid, "result": {}},
            )
        if body["method"] == "tools/call":
            phase["tools"] += 1
            if phase["tools"] == 1:
                return httpx.Response(401, text="unauthorized")
            return httpx.Response(
                200,
                json={
                    "jsonrpc": "2.0",
                    "id": rid,
                    "result": {"content": [{"type": "text", "text": '"ok"'}]},
                },
            )
        return httpx.Response(400)

    transport = httpx.MockTransport(handler)
    c = KeeperHubClient("kh_test_fake_key_for_unit_tests")
    c._http.close()
    c._http = httpx.Client(transport=transport, timeout=10.0)
    try:
        assert c.call_tool("t", {}) == "ok"
        assert phase["initialize"] == 2
        assert phase["tools"] == 2
    finally:
        c.close()


def test_session_404_body_triggers_reinit():
    calls = {"tools": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode())
        rid = body["id"]
        if body["method"] == "initialize":
            return httpx.Response(
                200,
                headers={"mcp-session-id": "sid-new"},
                json={"jsonrpc": "2.0", "id": rid, "result": {}},
            )
        if body["method"] == "tools/call":
            calls["tools"] += 1
            if calls["tools"] == 1:
                return httpx.Response(404, text="Session expired")
            return httpx.Response(
                200,
                json={
                    "jsonrpc": "2.0",
                    "id": rid,
                    "result": {"content": [{"type": "text", "text": "[1]"}]},
                },
            )
        return httpx.Response(400)

    transport = httpx.MockTransport(handler)
    c = KeeperHubClient("kh_test_fake_key_for_unit_tests")
    c._http.close()
    c._http = httpx.Client(transport=transport, timeout=10.0)
    try:
        assert c.call_tool("list_workflows", {}) == [1]
        assert calls["tools"] == 2
    finally:
        c.close()
