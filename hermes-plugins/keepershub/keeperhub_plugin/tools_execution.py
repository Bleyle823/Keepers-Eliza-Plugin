"""Execution log/status kh_* tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_shared import TOOLSET, as_record, fenced_json, run_mcp


def register_execution_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_get_execution_status",
        TOOLSET,
        {
            "name": "kh_get_execution_status",
            "description": "Get the current status of a KeeperHub workflow execution by execution ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "executionId": {
                        "type": "string",
                        "description": "KeeperHub execution id returned by kh_execute_workflow.",
                    },
                },
                "required": ["executionId"],
            },
        },
        lambda args, **_: run_mcp(
            "get_execution_status",
            {"executionId": args["executionId"]},
            lambda result: (
                lambda r: "\n".join(
                    [
                        f"**Execution ID:** `{args['executionId']}`",
                        f"**Status:** {r.get('status') or r.get('state') or 'unknown'}",
                        *( [f"**Started:** {r['startedAt']}"] if r.get("startedAt") else []),
                        *( [f"**Completed:** {r['completedAt']}"] if r.get("completedAt") else []),
                        *( [f"**Error:** {r['error']}"] if r.get("error") else []),
                    ]
                )
            )(as_record(result)),
        ),
    )

    ctx.register_tool(
        "kh_get_execution_logs",
        TOOLSET,
        {
            "name": "kh_get_execution_logs",
            "description": "Get detailed step-by-step logs for a KeeperHub workflow execution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "executionId": {
                        "type": "string",
                        "description": "KeeperHub execution id returned by kh_execute_workflow.",
                    },
                },
                "required": ["executionId"],
            },
        },
        lambda args, **_: run_mcp(
            "get_execution_logs",
            {"executionId": args["executionId"]},
            lambda result: f"**Execution Logs for `{args['executionId']}`:**\n\n{fenced_json(result)}",
        ),
    )
