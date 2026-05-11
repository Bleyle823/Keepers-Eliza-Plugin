import type { Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { z } from 'zod';
import { KeeperHubService } from './service.ts';
import { keeperhubContextProvider } from './provider.ts';

// Actions
import {
  listWorkflowsAction,
  getWorkflowAction,
  createWorkflowAction,
  updateWorkflowAction,
  deleteWorkflowAction,
  executeWorkflowAction,
  searchOrgWorkflowsAction,
} from './actions/workflows.ts';
import { getExecutionStatusAction, getExecutionLogsAction } from './actions/execution.ts';
import { searchTemplatesAction, getTemplateAction, deployTemplateAction } from './actions/templates.ts';
import { searchPluginsAction, getPluginAction, listActionSchemasAction } from './actions/plugins.ts';
import { listIntegrationsAction, getWalletIntegrationAction } from './actions/integrations.ts';
import { searchProtocolActionsAction, executeProtocolActionAction } from './actions/protocol.ts';
import {
  executeTransferAction,
  executeContractCallAction,
  executeCheckAndExecuteAction,
  getDirectExecutionStatusAction,
} from './actions/direct.ts';
import {
  searchMarketplaceWorkflowsAction,
  callWorkflowAction,
} from './actions/marketplace.ts';
import { aiGenerateWorkflowAction, toolsDocumentationAction } from './actions/generate.ts';

const configSchema = z.object({
  KH_API_KEY: z
    .string()
    .min(1, 'KH_API_KEY is required')
    .refine((v) => v.startsWith('kh_'), {
      message: 'KH_API_KEY must start with "kh_"',
    })
    .optional()
    .transform((val) => {
      if (!val) {
        logger.warn(
          '[KeeperHub] KH_API_KEY is not set. KeeperHub actions will be unavailable until an API key is provided.'
        );
      }
      return val;
    }),
});

export const keeperhubPlugin: Plugin = {
  name: 'plugin-keeperhub',
  description:
    'KeeperHub workflow automation for ElizaOS. Manage and execute KeeperHub workflows, monitor smart contracts, interact with DeFi protocols, and automate on-chain actions via the KeeperHub MCP server.',

  config: {
    KH_API_KEY: process.env.KH_API_KEY ?? process.env.KEEPERHUB_API_KEY ?? process.env.KEEPERSHUB_API_KEY,
  },

  async init(config: Record<string, string>) {
    logger.info('[KeeperHub] Initializing plugin-keeperhub');
    try {
      const validated = await configSchema.parseAsync(config);
      if (validated.KH_API_KEY) {
        process.env.KH_API_KEY = validated.KH_API_KEY;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues.map((e) => e.message).join(', ');
        throw new Error(`Invalid KeeperHub plugin configuration: ${messages}`);
      }
      throw new Error(
        `KeeperHub plugin init failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  services: [KeeperHubService],

  providers: [keeperhubContextProvider],

  actions: [
    // Workflow management
    listWorkflowsAction,
    getWorkflowAction,
    createWorkflowAction,
    updateWorkflowAction,
    deleteWorkflowAction,
    executeWorkflowAction,
    searchOrgWorkflowsAction,

    // Execution monitoring
    getExecutionStatusAction,
    getExecutionLogsAction,

    // Templates
    searchTemplatesAction,
    getTemplateAction,
    deployTemplateAction,

    // Plugin / action schemas
    searchPluginsAction,
    getPluginAction,
    listActionSchemasAction,

    // Integrations
    listIntegrationsAction,
    getWalletIntegrationAction,

    // DeFi protocol actions
    searchProtocolActionsAction,
    executeProtocolActionAction,

    // Direct on-chain actions
    executeTransferAction,
    executeContractCallAction,
    executeCheckAndExecuteAction,
    getDirectExecutionStatusAction,

    // Marketplace
    searchMarketplaceWorkflowsAction,
    callWorkflowAction,

    // AI generation & docs
    aiGenerateWorkflowAction,
    toolsDocumentationAction,
  ],
};

export default keeperhubPlugin;
