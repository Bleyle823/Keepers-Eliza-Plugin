import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, fencedJson, runMcp } from './_shared.js';

const ExecutionIdParams = Type.Object({
  executionId: Type.String({
    description: 'KeeperHub execution id returned by kh_execute_workflow.',
  }),
});

export function registerExecutionTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_get_execution_status',
    description: 'Get the current status of a KeeperHub workflow execution by execution ID.',
    parameters: ExecutionIdParams,
    async execute(_id, params: Static<typeof ExecutionIdParams>) {
      return runMcp(
        api,
        'get_execution_status',
        { executionId: params.executionId },
        (result) => {
          const r = asRecord(result);
          const status = (r.status ?? r.state ?? 'unknown') as string;
          const lines = [
            `**Execution ID:** \`${params.executionId}\``,
            `**Status:** ${status}`,
          ];
          if (r.startedAt) lines.push(`**Started:** ${r.startedAt}`);
          if (r.completedAt) lines.push(`**Completed:** ${r.completedAt}`);
          if (r.error) lines.push(`**Error:** ${r.error}`);
          return lines.join('\n');
        },
      );
    },
  });

  api.registerTool({
    name: 'kh_get_execution_logs',
    description: 'Get detailed step-by-step logs for a KeeperHub workflow execution.',
    parameters: ExecutionIdParams,
    async execute(_id, params: Static<typeof ExecutionIdParams>) {
      return runMcp(
        api,
        'get_execution_logs',
        { executionId: params.executionId },
        (result) => `**Execution Logs for \`${params.executionId}\`:**\n\n${fencedJson(result)}`,
      );
    },
  });
}
