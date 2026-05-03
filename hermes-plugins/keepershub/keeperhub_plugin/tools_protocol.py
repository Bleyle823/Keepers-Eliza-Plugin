"""Protocol kh_* tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_shared import TOOLSET, as_record, compact, fenced_json, run_mcp

_PROTOCOLS = ("aave", "morpho", "chronicle", "chainlink", "uniswap", "compound", "lido", "maker")


def _fmt_protocol_search(result: Any) -> str:
    r = as_record(result)
    acts = r.get("actions") if isinstance(r.get("actions"), list) else []
    cnt = r["count"] if isinstance(r.get("count"), int) else len(acts)
    if len(acts) == 0:
        return "No protocol actions found matching your query."
    lines = [
        "- `{}` — {} [{}]".format(
            a.get("actionType"),
            str(a.get("description") or a.get("label") or ""),
            "requires wallet" if a.get("requiresCredentials") else "read-only",
        )
        for a in acts
        if isinstance(a, dict)
    ]
    return "**Protocol Actions ({}):**\n\n{}".format(cnt, "\n".join(lines))


def register_protocol_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_search_protocol_actions",
        TOOLSET,
        {
            "name": "kh_search_protocol_actions",
            "description": (
                "Search DeFi protocol actions (Aave, Morpho, Chainlink, Uniswap, Compound, Lido, Maker, …)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "protocol": {"type": "string", "enum": list(_PROTOCOLS)},
                },
                "required": [],
            },
        },
        lambda args, **_: run_mcp(
            "search_protocol_actions",
            compact({"query": args.get("query"), "protocol": args.get("protocol")}),
            _fmt_protocol_search,
        ),
    )

    ctx.register_tool(
        "kh_execute_protocol_action",
        TOOLSET,
        {
            "name": "kh_execute_protocol_action",
            "description": (
                "Execute a DeFi protocol action. Use kh_search_protocol_actions to discover actionType and params."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "actionType": {
                        "type": "string",
                        "description": 'Protocol action id, e.g. "aave/get-user-account-data".',
                    },
                    "params": {
                        "type": "object",
                        "additionalProperties": True,
                        "description": "Parameters for the protocol action.",
                    },
                },
                "required": ["actionType"],
            },
        },
        lambda args, **_: run_mcp(
            "execute_protocol_action",
            {"actionType": args["actionType"], "params": args.get("params") or {}},
            lambda result: "\n".join(
                [
                    f"**Protocol Action: `{args['actionType']}`**",
                    "",
                    "Result:",
                    fenced_json(result),
                ]
            ),
        ),
    )
