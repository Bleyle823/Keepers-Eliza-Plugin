/**
 * Tool-level tests.
 *
 * We don't mount a real OpenClaw runtime here. Instead, each tool registrar
 * is called against a `FakeApi` that captures the tool definitions, then we
 * invoke the captured `execute` directly with a fake `KeeperHubClient` to
 * verify:
 *   - parameter schemas validate as expected
 *   - the response shape is `{ content: [...], isError? }`
 *   - errors thrown by the client surface as `isError: true`
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Value } from '@sinclair/typebox/value';

import { __resetClientForTests, KeeperHubClient } from '../client.js';
import { looksLikeWorkflowId, registerMarketplaceTools } from '../tools/marketplace.js';
import { registerWorkflowTools } from '../tools/workflows.js';
import { registerExecutionTools } from '../tools/execution.js';
import { registerStatusTool } from '../tools/status.js';

interface CapturedTool {
  name: string;
  description: string;
  parameters: unknown;
  execute: (id: string, params: unknown) => Promise<unknown>;
}

function makeFakeApi(opts: { apiKey?: string } = {}) {
  const tools: CapturedTool[] = [];
  const logs: Array<{ level: string; args: unknown[] }> = [];
  const logger = {
    debug: (...args: unknown[]) => logs.push({ level: 'debug', args }),
    info: (...args: unknown[]) => logs.push({ level: 'info', args }),
    warn: (...args: unknown[]) => logs.push({ level: 'warn', args }),
    error: (...args: unknown[]) => logs.push({ level: 'error', args }),
  };
  const api = {
    id: 'keepershub',
    name: 'KeeperHub',
    config: {},
    pluginConfig: opts.apiKey ? { apiKey: opts.apiKey } : {},
    logger,
    registrationMode: 'full',
    registerTool(tool: CapturedTool) {
      tools.push(tool);
    },
  } as unknown as Parameters<typeof registerWorkflowTools>[0];
  return { api, tools, logs };
}

class FakeClient {
  public lastCall: { name: string; args: Record<string, unknown> } | null = null;
  constructor(
    private readonly handler: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<unknown> | unknown,
  ) {}
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    this.lastCall = { name, args };
    return this.handler(name, args);
  }
}

/**
 * Replace the `getClient` singleton with the supplied fake by setting the
 * matching api key in env, so the cached client returned by `resolveClient`
 * is our fake. This is simpler than reaching into the singleton.
 */
function withFakeClient<T>(client: FakeClient, fn: () => Promise<T>): Promise<T> {
  // Replace the singleton's `callTool` by patching getClient via env config
  // is more invasive than necessary; instead we expose a tiny module-level
  // override on KeeperHubClient.prototype just for the duration of the test.
  const original = KeeperHubClient.prototype.callTool;
  KeeperHubClient.prototype.callTool = async function patched(
    this: KeeperHubClient,
    name: string,
    args: Record<string, unknown> = {},
  ) {
    return client.callTool(name, args);
  };
  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      KeeperHubClient.prototype.callTool = original;
    });
}

beforeEach(() => __resetClientForTests());
afterEach(() => __resetClientForTests());

describe('registerWorkflowTools', () => {
  it('registers all 7 workflow tools with valid TypeBox parameter schemas', () => {
    const { api, tools } = makeFakeApi({ apiKey: 'kh_test' });
    registerWorkflowTools(api);

    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'kh_create_workflow',
        'kh_delete_workflow',
        'kh_execute_workflow',
        'kh_get_workflow',
        'kh_list_workflows',
        'kh_search_org_workflows',
        'kh_update_workflow',
      ].sort(),
    );

    const list = tools.find((t) => t.name === 'kh_list_workflows');
    expect(list).toBeDefined();
    expect(Value.Check(list!.parameters as never, {})).toBe(true);
    expect(Value.Check(list!.parameters as never, { projectId: 'p1' })).toBe(true);
    expect(Value.Check(list!.parameters as never, { projectId: 123 })).toBe(false);

    const exec = tools.find((t) => t.name === 'kh_execute_workflow');
    expect(Value.Check(exec!.parameters as never, { workflowId: 'wf-1' })).toBe(true);
    expect(Value.Check(exec!.parameters as never, {})).toBe(false);
  });

  it('kh_list_workflows returns a formatted text block on success', async () => {
    const { api, tools } = makeFakeApi({ apiKey: 'kh_test' });
    registerWorkflowTools(api);
    const list = tools.find((t) => t.name === 'kh_list_workflows')!;

    const fake = new FakeClient(async () => [
      { id: 'wf-1', name: 'Aave Guardian', enabled: true },
      { id: 'wf-2', name: 'ETH Filler', enabled: false },
    ]);
    const result = (await withFakeClient(fake, () =>
      list.execute('exec-1', {}) as Promise<{ content: Array<{ text: string }> }>,
    )) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.type).toBe('text');
    expect(result.content[0]!.text).toContain('Found 2 workflow(s)');
    expect(result.content[0]!.text).toContain('Aave Guardian');
    expect(result.content[0]!.text).toContain('disabled');
  });

  it('returns isError when the client throws', async () => {
    const { api, tools } = makeFakeApi({ apiKey: 'kh_test' });
    registerWorkflowTools(api);
    const exec = tools.find((t) => t.name === 'kh_execute_workflow')!;

    const fake = new FakeClient(async () => {
      throw new Error('Workflow not found');
    });
    const result = (await withFakeClient(fake, () =>
      exec.execute('exec-1', { workflowId: 'missing' }) as Promise<unknown>,
    )) as { content: Array<{ text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Workflow not found');
  });

  it('returns isError when no api key is configured', async () => {
    const { api, tools } = makeFakeApi();
    delete process.env.KH_API_KEY;
    delete process.env.KEEPERHUB_API_KEY;
    delete process.env.KEEPERSHUB_API_KEY;
    registerWorkflowTools(api);
    const list = tools.find((t) => t.name === 'kh_list_workflows')!;

    const result = (await list.execute('id', {})) as {
      content: Array<{ text: string }>;
      isError?: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/KH_API_KEY/);
  });
});

