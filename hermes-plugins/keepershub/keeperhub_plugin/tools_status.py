"""kh_status tool — connection/org snapshot."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.client import get_client
from keeperhub_plugin.config import SUPPORTED_ENV_VARS, is_likely_valid_api_key, resolve_api_key
from keeperhub_plugin.tools_shared import TOOLSET, ok_json


def register_status_tool(ctx: Any) -> None:
    ctx.register_tool(
        "kh_status",
        TOOLSET,
        {
            "name": "kh_status",
            "description": (
                "KeeperHub connection status: API key presence, organization id, cached workflow count. "
                "Use refresh=true to query MCP for fresh org context."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "refresh": {
                        "type": "boolean",
                        "description": "When true, refresh org context via list_workflows.",
                        "default": False,
                    },
                },
                "required": [],
            },
        },
        _status_handler,
    )


def _status_handler(args: dict[str, Any], **_kw: Any) -> str:
    api_key = resolve_api_key()
    if not api_key:
        text = "\n".join(
            [
                "# KeeperHub Status",
                "Status: NOT CONNECTED",
                "KH_API_KEY is not configured.",
                "",
                "Set one of:",
                *[f"- env {v}" for v in SUPPORTED_ENV_VARS],
                "",
                "Get an API key at https://app.keeperhub.com → Avatar → API Keys → Organisation → New API Key.",
            ]
        )
        return ok_json(text)

    client = get_client(api_key)
    if args.get("refresh"):
        try:
            client.refresh_org_context()
        except Exception:
            pass

    oc = client.org_context
    org_id = oc.get("orgId")
    wf_count = oc.get("workflowCount")
    masked = f"{api_key[:4]}…{api_key[-4:]}"
    warn = "" if is_likely_valid_api_key(api_key) else " (warning: does not start with kh_)"

    lines = [
        "# KeeperHub Status",
        "Status: CONNECTED",
        "MCP Server: https://app.keeperhub.com/mcp",
        f"API Key: {masked}{warn}",
        f"Organization ID: {org_id}" if org_id else "Organization ID: (unknown — call kh_status with refresh=true)",
        f"Workflows in org: {wf_count}",
        "",
        "Available capabilities: workflow management, template deployment, protocol actions,",
        "DeFi reads (Aave, Chainlink, Morpho, Uniswap, etc.), on-chain contract calls,",
        "notifications (Discord, SendGrid), scheduled execution, and AI workflow generation.",
    ]
    return ok_json("\n".join(lines))
