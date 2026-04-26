import type { IAgentRuntime, Memory, Provider, ProviderResult, State } from '@elizaos/core';
import { KeeperHubService } from './service.ts';

export const keeperhubContextProvider: Provider = {
  name: 'KEEPERHUB_CONTEXT',
  description:
    'Injects KeeperHub connection status and org context into the agent prompt so the agent knows which organization it is operating in and how many workflows exist.',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<ProviderResult> => {
    const service = runtime.getService(KeeperHubService.serviceType) as KeeperHubService | null;

    if (!service || !service.isReady()) {
      return {
        text: [
          '# KeeperHub Status',
          'Status: NOT CONNECTED',
          'KH_API_KEY is not configured. Ask the user to provide their KeeperHub API key.',
        ].join('\n'),
        values: { keeperhubConnected: false },
        data: {},
      };
    }

    const { orgId, workflowCount } = service.orgContext;

    const lines = [
      '# KeeperHub Status',
      'Status: CONNECTED',
      `MCP Server: https://app.keeperhub.com/mcp`,
      orgId ? `Organization ID: ${orgId}` : 'Organization ID: (unknown)',
      `Workflows in org: ${workflowCount}`,
      '',
      'Available capabilities: workflow management, template deployment, protocol actions,',
      'DeFi reads (Aave, Chainlink, Morpho, Uniswap, etc.), on-chain contract calls,',
      'notifications (Discord, SendGrid), scheduled execution, and AI workflow generation.',
    ];

    return {
      text: lines.join('\n'),
      values: {
        keeperhubConnected: true,
        keeperhubOrgId: orgId ?? '',
        keeperhubWorkflowCount: workflowCount,
      },
      data: service.orgContext,
    };
  },
};
