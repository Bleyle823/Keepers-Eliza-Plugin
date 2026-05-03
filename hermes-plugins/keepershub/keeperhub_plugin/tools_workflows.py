"""Workflow-related kh_* tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_shared import (
    TOOLSET,
    as_record,
    compact,
    fenced_json,
    ok_json,
    run_mcp,
)


def _schema(
    name: str,
    description: str,
    properties: dict[str, Any],
    required: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": required or [],
        },
    }


def register_workflow_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_list_workflows",
        TOOLSET,
        _schema(
            "kh_list_workflows",
            "List all KeeperHub workflows in the organization. Optionally filter by projectId or tagId.",
            {
                "projectId": {
                    "type": "string",
                    "description": "Optional KeeperHub project id to scope the listing.",
                },
                "tagId": {
                    "type": "string",
                    "description": "Optional KeeperHub tag id to filter by.",
                },
            },
            [],
        ),
        lambda args, **_: run_mcp(
            "list_workflows",
            compact(
                {
                    "projectId": args.get("projectId"),
                    "tagId": args.get("tagId"),
                }
            ),
            lambda result: (
                (
                    lambda lst: (
                        "No workflows found in your KeeperHub organization."
                        if len(lst) == 0
                        else "Found {} workflow(s):\n\n{}".format(
                            len(lst),
                            "\n".join(
                                "{}. **{}** (ID: `{}`) — {}".format(
                                    i + 1,
                                    str(w.get("name") or "Untitled"),
                                    w.get("id"),
                                    "enabled" if w.get("enabled") else "disabled",
                                )
                                for i, w in enumerate(lst)
                                if isinstance(w, dict)
                            ),
                        )
                    )
                )(result if isinstance(result, list) else [])
            ),
        ),
    )

    ctx.register_tool(
        "kh_get_workflow",
        TOOLSET,
        _schema(
            "kh_get_workflow",
            "Get full details of a KeeperHub workflow by ID, including nodes, edges, and configuration.",
            {
                "workflowId": {
                    "type": "string",
                    "description": "KeeperHub workflow id (cuid/uuid).",
                },
            },
            ["workflowId"],
        ),
        lambda args, **_: run_mcp(
            "get_workflow",
            {"workflowId": args["workflowId"]},
            lambda result: (
                lambda w: "\n".join(
                    [
                        f"**Workflow: {w.get('name') or 'Untitled'}**",
                        f"ID: `{w.get('id')}`",
                        f"Enabled: {w.get('enabled')}",
                        f"Nodes: {len(w['nodes']) if isinstance(w.get('nodes'), list) else 0}",
                        "",
                        fenced_json(result),
                    ]
                )
            )(as_record(result)),
        ),
    )

    ctx.register_tool(
        "kh_create_workflow",
        TOOLSET,
        _schema(
            "kh_create_workflow",
            "Create a new KeeperHub workflow. Provide name, optional description, optional nodes/edges.",
            {
                "name": {"type": "string", "description": "Display name for the new workflow."},
                "description": {"type": "string"},
                "nodes": {"type": "array", "description": "Workflow nodes.", "items": {"type": "object"}},
                "edges": {"type": "array", "description": "Workflow edges.", "items": {"type": "object"}},
                "enabled": {"type": "boolean"},
            },
            ["name"],
        ),
        lambda args, **_: run_mcp(
            "create_workflow",
            compact(
                {
                    "name": args.get("name"),
                    "description": args.get("description"),
                    "nodes": args.get("nodes") if args.get("nodes") is not None else [],
                    "edges": args.get("edges") if args.get("edges") is not None else [],
                    "enabled": args.get("enabled"),
                }
            ),
            lambda result: (
                lambda w: "\n".join(
                    [
                        "Workflow created successfully!",
                        "",
                        f"**Name:** {w.get('name')}",
                        f"**ID:** `{w.get('id')}`",
                        f"**Enabled:** {w.get('enabled')}",
                    ]
                )
            )(as_record(result)),
        ),
    )

    ctx.register_tool(
        "kh_update_workflow",
        TOOLSET,
        _schema(
            "kh_update_workflow",
            "Update an existing KeeperHub workflow's name, description, nodes, edges, or enabled flag.",
            {
                "workflowId": {"type": "string"},
                "name": {"type": "string"},
                "description": {"type": "string"},
                "nodes": {"type": "array", "items": {"type": "object"}},
                "edges": {"type": "array", "items": {"type": "object"}},
                "enabled": {"type": "boolean"},
            },
            ["workflowId"],
        ),
        lambda args, **_: run_mcp(
            "update_workflow",
            compact(args),
            lambda result: (
                lambda w: f"Workflow updated successfully!\n\n**Name:** {w.get('name')}\n**ID:** `{w.get('id')}`"
            )(as_record(result)),
        ),
    )

    ctx.register_tool(
        "kh_delete_workflow",
        TOOLSET,
        _schema(
            "kh_delete_workflow",
            "Permanently delete a KeeperHub workflow. This action is irreversible.",
            {"workflowId": {"type": "string"}},
            ["workflowId"],
        ),
        lambda args, **_: run_mcp(
            "delete_workflow",
            {"workflowId": args["workflowId"]},
            lambda _r: f"Workflow `{args['workflowId']}` has been permanently deleted.",
        ),
    )

    ctx.register_tool(
        "kh_execute_workflow",
        TOOLSET,
        _schema(
            "kh_execute_workflow",
            "Manually trigger a KeeperHub workflow execution. Poll with kh_get_execution_status.",
            {
                "workflowId": {"type": "string"},
                "input": {
                    "type": "object",
                    "description": "Optional inputs for the workflow trigger.",
                    "additionalProperties": True,
                },
            },
            ["workflowId"],
        ),
        lambda args, **_: run_mcp(
            "execute_workflow",
            compact({"workflowId": args["workflowId"], "input": args.get("input")}),
            lambda result: (
                lambda r: "\n".join(
                    [
                        "Workflow execution started!",
                        "",
                        f"**Execution ID:** `{r.get('executionId') or r.get('id') or 'unknown'}`",
                        "",
                        f'Use kh_get_execution_status with executionId="{r.get("executionId") or r.get("id")}" to check progress.',
                    ]
                )
            )(as_record(result)),
        ),
    )

    def _search_org_handler(args: dict[str, Any], **_kw: Any) -> str:
        qraw = str(args.get("query") or "").strip().lower()

        def _fmt(result: Any) -> str:
            all_w = result if isinstance(result, list) else []
            filtered = [
                w
                for w in all_w
                if isinstance(w, dict)
                and (
                    not qraw
                    or qraw in str(w.get("name") or "").lower()
                    or qraw in str(w.get("description") or "").lower()
                )
            ]
            if not filtered:
                return (
                    f'No workflows found matching "{args.get("query")}".'
                    if qraw
                    else "No workflows found in your KeeperHub organization."
                )
            header = (
                f'Found {len(filtered)} workflow(s) matching "{args.get("query")}":'
                if qraw
                else f"Found {len(filtered)} workflow(s):"
            )
            lines = [
                "{}. **{}** (ID: `{}`) — {}".format(
                    i + 1,
                    str(w.get("name") or "Untitled"),
                    w.get("id"),
                    str(w.get("description") or "no description"),
                )
                for i, w in enumerate(filtered)
            ]
            return f"{header}\n\n" + "\n".join(lines)

        return run_mcp("list_workflows", {}, _fmt)

    ctx.register_tool(
        "kh_search_org_workflows",
        TOOLSET,
        _schema(
            "kh_search_org_workflows",
            "Search workflows in the KeeperHub organization by name or description substring.",
            {
                "query": {
                    "type": "string",
                    "description": "Substring to filter workflows by name or description.",
                },
            },
            [],
        ),
        _search_org_handler,
    )
