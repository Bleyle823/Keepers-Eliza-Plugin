import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { handleToolCall, validateKeeperHub, validationError } from './_helpers.ts';

export const aiGenerateWorkflowAction: Action = {
  name: 'AI_GENERATE_WORKFLOW',
  similes: ['ai_generate_workflow', 'GENERATE_WORKFLOW', 'AI_WORKFLOW', 'CREATE_WORKFLOW_FROM_DESCRIPTION'],
  description: 'Generate a complete KeeperHub workflow definition from a natural language description using AI. Returns a workflow ready to be created with CREATE_WORKFLOW.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const prompt = text
      .replace(/(?:generate|create|build|make|ai)[- ](?:a\s)?workflow/gi, '')
      .replace(/^[:\s]+/, '')
      .trim();

    if (!prompt) {
      return validationError(
        'Please describe the workflow you want to generate. Example: "Generate a workflow that monitors USDC transfers over $10k and sends a Discord alert".',
        'Missing prompt',
        callback,
        message,
        { field: 'prompt' }
      );
    }

    return handleToolCall('ai_generate_workflow', { prompt }, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const raw = r.result as string | undefined;

      if (!raw) {
        return `**AI Generated Workflow:**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\nUse CREATE_WORKFLOW to save this workflow.`;
      }

      return [
        '**AI Generated Workflow Definition:**',
        '',
        '```',
        raw.trim(),
        '```',
        '',
        'Review the definition above, then use "create workflow" with the assembled nodes and edges to save it.',
      ].join('\n');
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Generate a workflow that monitors an Aave health factor and sends Discord alert when below 1.5' } },
      { name: '{{agent}}', content: { text: '**AI Generated Workflow Definition:**\n\n```\n{"op":"addNode",...}\n```', actions: ['AI_GENERATE_WORKFLOW'] } },
    ],
  ],
};

export const toolsDocumentationAction: Action = {
  name: 'TOOLS_DOCUMENTATION',
  similes: ['tools_documentation', 'KEEPERHUB_DOCS', 'MCP_DOCS', 'KEEPERHUB_HELP'],
  description: 'Get comprehensive documentation on how to use all KeeperHub MCP tools, including workflow creation guide, template syntax, and chain IDs.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    return handleToolCall('tools_documentation', {}, runtime, message, callback, (result) => {
      if (typeof result === 'string') return result;
      return `**KeeperHub MCP Documentation:**\n\n${JSON.stringify(result, null, 2)}`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Show KeeperHub documentation' } },
      { name: '{{agent}}', content: { text: '**KeeperHub MCP Documentation:**\n\nWORKFLOW CREATION\n1. Call list_action_schemas...', actions: ['TOOLS_DOCUMENTATION'] } },
    ],
  ],
};