describe('registerExecutionTools', () => {
  it('formats execution status with optional fields', async () => {
    const { api, tools } = makeFakeApi({ apiKey: 'kh_test' });
    registerExecutionTools(api);
    const status = tools.find((t) => t.name === 'kh_get_execution_status')!;

    const fake = new FakeClient(async () => ({
      status: 'completed',
      startedAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T00:00:05Z',
    }));
    const result = (await withFakeClient(fake, () =>
      status.execute('exec-1', { executionId: 'run-1' }) as Promise<unknown>,
    )) as { content: Array<{ text: string }> };

    expect(result.content[0]!.text).toContain('`run-1`');
    expect(result.content[0]!.text).toContain('**Status:** completed');
    expect(result.content[0]!.text).toContain('**Started:**');
    expect(result.content[0]!.text).toContain('**Completed:**');
  });
});

describe('looksLikeWorkflowId', () => {
  it('matches opaque cuid/uuid-style ids', () => {
    expect(looksLikeWorkflowId('clr1k2j3a0001x9pq7e2v3w4f')).toBe(true);
    expect(looksLikeWorkflowId('abcdefghijklmnop1234')).toBe(true);
  });

  it('rejects kebab-case slugs and short strings', () => {
    expect(looksLikeWorkflowId('aave-monitor')).toBe(false);
    expect(looksLikeWorkflowId('short')).toBe(false);
    expect(looksLikeWorkflowId('with.dot.id')).toBe(false);
  });
});

describe('registerMarketplaceTools', () => {
  it('falls back to execute_workflow when slug looks like an org id and marketplace says not found', async () => {
    const { api, tools } = makeFakeApi({ apiKey: 'kh_test' });
    registerMarketplaceTools(api);
    const callTool = tools.find((t) => t.name === 'kh_call_workflow')!;

    let toolCalls = 0;
    const fake = new FakeClient(async (name) => {
      toolCalls += 1;
      if (toolCalls === 1) {
        expect(name).toBe('call_workflow');
        throw new Error('Workflow not found');
      }
      expect(name).toBe('execute_workflow');
      return { executionId: 'exec-fallback' };
    });

    const slug = 'clr1k2j3a0001x9pq7e2v3w4f';
    const result = (await withFakeClient(fake, () =>
      callTool.execute('id', { slug, inputs: { foo: 'bar' } }) as Promise<unknown>,
    )) as { content: Array<{ text: string }>; isError?: boolean };

    expect(toolCalls).toBe(2);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain('execution started');
    expect(result.content[0]!.text).toContain('exec-fallback');
  });

  it('returns a friendly isError result when slug is not in marketplace and is not opaque-id-shaped', async () => {
    const { api, tools } = makeFakeApi({ apiKey: 'kh_test' });
    registerMarketplaceTools(api);
    const callTool = tools.find((t) => t.name === 'kh_call_workflow')!;

    const fake = new FakeClient(async () => {
      throw new Error('Workflow not found');
    });
    const result = (await withFakeClient(fake, () =>
      callTool.execute('id', { slug: 'never-listed-slug' }) as Promise<unknown>,
    )) as { content: Array<{ text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('not found in the marketplace');
    expect(result.content[0]!.text).toContain('kh_search_workflows_marketplace');
  });
});

describe('registerStatusTool', () => {
  it('reports NOT CONNECTED when no api key is configured', async () => {
    const { api, tools } = makeFakeApi();
    delete process.env.KH_API_KEY;
    delete process.env.KEEPERHUB_API_KEY;
    delete process.env.KEEPERSHUB_API_KEY;
    registerStatusTool(api);
    const status = tools.find((t) => t.name === 'kh_status')!;

    const result = (await status.execute('id', {})) as { content: Array<{ text: string }> };
    expect(result.content[0]!.text).toContain('NOT CONNECTED');
    expect(result.content[0]!.text).toContain('plugins.entries.keepershub.config.apiKey');
  });

  it('reports CONNECTED when api key is configured, masking the key body', async () => {
    const { api, tools } = makeFakeApi({ apiKey: 'kh_supersecret_value_123' });
    registerStatusTool(api);
    const status = tools.find((t) => t.name === 'kh_status')!;

    const result = (await status.execute('id', { refresh: false })) as {
      content: Array<{ text: string }>;
    };
    expect(result.content[0]!.text).toContain('CONNECTED');
    expect(result.content[0]!.text).toContain('kh_s…_123');
    expect(result.content[0]!.text).not.toContain('supersecret_value');
  });
});
