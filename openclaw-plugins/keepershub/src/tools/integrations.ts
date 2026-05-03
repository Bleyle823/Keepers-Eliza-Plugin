import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, runMcp } from './_shared.js';

const ListIntegrationsParams = Type.Object({});

const GetWalletIntegrationParams = Type.Object({
  integrationId: Type.String({
    description: 'KeeperHub integration id (use kh_list_integrations to discover).',
  }),
});

export function registerIntegrationTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_list_integrations',
    description:
      'List all configured KeeperHub integrations (Discord, SendGrid, wallets, etc.) for the organization.',
    parameters: ListIntegrationsParams,
    async execute(_id, _params: Static<typeof ListIntegrationsParams>) {
      return runMcp(api, 'list_integrations', {}, (result) => {
        const list = Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
        if (list.length === 0) {
          return 'No integrations configured in your KeeperHub organization.';
        }
        const lines = list.map(
          (int, i) =>
            `${i + 1}. **${(int.name as string | undefined) ?? int.id}** (type: \`${int.type}\`, ID: \`${int.id}\`)`,
        );
        return `Found ${list.length} integration(s):\n\n${lines.join('\n')}`;
      });
    },
  });

  api.registerTool({
    name: 'kh_get_wallet_integration',
    description:
      'Get details for a specific KeeperHub wallet integration. Required for web3 write actions like fund transfers.',
    parameters: GetWalletIntegrationParams,
    async execute(_id, params: Static<typeof GetWalletIntegrationParams>) {
      return runMcp(
        api,
        'get_wallet_integration',
        { integrationId: params.integrationId },
        (result) => {
          const w = asRecord(result);
          return [
            `**Wallet Integration: ${(w.name as string | undefined) ?? w.id}**`,
            `ID: \`${w.id}\``,
            `Type: ${w.type}`,
            w.walletAddress ? `Address: \`${w.walletAddress}\`` : '',
            w.createdAt ? `Created: ${w.createdAt}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        },
      );
    },
  });
}
