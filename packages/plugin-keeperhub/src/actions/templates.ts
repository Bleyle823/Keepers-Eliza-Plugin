import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { extractJson, handleToolCall, validateKeeperHub } from './_helpers.ts';

export const searchTemplatesAction: Action = {
  name: 'SEARCH_TEMPLATES',
  similes: ['search_templates', 'FIND_TEMPLATES', 'BROWSE_TEMPLATES', 'WORKFLOW_TEMPLATES'],
  description: 'Search for pre-built KeeperHub workflow templates that can be deployed and customized.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const query = text.replace(/search|find|browse|templates?|show/gi, '').trim();
    const category = text.match(/category[:\s]+(\w+)/i)?.[1];

    const args: Record<string, unknown> = {};
    if (query) args.query = query;
    if (category) args.category = category;

    return handleToolCall('search_templates', args, runtime, message, callback, (result) => {
      const list = Array.isArray(result) ? result : (result as Record<string, unknown>).items ?? [];
      const arr = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
      if (arr.length === 0) return 'No templates found matching your query.';
      const lines = arr.slice(0, 10).map((t, i) =>
        `${i + 1}. **${t.name ?? 'Untitled'}** (ID: \`${t.id}\`) — ${t.description ?? ''}`
      );
      return `Found ${arr.length} template(s):\n\n${lines.join('\n')}\n\nUse "get template <id>" for full details, or "deploy template <id>" to clone one.`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Search templates for monitoring' } },
      { name: '{{agent}}', content: { text: 'Found 3 template(s):\n\n1. **Wallet ETH Filler** (ID: `abc`)', actions: ['SEARCH_TEMPLATES'] } },
    ],
  ],
};

export const getTemplateAction: Action = {
  name: 'GET_TEMPLATE',
  similes: ['get_template', 'TEMPLATE_DETAILS', 'SHOW_TEMPLATE', 'FETCH_TEMPLATE'],
  description: 'Get full details of a specific KeeperHub workflow template by ID.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const templateId = text.match(/(?:template|id)[:\s]+([a-z0-9]+)/i)?.[1];

    if (!templateId) {
      const errText = 'Please provide a template ID. Example: "Get template abc123"';
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: new Error('Missing templateId') };
    }

    return handleToolCall('get_template', { templateId }, runtime, message, callback, (result) => {
      const t = result as Record<string, unknown>;
      const lines = [
        `**Template: ${t.name ?? 'Untitled'}**`,
        `ID: \`${t.id}\``,
        t.description ? `Description: ${t.description}` : '',
        `Nodes: ${(t.nodes as unknown[])?.length ?? 0}`,
        '',
        'Use "deploy template ' + t.id + '" to clone this template into your org.',
      ].filter(Boolean);
      return lines.join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Get template abc123' } },
      { name: '{{agent}}', content: { text: '**Template: Wallet ETH Filler**\nID: `abc123`', actions: ['GET_TEMPLATE'] } },
    ],
  ],
};

export const deployTemplateAction: Action = {
  name: 'DEPLOY_TEMPLATE',
  similes: ['deploy_template', 'CLONE_TEMPLATE', 'INSTALL_TEMPLATE', 'USE_TEMPLATE'],
  description: 'Clone a public KeeperHub template workflow into your organization as a new workflow.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);
    const templateId = (parsed.templateId as string) ?? text.match(/(?:template|id)[:\s]+([a-z0-9]+)/i)?.[1];
    const name = (parsed.name as string) ?? text.match(/(?:as|called|named)\s+"([^"]+)"/i)?.[1];

    if (!templateId) {
      const errText = 'Please provide a template ID to deploy.';
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: new Error('Missing templateId') };
    }

    const args: Record<string, unknown> = { templateId };
    if (name) args.name = name;

    return handleToolCall('deploy_template', args, runtime, message, callback, (result) => {
      const w = result as Record<string, unknown>;
      return `Template deployed as new workflow!\n\n**Name:** ${w.name}\n**ID:** \`${w.id}\`\n\nThe workflow is disabled by default. Enable it when ready.`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Deploy template abc123 as "My Guardian"' } },
      { name: '{{agent}}', content: { text: 'Template deployed as new workflow!\n\n**Name:** My Guardian\n**ID:** `xyz789`', actions: ['DEPLOY_TEMPLATE'] } },
    ],
  ],
};
