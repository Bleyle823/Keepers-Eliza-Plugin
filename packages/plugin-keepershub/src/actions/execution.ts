import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { extractId, handleToolCall, validateKeeperHub, validationError } from './_helpers.ts';

const EXECUTION_KEYWORDS = ['executionId', 'execution', 'exec', 'id'];

export const getExecutionStatusAction: Action = {
  name: 'GET_EXECUTION_STATUS',
  similes: ['get_execution_status', 'CHECK_EXECUTION', 'EXECUTION_STATUS', 'WORKFLOW_STATUS'],
  description: 'Get the current status of a KeeperHub workflow execution by execution ID.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const executionId = extractId(text, EXECUTION_KEYWORDS);

    if (!executionId) {
      return validationError(
        'Please provide an execution ID. Example: `get execution status executionId: exec_clr1k2j3a0001x9pq7e2v3w4f`.',
        'Missing executionId',
        callback,
        message,
        { field: 'executionId' }
      );
    }

    return handleToolCall('get_execution_status', { executionId }, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const status = r.status ?? r.state ?? 'unknown';
      const lines = [
        `**Execution ID:** \`${executionId}\``,
        `**Status:** ${status}`,
      ];
      if (r.startedAt) lines.push(`**Started:** ${r.startedAt}`);
      if (r.completedAt) lines.push(`**Completed:** ${r.completedAt}`);
      if (r.error) lines.push(`**Error:** ${r.error}`);
      return lines.join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Get execution status exec456' } },
      { name: '{{agent}}', content: { text: '**Execution ID:** `exec456`\n**Status:** completed', actions: ['GET_EXECUTION_STATUS'] } },
    ],
  ],
};

export const getExecutionLogsAction: Action = {
  name: 'GET_EXECUTION_LOGS',
  similes: ['get_execution_logs', 'EXECUTION_LOGS', 'WORKFLOW_LOGS', 'CHECK_LOGS'],
  description: 'Get detailed step-by-step logs for a KeeperHub workflow execution.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const executionId = extractId(text, ['executionId', 'execution', 'exec', 'logs', 'id']);

    if (!executionId) {
      return validationError(
        'Please provide an execution ID to fetch logs for.',
        'Missing executionId',
        callback,
        message,
        { field: 'executionId' }
      );
    }

    return handleToolCall('get_execution_logs', { executionId }, runtime, message, callback, (result) => {
      return `**Execution Logs for \`${executionId}\`:**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Get logs for execution exec456' } },
      { name: '{{agent}}', content: { text: '**Execution Logs for `exec456`:**\n\n```json\n{...}\n```', actions: ['GET_EXECUTION_LOGS'] } },
    ],
  ],
};
