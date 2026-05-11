import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import {
  extractId,
  extractJson,
  handleToolCall,
  validateKeeperHub,
  validationError,
} from './_helpers.ts';

export const searchProtocolActionsAction: Action = {
  name: 'SEARCH_PROTOCOL_ACTIONS',
  similes: ['search_protocol_actions', 'FIND_PROTOCOL_ACTIONS', 'DEFI_ACTIONS', 'PROTOCOL_SEARCH'],
  description: 'Search for available DeFi protocol actions across Aave, Morpho, Chronicle, Chainlink, Uniswap, Compound, Lido, and more.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const query = text.replace(/search|find|protocol|actions?|defi/gi, '').trim();
    const protocol = text.match(/\b(aave|morpho|chronicle|chainlink|uniswap|compound|lido|maker)\b/i)?.[1];

    const args: Record<string, unknown> = {};
    if (query) args.query = query;
    if (protocol) args.protocol = protocol.toLowerCase();

    return handleToolCall('search_protocol_actions', args, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const actions = (r.actions as Record<string, unknown>[]) ?? [];
      const count = r.count ?? actions.length;

      if (!actions.length) return 'No protocol actions found matching your query.';
      const lines = actions.map((a) =>
        `- \`${a.actionType}\` — ${a.description ?? a.label ?? ''} ` +
        `[${a.requiresCredentials ? 'requires wallet' : 'read-only'}]`
      );
      return `**Protocol Actions (${count}):**\n\n${lines.join('\n')}`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Search protocol actions for aave health factor' } },
      { name: '{{agent}}', content: { text: '**Protocol Actions (1):**\n\n- `aave/get-user-account-data` — Get overall account health', actions: ['SEARCH_PROTOCOL_ACTIONS'] } },
    ],
  ],
};

export const executeProtocolActionAction: Action = {
  name: 'EXECUTE_PROTOCOL_ACTION',
  similes: ['execute_protocol_action', 'RUN_PROTOCOL_ACTION', 'DEFI_READ', 'PROTOCOL_CALL'],
  description: 'Execute a DeFi protocol action directly (e.g. read Aave health factor, get Chainlink price, check Morpho position). Use search_protocol_actions first to discover available actions.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);

    const actionType =
      ((parsed.actionType as string) ?? extractId(text, ['actionType', 'action']))?.trim();
    const params = (parsed.params as Record<string, unknown>) ?? parsed;

    if (!actionType) {
      return validationError(
        'Please provide an actionType (e.g. "aave/get-user-account-data"). Use **search protocol actions** to discover available types.',
        'Missing actionType',
        callback,
        message,
        { field: 'actionType' }
      );
    }

    // Remove meta fields from params
    const cleanParams: Record<string, unknown> = { ...params };
    delete cleanParams.actionType;

    return handleToolCall('execute_protocol_action', { actionType, params: cleanParams }, runtime, message, callback, (result) => {
      return `**Protocol Action: \`${actionType}\`**\n\nResult:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Execute protocol action {"actionType":"aave/get-user-account-data","params":{"network":"1","user":"0x123..."}}' } },
      { name: '{{agent}}', content: { text: '**Protocol Action: `aave/get-user-account-data`**\n\nResult:\n```json\n{"healthFactor":"..."}```', actions: ['EXECUTE_PROTOCOL_ACTION'] } },
    ],
  ],
};
