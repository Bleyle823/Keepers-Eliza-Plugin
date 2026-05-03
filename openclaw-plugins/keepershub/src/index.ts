import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

import { resolveApiKey } from './config.js';
import { registerWorkflowTools } from './tools/workflows.js';
import { registerExecutionTools } from './tools/execution.js';
import { registerTemplateTools } from './tools/templates.js';
import { registerPluginTools } from './tools/plugins.js';
import { registerIntegrationTools } from './tools/integrations.js';
import { registerProtocolTools } from './tools/protocol.js';
import { registerDirectTools } from './tools/direct.js';
import { registerMarketplaceTools } from './tools/marketplace.js';
import { registerGenerateTools } from './tools/generate.js';
import { registerStatusTool } from './tools/status.js';

export default definePluginEntry({
  id: 'keepershub',
  name: 'KeeperHub',
  description:
    'KeeperHub workflow automation for OpenClaw. Manage and execute on-chain workflows, monitor smart contracts, interact with DeFi protocols, and automate on-chain actions via the KeeperHub MCP server.',

  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      apiKey: {
        type: 'string',
        description:
          'KeeperHub organization API key (starts with kh_). Falls back to KH_API_KEY / KEEPERHUB_API_KEY / KEEPERSHUB_API_KEY env vars when omitted.',
      },
    },
  },

  register(api) {
    api.logger.info?.('[KeeperHub] Registering keepershub plugin');

    if (!resolveApiKey(api)) {
      api.logger.warn?.(
        '[KeeperHub] No API key configured. Set plugins.entries.keepershub.config.apiKey or KH_API_KEY env var. Tools will return a configuration error until a key is provided.',
      );
    }

    registerWorkflowTools(api);
    registerExecutionTools(api);
    registerTemplateTools(api);
    registerPluginTools(api);
    registerIntegrationTools(api);
    registerProtocolTools(api);
    registerDirectTools(api);
    registerMarketplaceTools(api);
    registerGenerateTools(api);
    registerStatusTool(api);

    api.logger.info?.('[KeeperHub] Registered 28 KeeperHub tools');
  },
});

export { KeeperHubClient, getClient } from './client.js';
export { resolveApiKey, isLikelyValidApiKey, SUPPORTED_ENV_VARS } from './config.js';
