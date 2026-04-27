import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { handleToolCall, validateKeeperHub } from './_helpers.ts';

export const searchPluginsAction: Action = {
  name: 'SEARCH_PLUGINS',
  similes: ['search_plugins', 'LIST_PLUGINS', 'FIND_PLUGINS', 'AVAILABLE_INTEGRATIONS'],
  description: 'List available KeeperHub action schemas filtered by category (web3, discord, sendgrid, system, triggers).',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const category =
      text.match(/category[:\s]+(\w+)/i)?.[1] ??
      text.match(/\b(web3|discord|sendgrid|system|triggers?)\b/i)?.[1] ??
      'web3';

    return handleToolCall('search_plugins', { category }, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const actions = r.actions as Record<string, unknown> | undefined;
      if (!actions) return 'No plugins found for that category.';
      const keys = Object.keys(actions);
      if (keys.length === 0) return `No plugins found for category "${category}".`;
      const lines = keys.map((k) => {
        const a = actions[k] as Record<string, unknown>;
        return `- \`${k}\` — ${a.description ?? a.label ?? ''}`;
      });
      return `**Available ${category} plugins (${keys.length}):**\n\n${lines.join('\n')}`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'What web3 plugins are available in KeeperHub?' } },
      { name: '{{agent}}', content: { text: '**Available web3 plugins (14):**\n\n- `web3/check-balance` — Get Native Token Balance', actions: ['SEARCH_PLUGINS'] } },
    ],
  ],
};

export const getPluginAction: Action = {
  name: 'GET_PLUGIN',
  similes: ['get_plugin', 'PLUGIN_DETAILS', 'PLUGIN_SCHEMA', 'SHOW_PLUGIN'],
  description: 'Get schema and documentation for a specific KeeperHub plugin type.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const pluginType =
      text.match(/(?:plugin|type)[:\s]+([a-z0-9/\-_]+)/i)?.[1] ??
      text.match(/\b(web3|discord|sendgrid|system)\b/i)?.[1] ??
      'web3';

    return handleToolCall('get_plugin', { pluginType }, runtime, message, callback, (result) => {
      return `**Plugin Schema: ${pluginType}**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Get plugin schema for discord' } },
      { name: '{{agent}}', content: { text: '**Plugin Schema: discord**\n\n```json\n{...}\n```', actions: ['GET_PLUGIN'] } },
    ],
  ],
};

export const listActionSchemasAction: Action = {
  name: 'LIST_ACTION_SCHEMAS',
  similes: ['list_action_schemas', 'ACTION_SCHEMAS', 'AVAILABLE_ACTIONS', 'WORKFLOW_ACTIONS'],
  description: 'List all available action schemas, triggers, and supported chains for building KeeperHub workflows.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const category = text.match(/\b(web3|discord|sendgrid|system|triggers?)\b/i)?.[1];
    const includeChains = !text.toLowerCase().includes('no chains');

    const args: Record<string, unknown> = { includeChains };
    if (category) args.category = category;

    return handleToolCall('list_action_schemas', args, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const actions = r.actions as Record<string, unknown> | undefined;
      const chains = r.chains as unknown[] | undefined;
      const actionKeys = actions ? Object.keys(actions) : [];

      const lines: string[] = [`**Available action schemas (${actionKeys.length}):**`, ''];
      actionKeys.forEach((k) => {
        const a = actions![k] as Record<string, unknown>;
        lines.push(`- \`${k}\` — ${a.label ?? a.description ?? ''}`);
      });

      if (chains && chains.length > 0) {
        lines.push('', `**Supported chains (${chains.length}):**`);
        (chains as Record<string, unknown>[]).forEach((c) => {
          lines.push(`- ${c.name} (chainId: ${c.chainId})${c.isTestnet ? ' [testnet]' : ''}`);
        });
      }

      return lines.join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'List all available KeeperHub action schemas' } },
      { name: '{{agent}}', content: { text: '**Available action schemas (14):**\n\n- `web3/check-balance` — Get Native Token Balance', actions: ['LIST_ACTION_SCHEMAS'] } },
    ],
  ],
};
