import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { isLikelyValidApiKey, resolveApiKey, SUPPORTED_ENV_VARS } from '../config.js';
import { getClient } from '../client.js';
import { toToolText } from './_shared.js';

const StatusParams = Type.Object({
  refresh: Type.Optional(
    Type.Boolean({
      description:
        'When true, query the KeeperHub MCP for live org context instead of returning the cached snapshot.',
      default: false,
    }),
  ),
});

/**
 * `kh_status` is the OpenClaw replacement for the Eliza `keeperhubContextProvider`.
 * Eliza providers automatically inject context into every prompt; OpenClaw
 * plugins don't have an equivalent, so we expose the same data as a tool the
 * agent can call on demand to learn the current connection state.
 */
export function registerStatusTool(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_status',
    description:
      'Show KeeperHub connection status: whether an API key is configured, the active organization id, and the cached workflow count. Set refresh=true to query the MCP for fresh org context.',
    parameters: StatusParams,
    async execute(_id, params: Static<typeof StatusParams>) {
      const apiKey = resolveApiKey(api);

      if (!apiKey) {
        return toToolText(
          [
            '# KeeperHub Status',
            'Status: NOT CONNECTED',
            'KH_API_KEY is not configured.',
            '',
            'Set one of:',
            `- plugins.entries.keepershub.config.apiKey`,
            ...SUPPORTED_ENV_VARS.map((v) => `- env ${v}`),
            '',
            'Get an API key at https://app.keeperhub.com → Avatar → API Keys → Organisation → New API Key.',
          ].join('\n'),
        );
      }

      const client = getClient(apiKey, api.logger ?? console);

      if (params.refresh) {
        try {
          await client.refreshOrgContext();
        } catch (err) {
          api.logger?.warn?.('[KeeperHub] refreshOrgContext failed:', err);
        }
      }

      const { orgId, workflowCount } = client.orgContext;
      const lines = [
        '# KeeperHub Status',
        'Status: CONNECTED',
        `MCP Server: https://app.keeperhub.com/mcp`,
        `API Key: ${apiKey.slice(0, 4)}…${apiKey.slice(-4)}${
          isLikelyValidApiKey(apiKey) ? '' : ' (warning: does not start with kh_)'
        }`,
        orgId ? `Organization ID: ${orgId}` : 'Organization ID: (unknown — call kh_status with refresh=true)',
        `Workflows in org: ${workflowCount}`,
        '',
        'Available capabilities: workflow management, template deployment, protocol actions,',
        'DeFi reads (Aave, Chainlink, Morpho, Uniswap, etc.), on-chain contract calls,',
        'notifications (Discord, SendGrid), scheduled execution, and AI workflow generation.',
      ];
      return toToolText(lines.join('\n'));
    },
  });
}
