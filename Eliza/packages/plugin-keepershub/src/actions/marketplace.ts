import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger } from '@elizaos/core';
import {
  extractJson,
  failureResult,
  getService,
  handleToolCall,
  validateKeeperHub,
  validationError,
} from './_helpers.ts';

/**
 * Extract a workflow slug from free-form text.
 *
 * Handles common phrasings used by agents and humans, e.g.:
 *   - "call workflow aave-monitor"
 *   - "invoke slug: keeperhub/aave-monitor"
 *   - "run workflow `aave-health-check`"
 *   - 'call workflow "aave-monitor.v2"'
 *
 * Slugs may contain lowercase letters, digits, dashes, underscores, dots
 * (versioned slugs) and forward slashes (namespaced slugs). Surrounding
 * quotes/backticks are stripped.
 *
 * To avoid false positives on plain English (e.g. "call workflow for me"
 * matching `for`), we only accept tokens that either:
 *   - follow an explicit separator (`:`, `=`) or quote/backtick, or
 *   - contain a slug-flavoured character (digit, `-`, `_`, `.` or `/`).
 */
export function extractSlug(text: string): string | null {
  // 1) "slug:X" / "slug=X" / "workflow:X" / "workflow=X" with optional quoting
  const keyed = text.match(
    /(?:slug|workflow)\s*[:=]\s*[`'"]?([a-z0-9][a-z0-9_./-]*)[`'"]?/i
  );
  if (keyed?.[1]) return keyed[1].replace(/[`'".,]+$/, '');

  // 2) "slug X" / "workflow X" where X is quoted
  const keywordQuoted = text.match(
    /(?:slug|workflow)\s+[`'"]([a-z0-9][a-z0-9_./-]*)[`'"]/i
  );
  if (keywordQuoted?.[1]) return keywordQuoted[1];

  // 3) "slug X" / "workflow X" where X has slug-flavoured chars (dash, digit,
  //    dot, slash, underscore) so we don't match plain English words like "for".
  const keywordSluggy = text.match(
    /(?:slug|workflow)\s+([a-z0-9][a-z0-9_]*[-./_][a-z0-9_./-]*|[a-z0-9]*\d[a-z0-9_./-]*)/i
  );
  if (keywordSluggy?.[1]) return keywordSluggy[1].replace(/[`'".,]+$/, '');

  // 4) Fall back to a quoted slug-flavoured token anywhere in the message.
  const quoted = text.match(
    /[`'"]([a-z0-9][a-z0-9_]*[-./_][a-z0-9_./-]*|[a-z0-9]*\d[a-z0-9_./-]*)[`'"]/i
  );
  if (quoted?.[1]) return quoted[1];

  return null;
}

/**
 * Pick out an inputs object from free-form text. Accepts either:
 *   - `{"inputs": {...}}` — explicit wrapper
 *   - `{...}` — a bare object (assumed to be the inputs payload)
 */
function extractInputs(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed && typeof parsed.inputs === 'object' && parsed.inputs !== null) {
    return parsed.inputs as Record<string, unknown>;
  }
  // If the user provided a bare JSON object that isn't a {slug, inputs}
  // envelope, treat the whole thing as the inputs payload.
  const isEnvelope = parsed && (typeof parsed.slug === 'string' || 'inputs' in parsed);
  if (parsed && !isEnvelope && Object.keys(parsed).length > 0) {
    return parsed;
  }
  return {};
}

/**
 * A value looks like an opaque org-workflow id (e.g. cuid/cuid2/uuid) when it
 * is a longish run of [a-z0-9] with no dashes/dots/slashes. Marketplace slugs
 * are kebab-case and almost always contain a dash.
 */
export function looksLikeWorkflowId(value: string): boolean {
  return /^[a-z0-9]{16,}$/i.test(value);
}

const NOT_FOUND_RE = /workflow not found|404\s*not\s*found/i;

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
  description:
    "Invoke a publicly listed KeeperHub marketplace workflow by slug. For read workflows, executes and returns the result. For write workflows, returns unsigned calldata. If the slug doesn't match a marketplace listing it will transparently try the caller's organization workflows.",

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> = {},
    callback?: HandlerCallback
  ) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);

    const slug = ((parsed.slug as string) ?? extractSlug(text))?.trim();
    const inputs = extractInputs(parsed);

    if (!slug) {
      return validationError(
        'Please provide a workflow slug. Use SEARCH_WORKFLOWS_MARKETPLACE ("search marketplace workflows ...") to discover available slugs.',
        'Missing slug',
        callback,
        message,
        { field: 'slug' }
      );
    }

    let svc;
    try {
      svc = getService(runtime);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return failureResult(msg, callback, message, { tool: 'call_workflow', stage: 'service_init' });
    }

    // 1) Try the marketplace `call_workflow` tool first.
    try {
      const result = await svc.callTool('call_workflow', { slug, inputs });
      const successText = `**Workflow \`${slug}\` result:**\n\n\`\`\`json\n${JSON.stringify(
        result,
        null,
        2
      )}\n\`\`\``;
      if (callback) await callback({ text: successText, source: message.content.source });
      return { text: successText, success: true, data: { result, via: 'call_workflow' } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isNotFound = NOT_FOUND_RE.test(msg);

      if (!isNotFound) {
        logger.error('[KeeperHub] call_workflow failed:', msg);
        return failureResult(msg, callback, message, {
          tool: 'call_workflow',
          args: { slug, inputs },
          stage: 'tool_call',
        });
      }

      // 2) Marketplace miss. If the value looks like an opaque org workflow id,
      //    transparently try `execute_workflow` so the user doesn't have to
      //    know which surface their workflow lives on.
      if (looksLikeWorkflowId(slug)) {
        logger.info(
          `[KeeperHub] call_workflow: slug "${slug}" not in marketplace; trying execute_workflow as org workflow id`
        );
        try {
          const args: Record<string, unknown> = { workflowId: slug };
          if (inputs && Object.keys(inputs).length > 0) args.input = inputs;
          const execResult = await svc.callTool('execute_workflow', args);
          const r = execResult as Record<string, unknown>;
          const execId = (r?.executionId ?? r?.id ?? 'unknown') as string;
          const successText =
            `Workflow \`${slug}\` is not a marketplace listing, but matched an organization workflow — execution started.\n\n` +
            `**Execution ID:** \`${execId}\`\n\nUse "get execution status ${execId}" to check progress.`;
          if (callback) await callback({ text: successText, source: message.content.source });
          return {
            text: successText,
            success: true,
            data: { result: execResult, via: 'execute_workflow', executionId: execId },
          };
        } catch (fallbackError) {
          const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          logger.warn(
            `[KeeperHub] execute_workflow fallback for "${slug}" also failed: ${fbMsg}`
          );
          // fall through to the friendly not-found message
        }
      }

      // 3) Truly not found anywhere we can reach — give the user something
      //    actionable instead of a raw 404.
      logger.warn(`[KeeperHub] call_workflow: workflow "${slug}" not found in marketplace`);
      const friendly =
        `KeeperHub workflow \`${slug}\` was not found in the marketplace.\n\n` +
        `Things to try:\n` +
        `- Run **search marketplace workflows** to discover valid slugs (the field is \`listedSlug\`).\n` +
        `- If this is one of your own workflows, use **run workflow ${slug}** (EXECUTE_WORKFLOW) with the workflow id.\n` +
        `- Verify the slug is published/listed in your KeeperHub project.`;
      if (callback) await callback({ text: friendly, source: message.content.source });
      return {
        success: false,
        text: friendly,
        error: msg,
        data: { slug, reason: 'not_found', errorMessage: msg },
      };
    }
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Call workflow aave-health-check with {"address":"0x123..."}' } },
      {
        name: '{{agent}}',
        content: {
          text: '**Workflow `aave-health-check` result:**\n\n```json\n{"healthFactor":"2.5"}\n```',
          actions: ['CALL_WORKFLOW'],
        },
      },
    ],
    [
      { name: '{{user}}', content: { text: 'call workflow `nonexistent-slug`' } },
      {
        name: '{{agent}}',
        content: {
          text:
            'KeeperHub workflow `nonexistent-slug` was not found in the marketplace. Run **search marketplace workflows** to discover valid slugs.',
          actions: ['CALL_WORKFLOW'],
        },
      },
    ],
  ],
};
