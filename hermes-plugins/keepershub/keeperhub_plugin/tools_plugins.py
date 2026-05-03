"""Plugin / action-schema kh_* tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_shared import TOOLSET, as_record, compact, fenced_json, run_mcp

_PLUGIN_CATEGORIES = ("web3", "discord", "sendgrid", "system", "triggers")


def _fmt_search_plugins(result: Any, category: str) -> str:
    r = as_record(result)
    actions = as_record(r.get("actions"))
    keys = list(actions.keys())
    if not keys:
        return f'No plugins found for category "{category}".'
    lines = [
        "- `{}` — {}".format(
            k,
            str(
                as_record(actions.get(k)).get("description")
                or as_record(actions.get(k)).get("label")
                or ""
            ),
        )
        for k in keys
    ]
    return "**Available {} plugins ({}):**\n\n{}".format(category, len(keys), "\n".join(lines))


def _fmt_list_action_schemas(result: Any) -> str:
    r = as_record(result)
    actions = as_record(r.get("actions"))
    chains = r.get("chains") if isinstance(r.get("chains"), list) else []
    action_keys = list(actions.keys())
    parts: list[str] = [f"**Available action schemas ({len(action_keys)}):**", ""]
    for k in action_keys:
        a = as_record(actions.get(k))
        parts.append("- `{}` — {}".format(k, str(a.get("label") or a.get("description") or "")))
    if chains:
        parts.extend(["", f"**Supported chains ({len(chains)}):**"])
        for c in chains:
            if isinstance(c, dict):
                tn = " [testnet]" if c.get("isTestnet") else ""
                parts.append("- {} (chainId: {}){}".format(c.get("name"), c.get("chainId"), tn))
    return "\n".join(parts)


def register_plugin_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_search_plugins",
        TOOLSET,
        {
            "name": "kh_search_plugins",
            "description": (
                'List available KeeperHub action schemas filtered by category '
                '(web3, discord, sendgrid, system, triggers). Defaults to "web3".'
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": list(_PLUGIN_CATEGORIES),
                        "description": "KeeperHub plugin/action category.",
                    },
                },
                "required": [],
            },
        },
        lambda args, **_: run_mcp(
            "search_plugins",
            {"category": args.get("category") or "web3"},
            lambda result: _fmt_search_plugins(result, args.get("category") or "web3"),
        ),
    )

    ctx.register_tool(
        "kh_get_plugin",
        TOOLSET,
        {
            "name": "kh_get_plugin",
            "description": "Get the schema and documentation for a specific KeeperHub plugin or action type.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pluginType": {
                        "type": "string",
                        "description": 'Plugin or action type, e.g. "web3", "discord", "web3/check-balance".',
                    },
                },
                "required": ["pluginType"],
            },
        },
        lambda args, **_: run_mcp(
            "get_plugin",
            {"pluginType": args["pluginType"]},
            lambda result: f"**Plugin Schema: {args['pluginType']}**\n\n{fenced_json(result)}",
        ),
    )

    ctx.register_tool(
        "kh_list_action_schemas",
        TOOLSET,
        {
            "name": "kh_list_action_schemas",
            "description": (
                "List all available action schemas, triggers, and supported chains for building KeeperHub workflows."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": list(_PLUGIN_CATEGORIES)},
                    "includeChains": {
                        "type": "boolean",
                        "description": "Include supported chains (default true).",
                        "default": True,
                    },
                },
                "required": [],
            },
        },
        lambda args, **_: run_mcp(
            "list_action_schemas",
            compact(
                {
                    "category": args.get("category"),
                    "includeChains": args.get("includeChains")
                    if args.get("includeChains") is not None
                    else True,
                }
            ),
            _fmt_list_action_schemas,
        ),
    )
