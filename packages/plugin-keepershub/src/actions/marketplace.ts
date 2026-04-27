import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { extractJson, handleToolCall, validateKeeperHub } from './_helpers.ts';

export const searchMarketplaceWorkflowsAction: Action = {
  name: 'SEARCH_WORKFLOWS_MARKETPLACE',
  similes: ['search_workflows_marketplace', 'MARKETPLACE_SEARCH', 'PUBLIC_WORKFLOWS', 'FIND_LISTED_WORKFLOWS'],
  description: 'Search KeeperHub\'s marketplace of publicly listed callable workflows. Returns slug, description, inputSchema, and price for each match.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const query = text.replace(/search|marketplace|public|listed|workflows?|find/gi, '').trim();
    const category = text.match(/category[:\s]+(\w+)/i)?.[1];
    const chain = text.match(/(?:chain|network)[:\s]+([0-9]+)/i)?.[1];

    const args: Record<string, unknown> = {};
    if (query) args.query = query;
    if (category) args.category = category;
    if (chain) args.chain = chain;

    return handleToolCall('search_workflows', args, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const items = (r.items as Record<string, unknown>[]) ?? (Array.isArray(result) ? (result as Record<string, unknown>[]) : []);
      const total = r.total ?? items.length;

      if (items.length === 0) return 'No marketplace workflows found matching your query.';
      const lines = items.map((w, i) => {
        const price = w.priceUsdcPerCall ? `$${w.priceUsdcPerCall} USDC/call` : 'free';
        return `${i + 1}. **${w.name ?? 'Untitled'}** (\`${w.listedSlug ?? w.id}\`) — ${price}\n   ${w.description ?? ''}`.trimEnd();
      });
      return `**Marketplace Workflows (${total}):**\n\n${lines.join('\n\n')}\n\nUse "call workflow <slug>" to invoke one.`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Search marketplace workflows for defi monitoring' } },
      { name: '{{agent}}', content: { text: '**Marketplace Workflows (3):**\n\n1. **Aave Monitor** (`aave-monitor`)', actions: ['SEARCH_WORKFLOWS_MARKETPLACE'] } },
    ],
  ],
};

export const callWorkflowAction: Action = {
  name: 'CALL_WORKFLOW',
  similes: ['call_workflow', 'INVOKE_WORKFLOW', 'CALL_LISTED_WORKFLOW', 'RUN_MARKETPLACE_WORKFLOW'],
  description: 'Invoke a publicly listed KeeperHub marketplace workflow by slug. For read workflows, executes and returns the result. For write workflows, returns unsigned calldata.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown> = {}, callback?: HandlerCallback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);

    const slug = (parsed.slug as string) ?? text.match(/(?:slug|workflow)[:\s]+([a-z0-9_-]+)/i)?.[1];
    const inputs = (parsed.inputs as Record<string, unknown>) ?? {};

    if (!slug) {
      const errText = 'Please provide a workflow slug. Use "search marketplace workflows" to find available slugs.';
      if (callback) await callback({ text: errText, source: message.content.source });
      return { success: false, error: new Error('Missing slug') };
    }

    return handleToolCall('call_workflow', { slug, inputs }, runtime, message, callback, (result) => {
      return `**Workflow \`${slug}\` result:**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Call workflow aave-health-check with {"address":"0x123..."}' } },
      { name: '{{agent}}', content: { text: '**Workflow `aave-health-check` result:**\n\n```json\n{"healthFactor":"2.5"}\n```', actions: ['CALL_WORKFLOW'] } },
    ],
  ],
};
