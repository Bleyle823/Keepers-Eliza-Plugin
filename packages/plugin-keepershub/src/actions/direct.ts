import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import {
  extractId,
  extractJson,
  handleToolCall,
  validateKeeperHub,
  validationError,
} from './_helpers.ts';

const WRITE_WARNING =
  '⚠️ This action submits an on-chain transaction using your KeeperHub wallet. ' +
  'Ensure the parameters are correct before proceeding.';

export const executeTransferAction: Action = {
  name: 'EXECUTE_TRANSFER',
  similes: ['execute_transfer', 'SEND_TRANSFER', 'TRANSFER_TOKENS', 'SEND_ETH'],
  description: `${WRITE_WARNING} Transfer native tokens (ETH, MATIC) or ERC20 tokens from your KeeperHub wallet to a recipient address. Requires a wallet integration.`,

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);

    const network = (parsed.network as string) ?? text.match(/(?:chain|network)[:\s]+([0-9]+)/i)?.[1];
    const recipient_address =
      (parsed.recipient_address as string) ?? text.match(/to[:\s]+(0x[a-fA-F0-9]{40})/)?.[1];
    const amount =
      (parsed.amount as string) ?? text.match(/amount[:\s]+([\d.]+)/i)?.[1];
    const token_address = parsed.token_address as string | undefined;

    const missing: string[] = [];
    if (!network) missing.push('network');
    if (!recipient_address) missing.push('recipient_address');
    if (!amount) missing.push('amount');

    if (missing.length > 0) {
      return validationError(
        [
          `Missing required parameters for transfer: ${missing.join(', ')}.`,
          'Provide JSON like:',
          '`{"network":"1","recipient_address":"0x...","amount":"0.1"}`',
        ].join('\n'),
        `Missing fields: ${missing.join(', ')}`,
        callback,
        message,
        { fields: missing }
      );
    }

    const args: Record<string, unknown> = { network, recipient_address, amount };
    if (token_address) args.token_address = token_address;

    return handleToolCall('execute_transfer', args, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const lines = [
        `**Transfer submitted!**`,
        `Recipient: \`${recipient_address}\``,
        `Amount: ${amount}`,
        r.executionId ? `Execution ID: \`${r.executionId}\`` : '',
        r.transactionHash ? `TX Hash: \`${r.transactionHash}\`` : '',
      ].filter(Boolean);
      return lines.join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Transfer {"network":"1","recipient_address":"0x123...","amount":"0.01"}' } },
      { name: '{{agent}}', content: { text: '**Transfer submitted!**\nRecipient: `0x123...`\nAmount: 0.01', actions: ['EXECUTE_TRANSFER'] } },
    ],
  ],
};

