"""AI generation + MCP docs kh_* tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_shared import TOOLSET, as_record, err_json, fenced_json, run_mcp


def _fmt_ai_generate(result: Any) -> str:
    r = as_record(result)
    raw = str(r.get("result") or "").strip()
    if raw:
        return "\n".join(
            [
                "**AI Generated Workflow Definition:**",
                "",
                "```",
                raw,
                "```",
                "",
                "Review the definition above, then use kh_create_workflow to save it.",
            ]
        )
    return "\n".join(
        [
            "**AI Generated Workflow:**",
            "",
            fenced_json(result),
            "",
            "Use kh_create_workflow to save this workflow.",
        ]
    )


def register_generate_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_ai_generate_workflow",
        TOOLSET,
        {
            "name": "kh_ai_generate_workflow",
            "description": (
                "Generate a KeeperHub workflow definition from natural language via KeeperHub AI."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Natural-language workflow description.",
                        "minLength": 1,
                    },
                },
                "required": ["prompt"],
            },
        },
        lambda args, **_: (
            err_json("Missing prompt. Describe the workflow you want to generate.")
            if not str(args.get("prompt") or "").strip()
            else run_mcp(
                "ai_generate_workflow",
                {"prompt": str(args.get("prompt") or "").strip()},
                _fmt_ai_generate,
            )
        ),
    )

    ctx.register_tool(
        "kh_tools_documentation",
        TOOLSET,
        {
            "name": "kh_tools_documentation",
            "description": (
                "KeeperHub MCP tools documentation (workflow guide, templates, chain IDs)."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
        lambda _args, **_: run_mcp(
            "tools_documentation",
            {},
            lambda result: (
                result
                if isinstance(result, str)
                else f"**KeeperHub MCP Documentation:**\n\n{fenced_json(result)}"
            ),
        ),
    )
