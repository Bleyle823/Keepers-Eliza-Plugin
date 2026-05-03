"""Direct execution kh_* tools."""

from __future__ import annotations

import json
from typing import Any

from keeperhub_plugin.tools_shared import TOOLSET, as_record, compact, fenced_json, run_mcp

_WRITE_WARNING = (
    "⚠️ Submits an on-chain transaction using your KeeperHub wallet. Verify all parameters before invoking."
)


def register_direct_tools(ctx: Any) -> None:
    ctx.register_tool(
        "kh_execute_transfer",
        TOOLSET,
        {
            "name": "kh_execute_transfer",
            "description": (
                f"{_WRITE_WARNING} Transfer native or ERC20 tokens from your KeeperHub wallet to a recipient."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "network": {"type": "string", "description": 'EVM chain id, e.g. "1", "137".'},
                    "recipient_address": {"type": "string"},
                    "amount": {"type": "string", "description": 'Decimal string amount, e.g. "0.1".'},
                    "token_address": {
                        "type": "string",
                        "description": "Optional ERC20 address; omit for native token.",
                    },
                },
                "required": ["network", "recipient_address", "amount"],
            },
        },
        lambda args, **_: run_mcp(
            "execute_transfer",
            compact(dict(args)),
            lambda result: (
                lambda r: "\n".join(
                    [
                        x
                        for x in [
                            "**Transfer submitted!**",
                            f"Recipient: `{args['recipient_address']}`",
                            f"Amount: {args['amount']}",
                            f"Execution ID: `{r['executionId']}`" if r.get("executionId") else "",
                            f"TX Hash: `{r['transactionHash']}`" if r.get("transactionHash") else "",
                        ]
                        if x
                    ]
                )
            )(as_record(result)),
        ),
    )

    ctx.register_tool(
        "kh_execute_contract_call",
        TOOLSET,
        {
            "name": "kh_execute_contract_call",
            "description": (
                "Call a smart contract function (view/pure returns data; mutating submits a tx)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_address": {"type": "string"},
                    "network": {"type": "string"},
                    "function_name": {"type": "string"},
                    "function_args": {
                        "type": "string",
                        "description": 'Optional JSON-encoded args array string.',
                    },
                    "abi": {"type": "string", "description": "Optional JSON-encoded ABI string."},
                },
                "required": ["contract_address", "network", "function_name"],
            },
        },
        lambda args, **_: run_mcp(
            "execute_contract_call",
            compact(dict(args)),
            lambda result: "\n".join(
                [
                    f"**Contract Call: `{args['function_name']}`**",
                    f"Contract: `{args['contract_address']}`",
                    f"Network: {args['network']}",
                    "",
                    "Result:",
                    fenced_json(result),
                ]
            ),
        ),
    )

    ctx.register_tool(
        "kh_execute_check_and_execute",
        TOOLSET,
        {
            "name": "kh_execute_check_and_execute",
            "description": (
                f"{_WRITE_WARNING} Read contract state, evaluate condition, execute action if met."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_address": {"type": "string"},
                    "network": {"type": "string"},
                    "function_name": {"type": "string"},
                    "function_args": {"type": "string"},
                    "abi": {"type": "string"},
                    "condition": {
                        "type": "object",
                        "properties": {
                            "operator": {
                                "type": "string",
                                "enum": ["eq", "neq", "gt", "gte", "lt", "lte"],
                            },
                            "value": {},
                        },
                        "required": ["operator", "value"],
                    },
                    "action": {
                        "type": "object",
                        "properties": {
                            "contract_address": {"type": "string"},
                            "function_name": {"type": "string"},
                            "function_args": {"type": "string"},
                            "abi": {"type": "string"},
                            "network": {"type": "string"},
                        },
                        "required": ["contract_address", "function_name"],
                    },
                },
                "required": ["contract_address", "network", "function_name", "condition", "action"],
            },
        },
        lambda args, **_: run_mcp("execute_check_and_execute", dict(args), lambda result: (
            lambda r: "\n".join(
                [
                    x
                    for x in [
                        "**Check-and-Execute submitted!**",
                        f"Execution ID: `{r['executionId']}`" if r.get("executionId") else "",
                        f"Condition met: {r['conditionMet']}" if r.get("conditionMet") is not None else "",
                        f"TX Hash: `{r['transactionHash']}`" if r.get("transactionHash") else "",
                    ]
                    if x
                ]
            )
        )(as_record(result))),
    )

    ctx.register_tool(
        "kh_get_direct_execution_status",
        TOOLSET,
        {
            "name": "kh_get_direct_execution_status",
            "description": "Status of a direct execution (transfer / contract call).",
            "parameters": {
                "type": "object",
                "properties": {
                    "execution_id": {
                        "type": "string",
                        "description": "Direct execution id from kh_execute_transfer / kh_execute_contract_call.",
                    },
                },
                "required": ["execution_id"],
            },
        },
        lambda args, **_: run_mcp(
            "get_direct_execution_status",
            {"execution_id": args["execution_id"]},
            lambda result: (
                lambda r: "\n".join(
                    [
                        x
                        for x in [
                            f"**Direct Execution: `{args['execution_id']}`**",
                            f"Status: {r.get('status') or 'unknown'}",
                            f"TX Hash: `{r['transactionHash']}`" if r.get("transactionHash") else "",
                            f"Result: {json.dumps(r.get('result'))}" if r.get("result") is not None else "",
                            f"Error: {r['error']}" if r.get("error") else "",
                        ]
                        if x
                    ]
                )
            )(as_record(result)),
        ),
    )

