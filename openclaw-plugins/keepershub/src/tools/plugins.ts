import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, compact, fencedJson, runMcp } from './_shared.js';

const SUPPORTED_CATEGORIES = ['web3', 'discord', 'sendgrid', 'system', 'triggers'] as const;
const PluginCategory = Type.Union(
  SUPPORTED_CATEGORIES.map((c) => Type.Literal(c)),
  { description: 'KeeperHub plugin/action category.' },
);

const SearchPluginsParams = Type.Object({
  category: Type.Optional(PluginCategory),
});

const GetPluginParams = Type.Object({
  pluginType: Type.String({
    description: 'Plugin or action type, e.g. "web3", "discord", "web3/check-balance".',
  }),
});

const ListActionSchemasParams = Type.Object({
  category: Type.Optional(PluginCategory),
  includeChains: Type.Optional(
    Type.Boolean({
      description:
        'Include the list of supported chains in the response. Defaults to true.',
      default: true,
    }),
  ),
});

export function registerPluginTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_search_plugins',
    description:
      'List available KeeperHub action schemas filtered by category (web3, discord, sendgrid, system, triggers). Defaults to "web3".',
    parameters: SearchPluginsParams,
    async execute(_id, params: Static<typeof SearchPluginsParams>) {
      const category = params.category ?? 'web3';
      return runMcp(api, 'search_plugins', { category }, (result) => {
        const r = asRecord(result);
        const actions = asRecord(r.actions);
        const keys = Object.keys(actions);
        if (keys.length === 0) return `No plugins found for category "${category}".`;
        const lines = keys.map((k) => {
          const a = asRecord(actions[k]);
          return `- \`${k}\` — ${(a.description as string | undefined) ?? (a.label as string | undefined) ?? ''}`;
        });
        return `**Available ${category} plugins (${keys.length}):**\n\n${lines.join('\n')}`;
      });
    },
  });

  api.registerTool({
    name: 'kh_get_plugin',
    description:
      'Get the schema and documentation for a specific KeeperHub plugin or action type.',
    parameters: GetPluginParams,
    async execute(_id, params: Static<typeof GetPluginParams>) {
      return runMcp(
        api,
        'get_plugin',
        { pluginType: params.pluginType },
        (result) => `**Plugin Schema: ${params.pluginType}**\n\n${fencedJson(result)}`,
      );
    },
  });

  api.registerTool({
    name: 'kh_list_action_schemas',
    description:
      'List all available action schemas, triggers, and supported chains for building KeeperHub workflows.',
    parameters: ListActionSchemasParams,
    async execute(_id, params: Static<typeof ListActionSchemasParams>) {
      const args = compact({
        category: params.category,
        includeChains: params.includeChains ?? true,
      });
      return runMcp(api, 'list_action_schemas', args, (result) => {
        const r = asRecord(result);
        const actions = asRecord(r.actions);
        const chains = Array.isArray(r.chains) ? (r.chains as Array<Record<string, unknown>>) : [];
        const actionKeys = Object.keys(actions);

        const lines: string[] = [`**Available action schemas (${actionKeys.length}):**`, ''];
        for (const k of actionKeys) {
          const a = asRecord(actions[k]);
          lines.push(
            `- \`${k}\` — ${(a.label as string | undefined) ?? (a.description as string | undefined) ?? ''}`,
          );
        }

        if (chains.length > 0) {
          lines.push('', `**Supported chains (${chains.length}):**`);
          for (const c of chains) {
            lines.push(
              `- ${c.name} (chainId: ${c.chainId})${c.isTestnet ? ' [testnet]' : ''}`,
            );
          }
        }

        return lines.join('\n');
      });
    },
  });
}
