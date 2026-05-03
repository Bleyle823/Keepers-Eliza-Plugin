import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, compact, fencedJson, runMcp, toToolError, toToolText } from './_shared.js';
import { resolveClient } from './_shared.js';

const NOT_FOUND_RE = /workflow not found|404\s*not\s*found/i;

/**
 * A value looks like an opaque org workflow id (cuid/uuid family) when it is
 * a longish run of `[a-z0-9]` with no dashes/dots/slashes. Marketplace slugs
 * are kebab-case and almost always contain a dash.
 *
 * Ported verbatim from packages/plugin-keepershub/src/actions/marketplace.ts.
 */
export function looksLikeWorkflowId(value: string): boolean {
  return /^[a-z0-9]{16,}$/i.test(value);
}

const SearchMarketplaceParams = Type.Object({
  query: Type.Optional(Type.String({ description: 'Free-text query.' })),
  category: Type.Optional(Type.String({ description: 'Optional category filter.' })),
  chain: Type.Optional(Type.String({ description: 'Optional chain id filter, e.g. "1".' })),
});

const CallWorkflowParams = Type.Object({
  slug: Type.String({
    description:
      'Marketplace workflow slug or organization workflow id. The tool transparently retries opaque ids against the org execute endpoint when the marketplace lookup misses.',
  }),
  inputs: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: 'Inputs payload to pass to the workflow.',
    }),
  ),
});

export function registerMarketplaceTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_search_workflows_marketplace',
    description:
      "Search KeeperHub's marketplace of publicly listed callable workflows. Returns slug, description, inputSchema, and price for each match.",
    parameters: SearchMarketplaceParams,
    async execute(_id, params: Static<typeof SearchMarketplaceParams>) {
      const args = compact({
        query: params.query,
        category: params.category,
        chain: params.chain,
      });
      return runMcp(api, 'search_workflows', args, (result) => {
        const r = asRecord(result);
        const items = Array.isArray(r.items)
          ? (r.items as Array<Record<string, unknown>>)
          : Array.isArray(result)
          ? (result as Array<Record<string, unknown>>)
          : [];
        const total = (r.total as number | undefined) ?? items.length;

        if (items.length === 0) return 'No marketplace workflows found matching your query.';
        const lines = items.map((w, i) => {
          const price = w.priceUsdcPerCall ? `$${w.priceUsdcPerCall} USDC/call` : 'free';
          const slug = w.listedSlug ?? w.id;
          return `${i + 1}. **${(w.name as string | undefined) ?? 'Untitled'}** (\`${slug}\`) — ${price}\n   ${(w.description as string | undefined) ?? ''}`.trimEnd();
        });
        return [
          `**Marketplace Workflows (${total}):**`,
          '',
          lines.join('\n\n'),
          '',
          'Use kh_call_workflow with `slug` to invoke one.',
        ].join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_call_workflow',
    description:
      "Invoke a publicly listed KeeperHub marketplace workflow by slug. For read workflows, executes and returns the result. For write workflows, returns unsigned calldata. If the slug doesn't match a marketplace listing the tool transparently retries it against the caller's organization workflows.",
    parameters: CallWorkflowParams,
    async execute(_id, params: Static<typeof CallWorkflowParams>) {
      const slug = params.slug.trim();
      const inputs = params.inputs ?? {};

      if (!slug) {
        return toToolError(
          'Missing slug. Use kh_search_workflows_marketplace to discover available slugs.',
        );
      }

      const resolved = resolveClient(api);
      if (resolved.error) return resolved.error;
      const client = resolved.client;

      // 1) Try the marketplace `call_workflow` tool first.
      try {
        const result = await client.callTool('call_workflow', { slug, inputs });
        return toToolText(`**Workflow \`${slug}\` result:**\n\n${fencedJson(result)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isNotFound = NOT_FOUND_RE.test(msg);

        if (!isNotFound) {
          api.logger?.error?.('[KeeperHub] call_workflow failed:', msg);
          return toToolError(err);
        }

        // 2) Marketplace miss. Try `execute_workflow` if the value looks like
        //    an opaque org workflow id, so the caller doesn't have to know
        //    which surface their workflow lives on.
        if (looksLikeWorkflowId(slug)) {
          api.logger?.info?.(
            `[KeeperHub] call_workflow: slug "${slug}" not in marketplace; trying execute_workflow as org workflow id`,
          );
          try {
            const args: Record<string, unknown> = { workflowId: slug };
            if (inputs && Object.keys(inputs).length > 0) args.input = inputs;
            const execResult = await client.callTool('execute_workflow', args);
            const r = asRecord(execResult);
            const execId = (r.executionId ?? r.id ?? 'unknown') as string;
            return toToolText(
              [
                `Workflow \`${slug}\` is not a marketplace listing, but matched an organization workflow — execution started.`,
                '',
                `**Execution ID:** \`${execId}\``,
                '',
                `Use kh_get_execution_status with executionId="${execId}" to check progress.`,
              ].join('\n'),
            );
          } catch (fallbackError) {
            const fbMsg =
              fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            api.logger?.warn?.(
              `[KeeperHub] execute_workflow fallback for "${slug}" also failed: ${fbMsg}`,
            );
            // fall through to the friendly not-found message
          }
        }

        // 3) Not found anywhere — return an actionable error.
        api.logger?.warn?.(`[KeeperHub] call_workflow: workflow "${slug}" not found in marketplace`);
        const friendly = [
          `KeeperHub workflow \`${slug}\` was not found in the marketplace.`,
          '',
          'Things to try:',
          '- Run kh_search_workflows_marketplace to discover valid slugs (the field is `listedSlug`).',
          `- If this is one of your own workflows, use kh_execute_workflow with workflowId="${slug}".`,
          '- Verify the slug is published/listed in your KeeperHub project.',
        ].join('\n');
        return { content: [{ type: 'text', text: friendly }], isError: true };
      }
    },
  });
}
