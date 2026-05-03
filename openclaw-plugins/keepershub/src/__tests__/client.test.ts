/**
 * Tests for the MCP transport in src/client.ts.
 *
 * The KeeperHub MCP server uses HTTP-Streaming JSON-RPC. Our client must:
 *   1. Open a session via `initialize` and capture the `mcp-session-id`
 *      response header before issuing `tools/call`.
 *   2. Pass the session id back as a request header on every subsequent call.
 *   3. Re-initialize transparently when upstream returns 401, or 404 with a
 *      session-related body, and replay the original call.
 *   4. JSON-parse `result.content[0].text` when it parses, and return the
 *      raw string as a fallback so callers always get the most structured
 *      value available.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { __resetClientForTests, getClient, KeeperHubClient } from '../client.js';

type FetchInit = RequestInit & { headers?: Record<string, string> };

function jsonResponse(
  body: unknown,
  init: { status?: number; sessionId?: string } = {},
): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (init.sessionId) headers.set('mcp-session-id', init.sessionId);
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

function textResponse(
  body: string,
  init: { status?: number; sessionId?: string } = {},
): Response {
  const headers = new Headers({ 'content-type': 'text/plain' });
  if (init.sessionId) headers.set('mcp-session-id', init.sessionId);
  return new Response(body, {
    status: init.status ?? 200,
    headers,
  });
}

function captureFetch(responses: Array<() => Response>) {
  const calls: Array<{ url: string; init: FetchInit; body: unknown }> = [];
  let i = 0;
  const fn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const next = responses[i++];
    if (!next) {
      throw new Error(`Unexpected fetch call #${i} to ${String(url)}`);
    }
    let parsedBody: unknown = undefined;
    if (init?.body && typeof init.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    calls.push({ url: String(url), init: (init ?? {}) as FetchInit, body: parsedBody });
    return next();
  }) as typeof fetch;
  return { fn, calls };
}

describe('KeeperHubClient', () => {
  let originalFetch: typeof fetch;
  let silentLogger: { warn: () => void; info: () => void; error: () => void; debug: () => void };

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    __resetClientForTests();
    silentLogger = {
      warn: () => undefined,
      info: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('opens a session via initialize and uses the session id on tools/call', async () => {
    const { fn, calls } = captureFetch([
      () => jsonResponse({ result: { protocolVersion: '2024-11-05' } }, { sessionId: 'sess-1' }),
      () =>
        jsonResponse({
          result: {
            content: [{ type: 'text', text: JSON.stringify([{ id: 'wf-1', name: 'Demo' }]) }],
          },
        }),
    ]);
    globalThis.fetch = fn;

    const client = new KeeperHubClient('kh_test', silentLogger);
    const result = await client.callTool('list_workflows', {});

    expect(result).toEqual([{ id: 'wf-1', name: 'Demo' }]);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe('https://app.keeperhub.com/mcp');
    expect((calls[0]!.body as { method: string }).method).toBe('initialize');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer kh_test');

    const second = calls[1]!;
    expect((second.body as { method: string }).method).toBe('tools/call');
    expect((second.body as { params: { name: string } }).params.name).toBe('list_workflows');
    expect((second.init.headers as Record<string, string>)['mcp-session-id']).toBe('sess-1');
  });

  it('re-initializes the session when upstream returns 401, then replays', async () => {
    const { fn, calls } = captureFetch([
      () => jsonResponse({ result: {} }, { sessionId: 'sess-old' }),
      () => jsonResponse({ error: 'unauthorized' }, { status: 401 }),
      () => jsonResponse({ result: {} }, { sessionId: 'sess-new' }),
      () =>
        jsonResponse({
          result: { content: [{ type: 'text', text: '"ok"' }] },
        }),
    ]);
    globalThis.fetch = fn;

    const client = new KeeperHubClient('kh_test', silentLogger);
    const result = await client.callTool('list_workflows', {});

    expect(result).toBe('ok');
    expect(calls).toHaveLength(4);
    expect((calls[0]!.body as { method: string }).method).toBe('initialize');
    expect((calls[1]!.body as { method: string }).method).toBe('tools/call');
    expect((calls[2]!.body as { method: string }).method).toBe('initialize');
    expect((calls[3]!.body as { method: string }).method).toBe('tools/call');
    expect((calls[1]!.init.headers as Record<string, string>)['mcp-session-id']).toBe('sess-old');
    expect((calls[3]!.init.headers as Record<string, string>)['mcp-session-id']).toBe('sess-new');
  });

  it('re-initializes on 404 when the body mentions session', async () => {
    const { fn, calls } = captureFetch([
      () => jsonResponse({ result: {} }, { sessionId: 'sess-old' }),
      () => textResponse('session expired', { status: 404 }),
      () => jsonResponse({ result: {} }, { sessionId: 'sess-new' }),
      () =>
        jsonResponse({
          result: { content: [{ type: 'text', text: '{"status":"queued"}' }] },
        }),
    ]);
    globalThis.fetch = fn;

    const client = new KeeperHubClient('kh_test', silentLogger);
    const result = await client.callTool('execute_workflow', { workflowId: 'wf-1' });

    expect(result).toEqual({ status: 'queued' });
    expect(calls).toHaveLength(4);
  });

  it('does not re-initialize on 404 when the body is unrelated', async () => {
    const { fn } = captureFetch([
      () => jsonResponse({ result: {} }, { sessionId: 'sess-old' }),
      () => textResponse('workflow not found', { status: 404 }),
    ]);
    globalThis.fetch = fn;

    const client = new KeeperHubClient('kh_test', silentLogger);
    await expect(client.callTool('get_workflow', { workflowId: 'missing' })).rejects.toThrow(
      /404/,
    );
  });

  it('returns the raw text when MCP content text is not valid JSON', async () => {
    const { fn } = captureFetch([
      () => jsonResponse({ result: {} }, { sessionId: 'sess-1' }),
      () =>
        jsonResponse({
          result: { content: [{ type: 'text', text: 'this is not JSON' }] },
        }),
    ]);
    globalThis.fetch = fn;

    const client = new KeeperHubClient('kh_test', silentLogger);
    const result = await client.callTool('tools_documentation', {});
    expect(result).toBe('this is not JSON');
  });

  it('throws on isError tool results with the upstream error text', async () => {
    const { fn } = captureFetch([
      () => jsonResponse({ result: {} }, { sessionId: 'sess-1' }),
      () =>
        jsonResponse({
          result: {
            content: [{ type: 'text', text: 'workflow not found' }],
            isError: true,
          },
        }),
    ]);
    globalThis.fetch = fn;

    const client = new KeeperHubClient('kh_test', silentLogger);
    await expect(client.callTool('execute_workflow', { workflowId: 'missing' })).rejects.toThrow(
      /workflow not found/,
    );
  });

  it('rejects construction with an empty api key', () => {
    expect(() => new KeeperHubClient('', silentLogger)).toThrow(/non-empty apiKey/);
  });
});

describe('getClient singleton', () => {
  beforeEach(() => __resetClientForTests());

  it('returns the same instance for the same api key', () => {
    const a = getClient('kh_one');
    const b = getClient('kh_one');
    expect(a).toBe(b);
  });

  it('replaces the instance when the api key changes', () => {
    const a = getClient('kh_one');
    const b = getClient('kh_two');
    expect(a).not.toBe(b);
    expect(a.apiKey).toBe('kh_one');
    expect(b.apiKey).toBe('kh_two');
  });
});
