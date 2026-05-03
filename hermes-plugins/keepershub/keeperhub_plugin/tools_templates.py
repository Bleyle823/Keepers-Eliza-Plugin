"""Template kh_* tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_shared import TOOLSET, as_record, compact, run_mcp


def _schema(
    name: str,
    description: str,
    properties: dict[str, Any],
    required: list[str],
) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "parameters": {"type": "object", "properties": properties, "required": required},
    }


def register_template_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_search_templates",
        TOOLSET,
        _schema(
            "kh_search_templates",
            "Search for pre-built KeeperHub workflow templates.",
            {
                "query": {"type": "string", "description": "Free-text search query."},
                "category": {"type": "string", "description": "Optional category filter."},
            },
            [],
        ),
        lambda args, **_: run_mcp(
            "search_templates",
            compact({"query": args.get("query"), "category": args.get("category")}),
            lambda result: (
                lambda lst: (
                    "No templates found matching your query."
                    if len(lst) == 0
                    else "\n".join(
                        [
                            f"Found {len(lst)} template(s):",
                            "",
                            "\n".join(
                                "{}. **{}** (ID: `{}`) — {}".format(
                                    i + 1,
                                    str(t.get("name") or "Untitled"),
                                    t.get("id"),
                                    str(t.get("description") or ""),
                                )
                                for i, t in enumerate(lst[:10])
                                if isinstance(t, dict)
                            ),
                            "",
                            "Use kh_get_template for full details, or kh_deploy_template to clone one.",
                        ]
                    )
                )
            )(
                result
                if isinstance(result, list)
                else (as_record(result).get("items") if isinstance(as_record(result).get("items"), list) else [])
            ),
        ),
    )

    ctx.register_tool(
        "kh_get_template",
        TOOLSET,
        _schema(
            "kh_get_template",
            "Get full details of a KeeperHub workflow template by ID.",
            {"templateId": {"type": "string", "description": "KeeperHub template id."}},
            ["templateId"],
        ),
        lambda args, **_: run_mcp(
            "get_template",
            {"templateId": args["templateId"]},
            lambda result: (
                lambda t: "\n".join(
                    [
                        x
                        for x in [
                            f"**Template: {t.get('name') or 'Untitled'}**",
                            f"ID: `{t.get('id')}`",
                            f"Description: {t['description']}" if t.get("description") else "",
                            f"Nodes: {len(t['nodes']) if isinstance(t.get('nodes'), list) else 0}",
                            "",
                            f'Use kh_deploy_template with templateId="{t.get("id")}" to clone this template into your org.',
                        ]
                        if x
                    ]
                )
            )(as_record(result)),
        ),
    )

    ctx.register_tool(
        "kh_deploy_template",
        TOOLSET,
        _schema(
            "kh_deploy_template",
            "Clone a public KeeperHub template into your organization as a new workflow.",
            {
                "templateId": {"type": "string"},
                "name": {"type": "string", "description": "Display name for the deployed copy."},
            },
            ["templateId"],
        ),
        lambda args, **_: run_mcp(
            "deploy_template",
            compact({"templateId": args["templateId"], "name": args.get("name")}),
            lambda result: (
                lambda w: "\n".join(
                    [
                        "Template deployed as a new workflow!",
                        "",
                        f"**Name:** {w.get('name')}",
                        f"**ID:** `{w.get('id')}`",
                        "",
                        "The workflow is disabled by default. Use kh_update_workflow with `enabled: true` when ready.",
                    ]
                )
            )(as_record(result)),
        ),
    )
