import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, compact, fencedJson, runMcp } from './_shared.js';

const SUPPORTED_PROTOCOLS = [
  'aave',
  'morpho',
  'chronicle',
  'chainlink',
  'uniswap',
  'compound',
  'lido',
  'maker',
] as const;
const Protocol = Type.Union(SUPPORTED_PROTOCOLS.map((p) => Type.Literal(p)), {
  description: 'DeFi protocol id.',
});

const SearchProtocolActionsParams = Type.Object({
  query: Type.Optional(Type.String({ description: 'Free-text query.' })),
  protocol: Type.Optional(Protocol),
});

const ExecuteProtocolActionParams = Type.Object({
  actionType: Type.String({
    description: 'Protocol action id, e.g. "aave/get-user-account-data".',
  }),
  params: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: 'Parameters for the protocol action (e.g. network, user, asset).',
    }),
  ),
});

export function registerProtocolTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_search_protocol_actions',
    description:
      'Search for available DeFi protocol actions across Aave, Morpho, Chronicle, Chainlink, Uniswap, Compound, Lido, Maker, and more.',
    parameters: SearchProtocolActionsParams,
    async execute(_id, params: Static<typeof SearchProtocolActionsParams>) {
      const args = compact({ query: params.query, protocol: params.protocol });
      return runMcp(api, 'search_protocol_actions', args, (result) => {
        const r = asRecord(result);
        const actions = Array.isArray(r.actions)
          ? (r.actions as Array<Record<string, unknown>>)
          : [];
        const count = (r.count as number | undefined) ?? actions.length;

        if (actions.length === 0) return 'No protocol actions found matching your query.';
        const lines = actions.map((a) => {
          const requires = a.requiresCredentials ? 'requires wallet' : 'read-only';
          return `- \`${a.actionType}\` — ${(a.description as string | undefined) ?? (a.label as string | undefined) ?? ''} [${requires}]`;
        });
        return `**Protocol Actions (${count}):**\n\n${lines.join('\n')}`;
      });
    },
  });

  api.registerTool({
    name: 'kh_execute_protocol_action',
    description:
      'Execute a DeFi protocol action directly (e.g. read Aave health factor, get Chainlink price, check Morpho position). Use kh_search_protocol_actions first to discover available actionType values and required params.',
    parameters: ExecuteProtocolActionParams,
    async execute(_id, params: Static<typeof ExecuteProtocolActionParams>) {
      const args = {
        actionType: params.actionType,
        params: params.params ?? {},
      };
      return runMcp(api, 'execute_protocol_action', args, (result) => {
        return [
          `**Protocol Action: \`${params.actionType}\`**`,
          '',
          'Result:',
          fencedJson(result),
        ].join('\n');
      });
    },
  });
}