export const executeContractCallAction: Action = {
  name: 'EXECUTE_CONTRACT_CALL',
  similes: ['execute_contract_call', 'CONTRACT_CALL', 'CALL_CONTRACT', 'READ_CONTRACT_DIRECT'],
  description: 'Call a smart contract function. For view/pure functions, returns the result directly. For state-changing functions, submits a transaction via your KeeperHub wallet.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);

    const contract_address =
      (parsed.contract_address as string) ?? text.match(/contract[:\s]+(0x[a-fA-F0-9]{40})/i)?.[1];
    const network = (parsed.network as string) ?? text.match(/(?:chain|network)[:\s]+([0-9]+)/i)?.[1];
    const function_name = (parsed.function_name as string) ?? text.match(/function[:\s]+(\w+)/i)?.[1];
    const function_args = parsed.function_args as string | undefined;
    const abi = parsed.abi as string | undefined;

    const missing: string[] = [];
    if (!contract_address) missing.push('contract_address');
    if (!network) missing.push('network');
    if (!function_name) missing.push('function_name');

    if (missing.length > 0) {
      return validationError(
        [
          `Missing required parameters for contract call: ${missing.join(', ')}.`,
          'Provide JSON like:',
          '`{"contract_address":"0x...","network":"1","function_name":"balanceOf","function_args":"[\\"0x...\\"]"}`',
        ].join('\n'),
        `Missing fields: ${missing.join(', ')}`,
        callback,
        message,
        { fields: missing }
      );
    }

    const args: Record<string, unknown> = { contract_address, network, function_name };
    if (function_args) args.function_args = function_args;
    if (abi) args.abi = abi;

    return handleToolCall('execute_contract_call', args, runtime, message, callback, (result) => {
      return [
        `**Contract Call: \`${function_name}\`**`,
        `Contract: \`${contract_address}\``,
        `Network: ${network}`,
        '',
        `Result:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
      ].join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Call contract {"contract_address":"0xC02a...","network":"1","function_name":"balanceOf","function_args":"[\\"0xd8dA...\\"]"}' } },
      { name: '{{agent}}', content: { text: '**Contract Call: `balanceOf`**\n\nResult:\n```json\n"1000"```', actions: ['EXECUTE_CONTRACT_CALL'] } },
    ],
  ],
};

export const executeCheckAndExecuteAction: Action = {
  name: 'EXECUTE_CHECK_AND_EXECUTE',
  similes: ['execute_check_and_execute', 'CHECK_AND_EXECUTE', 'CONDITIONAL_EXECUTE'],
  description: `${WRITE_WARNING} Read a contract value, evaluate a condition, and execute an on-chain action if the condition is met (e.g. "if balance > 1000 then transfer"). Requires a wallet integration.`,

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);

    const required = ['contract_address', 'network', 'function_name', 'condition', 'action'];
    const missing = required.filter((k) => !parsed[k]);

    if (missing.length > 0) {
      return validationError(
        [
          `Missing required fields for check-and-execute: ${missing.join(', ')}.`,
          'Provide a full JSON with: contract_address, network, function_name, condition {operator, value}, action {contract_address, function_name}.',
        ].join('\n'),
        `Missing fields: ${missing.join(', ')}`,
        callback,
        message,
        { fields: missing }
      );
    }

    return handleToolCall('execute_check_and_execute', parsed, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      return [
        '**Check-and-Execute submitted!**',
        r.executionId ? `Execution ID: \`${r.executionId}\`` : '',
        r.conditionMet !== undefined ? `Condition met: ${r.conditionMet}` : '',
        r.transactionHash ? `TX Hash: \`${r.transactionHash}\`` : '',
      ].filter(Boolean).join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Execute check and execute {"contract_address":"0x...","network":"1","function_name":"balanceOf","condition":{"operator":"gt","value":"100"},"action":{"contract_address":"0x...","function_name":"transfer"}}' } },
      { name: '{{agent}}', content: { text: '**Check-and-Execute submitted!**', actions: ['EXECUTE_CHECK_AND_EXECUTE'] } },
    ],
  ],
};

export const getDirectExecutionStatusAction: Action = {
  name: 'GET_DIRECT_EXECUTION_STATUS',
  similes: ['get_direct_execution_status', 'DIRECT_EXECUTION_STATUS', 'TX_STATUS', 'TRANSACTION_STATUS'],
  description: 'Get the status of a direct execution (transfer or contract call). Returns transaction hash, status, and result when complete.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const execution_id = extractId(text, ['execution_id', 'executionId', 'execution', 'exec', 'id']);

    if (!execution_id) {
      return validationError(
        'Please provide an execution ID for the direct execution status check.',
        'Missing execution_id',
        callback,
        message,
        { field: 'execution_id' }
      );
    }

    return handleToolCall('get_direct_execution_status', { execution_id }, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      return [
        `**Direct Execution: \`${execution_id}\`**`,
        `Status: ${r.status ?? 'unknown'}`,
        r.transactionHash ? `TX Hash: \`${r.transactionHash}\`` : '',
        r.result ? `Result: ${JSON.stringify(r.result)}` : '',
        r.error ? `Error: ${r.error}` : '',
      ].filter(Boolean).join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Get direct execution status exec123' } },
      { name: '{{agent}}', content: { text: '**Direct Execution: `exec123`**\nStatus: completed', actions: ['GET_DIRECT_EXECUTION_STATUS'] } },
    ],
  ],
};
