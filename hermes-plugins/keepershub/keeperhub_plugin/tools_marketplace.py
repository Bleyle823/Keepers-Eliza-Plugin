"""Marketplace kh_* tools + org workflow fallback for kh_call_workflow."""

from __future__ import annotations

import logging
from typing import Any

from keeperhub_plugin.client import get_client
from keeperhub_plugin.config import resolve_api_key
from keeperhub_plugin.tools_shared import (
    TOOLSET,
    NOT_FOUND_RE,
    as_record,
    compact,
    err_json,
    fenced_json,
    looks_like_workflow_id,
    ok_json,
    run_mcp,
)

logger = logging.getLogger(__name__)


def _fmt_marketplace_search(result: Any) -> str:
    r = as_record(result)
    items = r.get("items") if isinstance(r.get("items"), list) else []
    if not items and isinstance(result, list):
        items = result
    items = [x for x in items if isinstance(x, dict)]
    total = r.get("total") if isinstance(r.get("total"), int) else len(items)
    if len(items) == 0:
        return "No marketplace workflows found matching your query."
    lines = []
    for i, w in enumerate(items):
        price = f"${w['priceUsdcPerCall']} USDC/call" if w.get("priceUsdcPerCall") else "free"
        slug = w.get("listedSlug") or w.get("id")
        lines.append(
            "{}. **{}** (`{}`) — {}\n   {}".format(
                i + 1,
                str(w.get("name") or "Untitled"),
                slug,
                price,
                str(w.get("description") or ""),
            ).strip()
        )
    return "\n".join(
        [
            f"**Marketplace Workflows ({total}):**",
            "",
            "\n\n".join(lines),
            "",
            "Use kh_call_workflow with `slug` to invoke one.",
        ]
    )


def register_marketplace_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_search_workflows_marketplace",
        TOOLSET,
        {
            "name": "kh_search_workflows_marketplace",
            "description": (
                "Search KeeperHub marketplace for publicly listed callable workflows "
                "(slug, description, inputSchema, price)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "category": {"type": "string"},
                    "chain": {"type": "string", "description": 'Optional chain id, e.g. "1".'},
                },
                "required": [],
            },
        },
        lambda args, **_: run_mcp(
            "search_workflows",
            compact({"query": args.get("query"), "category": args.get("category"), "chain": args.get("chain")}),
            _fmt_marketplace_search,
        ),
    )

    def _call_workflow_handler(args: dict[str, Any], **_kw: Any) -> str:
        slug = str(args.get("slug") or "").strip()
        inputs = args.get("inputs") if isinstance(args.get("inputs"), dict) else {}
        if not slug:
            return err_json(
                "Missing slug. Use kh_search_workflows_marketplace to discover available slugs.",
            )
        key = resolve_api_key()
        if not key:
            return err_json(
                "KH_API_KEY is not configured. Set KH_API_KEY or complete hermes plugins install prompts.",
            )
        client = get_client(key)
        try:
            result = client.call_tool("call_workflow", {"slug": slug, "inputs": inputs})
            return ok_json(f"**Workflow `{slug}` result:**\n\n{fenced_json(result)}")
        except Exception as err:
            msg = str(err) if str(err) else type(err).__name__
            if not NOT_FOUND_RE.search(msg):
                logger.exception("[KeeperHub] call_workflow failed")
                label = msg if msg.startswith("KeeperHub") else f"KeeperHub error: {msg}"
                return err_json(label)

            if looks_like_workflow_id(slug):
                logger.info(
                    '[KeeperHub] call_workflow: slug "%s" not in marketplace; trying execute_workflow',
                    slug,
                )
                try:
                    exec_args: dict[str, Any] = {"workflowId": slug}
                    if inputs:
                        exec_args["input"] = inputs
                    exec_result = client.call_tool("execute_workflow", exec_args)
                    r = as_record(exec_result)
                    exec_id = str(r.get("executionId") or r.get("id") or "unknown")
                    return ok_json(
                        "\n".join(
                            [
                                f"Workflow `{slug}` is not a marketplace listing, but matched an organization workflow — execution started.",
                                "",
                                f"**Execution ID:** `{exec_id}`",
                                "",
                                f'Use kh_get_execution_status with executionId="{exec_id}" to check progress.',
                            ]
                        )
                    )
                except Exception as fb_err:
                    logger.warning(
                        '[KeeperHub] execute_workflow fallback for "%s" also failed: %s',
                        slug,
                        fb_err,
                    )

            friendly = "\n".join(
                [
                    f"KeeperHub workflow `{slug}` was not found in the marketplace.",
                    "",
                    "Things to try:",
                    "- Run kh_search_workflows_marketplace to discover valid slugs (field `listedSlug`).",
                    f'- If this is your own workflow, use kh_execute_workflow with workflowId="{slug}".',
                    "- Verify the slug is published/listed in KeeperHub.",
                ]
            )
            return err_json(friendly)

    ctx.register_tool(
        "kh_call_workflow",
        TOOLSET,
        {
            "name": "kh_call_workflow",
            "description": (
                "Invoke a marketplace workflow by slug; transparently retries opaque org ids via kh_execute_workflow."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "slug": {
                        "type": "string",
                        "description": "Marketplace slug or organization workflow id.",
                    },
                    "inputs": {
                        "type": "object",
                        "additionalProperties": True,
                        "description": "Inputs payload for the workflow.",
                    },
                },
                "required": ["slug"],
            },
        },
        _call_workflow_handler,
    )
