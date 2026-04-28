/**
 * Tests for the CALL_WORKFLOW marketplace action and its slug-extraction
 * helpers. The handler now:
 *   1. Parses slugs robustly (quotes, dots, slashes, namespaced).
 *   2. Falls back to `execute_workflow` when the slug looks like an opaque
 *      org workflow id and `call_workflow` returns "Workflow not found".
 *   3. Surfaces an actionable message instead of a raw 404.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { HandlerCallback, IAgentRuntime, Memory } from '@elizaos/core';

import {
  callWorkflowAction,
  extractSlug,
  looksLikeWorkflowId,
} from '../actions/marketplace.ts';
import { KeeperHubService } from '../service.ts';

interface CallToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface FakeServiceOptions {
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

function makeRuntime(opts: FakeServiceOptions = {}): {
  runtime: IAgentRuntime;
  calls: CallToolCall[];
} {
  const calls: CallToolCall[] = [];
  const fakeService = {
    isReady: () => true,
    callTool: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (opts.callTool) return opts.callTool(name, args);
      return {};
    },
  };
  const runtime = {
    getService: (type: string) => (type === KeeperHubService.serviceType ? fakeService : null),
  } as unknown as IAgentRuntime;
  return { runtime, calls };
}

function makeMessage(text: string): Memory {
  return {
    id: 'msg-1' as Memory['id'],
    entityId: 'entity-1' as Memory['entityId'],
    roomId: 'room-1' as Memory['roomId'],
    content: { text, source: 'test' },
  } as Memory;
}

function makeCallback(): { fn: HandlerCallback; messages: string[] } {
  const messages: string[] = [];
  const fn = (async (resp: { text?: string }) => {
    if (resp?.text) messages.push(resp.text);
    return [];
  }) as unknown as HandlerCallback;
  return { fn, messages };
}

describe('extractSlug', () => {
  it('parses unquoted "workflow X"', () => {
    expect(extractSlug('call workflow aave-monitor')).toBe('aave-monitor');
  });

  it('parses "slug: X"', () => {
    expect(extractSlug('invoke slug: aave-health-check')).toBe('aave-health-check');
  });

  it('parses backtick-quoted slugs', () => {
    expect(extractSlug('run workflow `aave-monitor`')).toBe('aave-monitor');
  });

  it('parses double-quoted slugs', () => {
    expect(extractSlug('call workflow "aave-monitor.v2"')).toBe('aave-monitor.v2');
  });

  it('parses namespaced slugs with slashes', () => {
    expect(extractSlug('slug: keeperhub/aave-monitor')).toBe('keeperhub/aave-monitor');
  });

  it('falls back to a quoted token when no key is present', () => {
    expect(extractSlug('please run `aave-monitor` for me')).toBe('aave-monitor');
  });

  it('returns null when nothing slug-like is present', () => {
    expect(extractSlug('hello there friend')).toBeNull();
  });
});

describe('looksLikeWorkflowId', () => {
  it('treats long alphanumeric strings as ids', () => {
    expect(looksLikeWorkflowId('clr1k2j3a0001x9pq7e2v3w4f')).toBe(true);
  });

  it('rejects kebab-case slugs', () => {
    expect(looksLikeWorkflowId('aave-monitor')).toBe(false);
  });

  it('rejects short tokens', () => {
    expect(looksLikeWorkflowId('abc123')).toBe(false);
  });

  it('rejects strings with dots or slashes', () => {
    expect(looksLikeWorkflowId('aave.monitor.v2')).toBe(false);
    expect(looksLikeWorkflowId('keeperhub/aave-monitor')).toBe(false);
  });
});

describe('callWorkflowAction handler', () => {
  let originalLog: typeof console.log;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  beforeEach(() => {
    originalLog = console.log;
    originalWarn = console.warn;
    originalError = console.error;
    // Quiet logger output in tests
    console.log = mock(() => {});
    console.warn = mock(() => {});
    console.error = mock(() => {});
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it('returns an actionable error when slug is missing', async () => {
    const { runtime } = makeRuntime();
    const cb = makeCallback();
    const result = await callWorkflowAction.handler!(
      runtime,
      makeMessage('please call a workflow for me'),
      undefined,
      {},
      cb.fn
    );
    expect((result as { success: boolean }).success).toBe(false);
    expect(cb.messages.join('\n')).toContain('SEARCH_WORKFLOWS_MARKETPLACE');
  });

  it('returns marketplace result on happy path and forwards inputs', async () => {
    const { runtime, calls } = makeRuntime({
      callTool: async (name) => {
        if (name === 'call_workflow') return { healthFactor: '2.5' };
        throw new Error(`unexpected tool: ${name}`);
      },
    });
    const cb = makeCallback();

    const result = await callWorkflowAction.handler!(
      runtime,
      makeMessage('Call workflow aave-health-check with {"address":"0xabc"}'),
      undefined,
      {},
      cb.fn
    );

    expect((result as { success: boolean }).success).toBe(true);
    expect((result as { data: { via: string } }).data.via).toBe('call_workflow');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      name: 'call_workflow',
      args: { slug: 'aave-health-check', inputs: { address: '0xabc' } },
    });
    expect(cb.messages[0]).toContain('aave-health-check');
    expect(cb.messages[0]).toContain('healthFactor');
  });

  it('falls back to execute_workflow when slug looks like an org workflow id', async () => {
    const longId = 'clr1k2j3a0001x9pq7e2v3w4f';
    const { runtime, calls } = makeRuntime({
      callTool: async (name) => {
        if (name === 'call_workflow') {
          throw new Error(
            'KeeperHub tool error (call_workflow): API call failed: 404 Not Found - {"error":"Workflow not found"}'
          );
        }
        if (name === 'execute_workflow') return { executionId: 'exec-42' };
        throw new Error(`unexpected tool: ${name}`);
      },
    });
    const cb = makeCallback();

    const result = await callWorkflowAction.handler!(
      runtime,
      makeMessage(`call workflow ${longId}`),
      undefined,
      {},
      cb.fn
    );

    expect((result as { success: boolean }).success).toBe(true);
    expect((result as { data: { via: string } }).data.via).toBe('execute_workflow');
    expect((result as { data: { executionId: string } }).data.executionId).toBe('exec-42');
    expect(calls.map((c) => c.name)).toEqual(['call_workflow', 'execute_workflow']);
    expect(calls[1].args).toEqual({ workflowId: longId });
    expect(cb.messages[0]).toContain('execution started');
    expect(cb.messages[0]).toContain('exec-42');
  });

  it('does NOT fall back when slug is kebab-case (real marketplace miss)', async () => {
    const { runtime, calls } = makeRuntime({
      callTool: async (name) => {
        if (name === 'call_workflow') {
          throw new Error(
            'KeeperHub tool error (call_workflow): API call failed: 404 Not Found - {"error":"Workflow not found"}'
          );
        }
        throw new Error(`unexpected tool: ${name}`);
      },
    });
    const cb = makeCallback();

    const result = await callWorkflowAction.handler!(
      runtime,
      makeMessage('call workflow aave-monitor'),
      undefined,
      {},
      cb.fn
    );

    expect((result as { success: boolean }).success).toBe(false);
    expect(calls.map((c) => c.name)).toEqual(['call_workflow']);
    const message = cb.messages.join('\n');
    expect(message).toContain('not found in the marketplace');
    expect(message).toContain('search marketplace workflows');
    expect(message).toContain('EXECUTE_WORKFLOW');
  });

  it('surfaces non-404 errors verbatim without attempting a fallback', async () => {
    const { runtime, calls } = makeRuntime({
      callTool: async (name) => {
        if (name === 'call_workflow') {
          throw new Error('KeeperHub MCP error (500): boom');
        }
        throw new Error(`unexpected tool: ${name}`);
      },
    });
    const cb = makeCallback();

    const result = await callWorkflowAction.handler!(
      runtime,
      makeMessage('call workflow clr1k2j3a0001x9pq7e2v3w4f'),
      undefined,
      {},
      cb.fn
    );

    expect((result as { success: boolean }).success).toBe(false);
    expect(calls.map((c) => c.name)).toEqual(['call_workflow']);
    const merged = cb.messages.join('\n');
    expect(merged).toContain('KeeperHub MCP error');
    expect(merged).toContain('boom');
    // Result must carry a JSON-serialisable error string, not a raw Error.
    const errField = (result as { error?: unknown }).error;
    expect(typeof errField).toBe('string');
    expect(errField).toContain('boom');
  });
});
