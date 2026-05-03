"""Hermes plugin register() entry — wires all KeeperHub tools."""

from __future__ import annotations

from typing import Any

from keeperhub_plugin.tools_execution import register_execution_tools
from keeperhub_plugin.tools_generate import register_generate_tools
from keeperhub_plugin.tools_integrations import register_integration_tools
from keeperhub_plugin.tools_marketplace import register_marketplace_tools
from keeperhub_plugin.tools_plugins import register_plugin_tools
from keeperhub_plugin.tools_protocol import register_protocol_tools
from keeperhub_plugin.tools_direct import register_direct_tools
from keeperhub_plugin.tools_status import register_status_tool
from keeperhub_plugin.tools_templates import register_template_tools
from keeperhub_plugin.tools_workflows import register_workflow_tools


def register(ctx: Any) -> None:
    """Called once by Hermes at plugin load."""
    register_workflow_tools(ctx)
    register_execution_tools(ctx)
    register_template_tools(ctx)
    register_plugin_tools(ctx)
    register_integration_tools(ctx)
    register_protocol_tools(ctx)
    register_direct_tools(ctx)
    register_marketplace_tools(ctx)
    register_generate_tools(ctx)
    register_status_tool(ctx)
