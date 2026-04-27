import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { handleToolCall, validateKeeperHub } from './_helpers.ts';

export const listIntegrationsAction: Action = {
  name: 'LIST_INTEGRATIONS',
  similes: ['list_integrations', 'SHOW_INTEGRATIONS', 'MY_INTEGRATIONS', 'CREDENTIALS'],
  description: 'List all configured KeeperHub integrations (Discord, SendGrid, wallets, etc.) for the organization.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    return handleToolCall('list_integrations', {}, runtime, message, callback, (result) => {
      const list = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
      if (list.length === 0) return 'No integrations configured in your KeeperHub organization.';
      const lines = list.map((int, i) =>
        `${i + 1}. **${int.name ?? int.id}** (type: \`${int.type}\`, ID: \`${int.id}\`)`
      );
      return `Found ${list.length} integration(s):\n\n${lines.join('\n')}`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Show my KeeperHub integrations' } },
      { name: '{{agent}}', content: { text: 'Found 1 integration(s):\n\n1. **0xf8e6...** (type: `web3`, ID: `vq09103mu`)', actions: ['LIST_INTEGRATIONS'] } },
    ],
  ],
};

export const getWalletIntegrationAction: Action = {
  name: 'GET_WALLET_INTEGRATION',
  similes: ['get_wallet_integration', 'WALLET_INTEGRATION', 'WALLET_DETAILS', 'GET_WALLET'],
  description: 'Get details for a specific KeeperHub wallet integration. Required for web3 write actions like fund transfers.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const integrationId = text.match(/(?:integration|wallet|id)[:\s]+([a-z0-9]+)/i)?.[1];

    if (!integrationId) {
      const errText = 'Please provide an integration ID. Use "list integrations" to find available IDs.';
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: new Error('Missing integrationId') };
    }

    return handleToolCall('get_wallet_integration', { integrationId }, runtime, message, callback, (result) => {
      const w = result as Record<string, unknown>;
      return [
        `**Wallet Integration: ${w.name ?? w.id}**`,
        `ID: \`${w.id}\``,
        `Type: ${w.type}`,
        w.walletAddress ? `Address: \`${w.walletAddress}\`` : '',
        `Created: ${w.createdAt}`,
      ].filter(Boolean).join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Get wallet integration vq09103mu' } },
      { name: '{{agent}}', content: { text: '**Wallet Integration: 0xf8e6...**\nID: `vq09103mu`', actions: ['GET_WALLET_INTEGRATION'] } },
    ],
  ],
};
