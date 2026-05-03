import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, compact, fencedJson, runMcp } from './_shared.js';

const WRITE_WARNING =
  '⚠️ Submits an on-chain transaction using your KeeperHub wallet. Verify all parameters before invoking.';

const ExecuteTransferParams = Type.Object({
  network: Type.String({ description: 'EVM chain id, e.g. "1", "137", "8453".' }),
  recipient_address: Type.String({
    description: 'Recipient EVM address (0x-prefixed, 40 hex chars).',
  }),
  amount: Type.String({
    description: 'Amount to transfer, expressed as a decimal string (e.g. "0.1").',
  }),
  token_address: Type.Optional(
    Type.String({
      description:
        'Optional ERC20 contract address. Omit to transfer the chain native token.',
    }),
  ),
});

const ExecuteContractCallParams = Type.Object({
  contract_address: Type.String({ description: 'Target contract address (0x-prefixed).' }),
  network: Type.String({ description: 'EVM chain id, e.g. "1".' }),
  function_name: Type.String({ description: 'Solidity function name to call.' }),
  function_args: Type.Optional(
    Type.String({
      description:
        'Optional JSON-encoded array of arguments, e.g. \'["0xd8dA...", "1000"]\'.',
    }),
  ),
  abi: Type.Optional(
    Type.String({
      description:
        'Optional contract ABI (JSON-encoded string). KeeperHub auto-resolves common contracts.',
    }),
  ),
});

const ConditionParams = Type.Object({
  operator: Type.Union(
    [
      Type.Literal('eq'),
      Type.Literal('neq'),
      Type.Literal('gt'),
      Type.Literal('gte'),
      Type.Literal('lt'),
      Type.Literal('lte'),
    ],
    { description: 'Comparison operator.' },
  ),
  value: Type.Union([Type.String(), Type.Number(), Type.Boolean()], {
    description: 'Value to compare the read result against.',
  }),
});

const ActionParams = Type.Object({
  contract_address: Type.String(),
  function_name: Type.String(),
  function_args: Type.Optional(Type.String()),
  abi: Type.Optional(Type.String()),
  network: Type.Optional(Type.String()),
});

const CheckAndExecuteParams = Type.Object({
  contract_address: Type.String(),
  network: Type.String(),
  function_name: Type.String(),
  function_args: Type.Optional(Type.String()),
  abi: Type.Optional(Type.String()),
  condition: ConditionParams,
  action: ActionParams,
});

const DirectExecutionIdParams = Type.Object({
  execution_id: Type.String({
    description: 'Direct execution id returned by kh_execute_transfer / kh_execute_contract_call.',
  }),
});

export function registerDirectTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_execute_transfer',
    description: `${WRITE_WARNING} Transfer native tokens (ETH, MATIC) or ERC20 tokens from your KeeperHub wallet to a recipient address. Requires a configured wallet integration.`,
    parameters: ExecuteTransferParams,
    async execute(_id, params: Static<typeof ExecuteTransferParams>) {
      const args = compact(params);
      return runMcp(api, 'execute_transfer', args, (result) => {
        const r = asRecord(result);
        return [
          '**Transfer submitted!**',
          `Recipient: \`${params.recipient_address}\``,
          `Amount: ${params.amount}`,
          r.executionId ? `Execution ID: \`${r.executionId}\`` : '',
          r.transactionHash ? `TX Hash: \`${r.transactionHash}\`` : '',
        ]
          .filter(Boolean)
          .join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_execute_contract_call',
    description:
      'Call a smart contract function. For view/pure functions, returns the result directly. For state-changing functions, submits a transaction via your KeeperHub wallet integration.',
    parameters: ExecuteContractCallParams,
    async execute(_id, params: Static<typeof ExecuteContractCallParams>) {
      const args = compact(params);
      return runMcp(api, 'execute_contract_call', args, (result) => {
        return [
          `**Contract Call: \`${params.function_name}\`**`,
          `Contract: \`${params.contract_address}\``,
          `Network: ${params.network}`,
          '',
          'Result:',
          fencedJson(result),
        ].join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_execute_check_and_execute',
    description: `${WRITE_WARNING} Read a contract value, evaluate a condition, and execute an on-chain action if the condition is met (e.g. "if balance > 1000 then transfer"). Requires a configured wallet integration.`,
    parameters: CheckAndExecuteParams,
    async execute(_id, params: Static<typeof CheckAndExecuteParams>) {
      return runMcp(api, 'execute_check_and_execute', params as Record<string, unknown>, (result) => {
        const r = asRecord(result);
        return [
          '**Check-and-Execute submitted!**',
          r.executionId ? `Execution ID: \`${r.executionId}\`` : '',
          r.conditionMet !== undefined ? `Condition met: ${r.conditionMet}` : '',
          r.transactionHash ? `TX Hash: \`${r.transactionHash}\`` : '',
        ]
          .filter(Boolean)
          .join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_get_direct_execution_status',
    description:
      'Get the status of a direct execution (transfer or contract call). Returns transaction hash, status, and result when complete.',
    parameters: DirectExecutionIdParams,
    async execute(_id, params: Static<typeof DirectExecutionIdParams>) {
      return runMcp(
        api,
        'get_direct_execution_status',
        { execution_id: params.execution_id },
        (result) => {
          const r = asRecord(result);
          return [
            `**Direct Execution: \`${params.execution_id}\`**`,
            `Status: ${r.status ?? 'unknown'}`,
            r.transactionHash ? `TX Hash: \`${r.transactionHash}\`` : '',
            r.result !== undefined ? `Result: ${JSON.stringify(r.result)}` : '',
            r.error ? `Error: ${r.error}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        },
      );
    },
  });
}
