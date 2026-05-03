import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, fencedJson, runMcp, toToolError } from './_shared.js';

const AiGenerateParams = Type.Object({
  prompt: Type.String({
    description:
      'Natural-language description of the workflow to generate, e.g. "Monitor Aave health factor and send Discord alert when below 1.5".',
    minLength: 1,
  }),
});

const ToolsDocsParams = Type.Object({});

export function registerGenerateTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_ai_generate_workflow',
    description:
      'Generate a complete KeeperHub workflow definition from a natural-language description using KeeperHub AI. Returns a workflow ready to be saved with kh_create_workflow.',
    parameters: AiGenerateParams,
    async execute(_id, params: Static<typeof AiGenerateParams>) {
      const prompt = params.prompt.trim();
      if (!prompt) {
        return toToolError(
          'Missing prompt. Describe the workflow you want to generate, e.g. "Generate a workflow that monitors USDC transfers over $10k and sends a Discord alert".',
        );
      }
      return runMcp(api, 'ai_generate_workflow', { prompt }, (result) => {
        const r = asRecord(result);
        const raw = r.result as string | undefined;

        if (!raw) {
          return [
            '**AI Generated Workflow:**',
            '',
            fencedJson(result),
            '',
            'Use kh_create_workflow to save this workflow.',
          ].join('\n');
        }

        return [
          '**AI Generated Workflow Definition:**',
          '',
          '```',
          raw.trim(),
          '```',
          '',
          'Review the definition above, then use kh_create_workflow with the assembled nodes and edges to save it.',
        ].join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_tools_documentation',
    description:
      'Get comprehensive documentation on how to use all KeeperHub MCP tools, including workflow creation guide, template syntax, and supported chain IDs.',
    parameters: ToolsDocsParams,
    async execute(_id, _params: Static<typeof ToolsDocsParams>) {
      return runMcp(api, 'tools_documentation', {}, (result) => {
        if (typeof result === 'string') return result;
        return `**KeeperHub MCP Documentation:**\n\n${fencedJson(result)}`;
      });
    },
  });
}
