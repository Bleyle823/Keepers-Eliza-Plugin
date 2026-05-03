"""Integration kh_* tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_shared import TOOLSET, as_record, run_mcp


def register_integration_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_list_integrations",
        TOOLSET,
        {
            "name": "kh_list_integrations",
            "description": (
                "List all configured KeeperHub integrations (Discord, SendGrid, wallets, etc.)."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
        lambda _args, **_: run_mcp(
            "list_integrations",
            {},
            lambda result: (
                lambda lst: (
                    "No integrations configured in your KeeperHub organization."
                    if len(lst) == 0
                    else "Found {} integration(s):\n\n{}".format(
                        len(lst),
                        "\n".join(
                            "{}. **{}** (type: `{}`, ID: `{}`)".format(
                                i + 1,
                                str(integr.get("name") or integr.get("id")),
                                integr.get("type"),
                                integr.get("id"),
                            )
                            for i, integr in enumerate(lst)
                            if isinstance(integr, dict)
                        ),
                    )
                )
            )(result if isinstance(result, list) else []),
        ),
    )

    ctx.register_tool(
        "kh_get_wallet_integration",
        TOOLSET,
        {
            "name": "kh_get_wallet_integration",
            "description": "Get details for a KeeperHub wallet integration (needed for web3 writes).",
            "parameters": {
                "type": "object",
                "properties": {
                    "integrationId": {
                        "type": "string",
                        "description": "KeeperHub integration id (use kh_list_integrations).",
                    },
                },
                "required": ["integrationId"],
            },
        },
        lambda args, **_: run_mcp(
            "get_wallet_integration",
            {"integrationId": args["integrationId"]},
            lambda result: (
                lambda w: "\n".join(
                    [
                        x
                        for x in [
                            f"**Wallet Integration: {w.get('name') or w.get('id')}**",
                            f"ID: `{w.get('id')}`",
                            f"Type: {w.get('type')}",
                            f"Address: `{w['walletAddress']}`" if w.get("walletAddress") else "",
                            f"Created: {w['createdAt']}" if w.get("createdAt") else "",
                        ]
                        if x
                    ]
                )
            )(as_record(result)),
        ),
    )
