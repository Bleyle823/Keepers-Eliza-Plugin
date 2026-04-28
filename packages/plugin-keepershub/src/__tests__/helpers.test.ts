/**
 * Tests for the shared action helpers in `_helpers.ts`. These cover the two
 * issues that produce empty `error: {}` payloads in agent transcripts:
 *
 *   1. `handleToolCall` and the inline error helpers must return a proper
 *      ActionResult shape (with `text` and `data`) and a *string* `error`
 *      field — not an `Error` instance, which serializes to `{}` because
 *      its `message` and `stack` are non-enumerable.
 *
 *   2. `extractId` must reject English-word matches like `now` / `please`
 *      that the original `[a-z0-9]+` regex would happily capture from
 *      messages like "execute workflow now".
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { HandlerCallback, IAgentRuntime, Memory } from '@elizaos/core';

import {
  extractId,
  failureResult,
  handleToolCall,
  validationError,
} from '../actions/_helpers.ts';
import { KeeperHubService } from '../service.ts';

interface FakeServiceOptions {
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  ready?: boolean;
  missing?: boolean;
}

function makeRuntime(opts: FakeServiceOptions = {}): IAgentRuntime {
  if (opts.missing) {
    return { getService: () => null } as unknown as IAgentRuntime;
  }
  const fakeService = {
    isReady: () => opts.ready ?? true,
    callTool: async (name: string, args: Record<string, unknown>) => {
      if (opts.callTool) return opts.callTool(name, args);
      return { ok: true };
    },
  };
  return {
    getService: (type: string) =>
      type === KeeperHubService.serviceType ? fakeService : null,
  } as unknown as IAgentRuntime;
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

describe('extractId', () => {
  it('extracts cuid-style ids after a keyword', () => {
    expect(
      extractId('execute workflow clr1k2j3a0001x9pq7e2v3w4f', ['workflowId', 'workflow', 'id'])
    ).toBe('clr1k2j3a0001x9pq7e2v3w4f');
  });

  it('extracts ids with explicit "key: value"', () => {
    expect(extractId('workflowId: abc123def', ['workflowId', 'workflow', 'id'])).toBe('abc123def');
  });

  it('extracts ids with explicit "key=value"', () => {
    expect(extractId('workflow=abc123def', ['workflowId', 'workflow', 'id'])).toBe('abc123def');
  });

  it('extracts backtick-quoted ids', () => {
    expect(extractId('run workflow `abc123`', ['workflow', 'id'])).toBe('abc123');
  });

  it('extracts double-quoted ids', () => {
    expect(extractId('execute workflow "abc-123"', ['workflow', 'id'])).toBe('abc-123');
  });

  it('rejects English words after a keyword (the bug we fixed)', () => {
    expect(extractId('execute workflow now', ['workflow', 'id'])).toBeNull();
    expect(extractId('please run workflow today', ['workflow', 'id'])).toBeNull();
    expect(extractId('delete workflow please', ['workflow', 'id'])).toBeNull();
  });

  it('accepts dashed slugs', () => {
    expect(extractId('execute workflow my-workflow-1', ['workflow', 'id'])).toBe('my-workflow-1');
  });

  it('returns null when nothing id-shaped is present', () => {
    expect(extractId('hello there friend', ['workflow', 'id'])).toBeNull();
  });

  it('falls back to a quoted id-shaped token without keyword', () => {
    expect(extractId('please run `clr1k2j3a0001x9pq7e2v3w4f` now', ['workflowId', 'workflow', 'id'])).toBe(
      'clr1k2j3a0001x9pq7e2v3w4f'
    );
  });

  it('ignores empty keyword arrays without throwing', () => {
    expect(extractId('workflow abc123def', [])).toBeNull();
  });
});

describe('validationError', () => {
  it('returns a JSON-serialisable ActionResult with text+data+string-error', async () => {
    const cb = makeCallback();
    const result = await validationError(
      'Please provide an X.',
      'Missing X',
      cb.fn,
      makeMessage('do the thing'),
      { field: 'X' }
    );

    expect(result.success).toBe(false);
    expect(result.text).toBe('Please provide an X.');
    expect(typeof result.error).toBe('string');
    expect(result.error).toBe('Missing X');
    expect(result.data).toMatchObject({ reason: 'validation_error', field: 'X', errorMessage: 'Missing X' });
    expect(cb.messages).toEqual(['Please provide an X.']);

    const round = JSON.parse(JSON.stringify(result));
    expect(round.error).toBe('Missing X');
    expect(round.text).toBe('Please provide an X.');
  });
});

describe('failureResult', () => {
  it('prefixes plain messages with "KeeperHub error:"', async () => {
    const cb = makeCallback();
    const result = await failureResult('boom', cb.fn, makeMessage('x'));
    expect(result.text).toBe('KeeperHub error: boom');
    expect(cb.messages[0]).toBe('KeeperHub error: boom');
    expect(typeof result.error).toBe('string');
    expect(result.error).toBe('boom');
  });

  it('does not double-prefix messages that already start with "KeeperHub"', async () => {
    const cb = makeCallback();
    const result = await failureResult('KeeperHub MCP error (500): boom', cb.fn, makeMessage('x'));
    expect(result.text).toBe('KeeperHub MCP error (500): boom');
    expect(cb.messages[0]).toBe('KeeperHub MCP error (500): boom');
  });

  it('survives JSON.stringify without losing the error message', async () => {
    const cb = makeCallback();
    const result = await failureResult('something blew up', cb.fn, makeMessage('x'), { tool: 'foo' });
    const round = JSON.parse(JSON.stringify(result));
    expect(round.error).toBe('something blew up');
    expect(round.success).toBe(false);
    expect(round.text).toContain('something blew up');
    expect(round.data.tool).toBe('foo');
  });
});

describe('handleToolCall', () => {
  let originalLog: typeof console.log;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  beforeEach(() => {
    originalLog = console.log;
    originalWarn = console.warn;
    originalError = console.error;
    console.log = mock(() => {});
    console.warn = mock(() => {});
    console.error = mock(() => {});
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it('returns success ActionResult on happy path', async () => {
    const runtime = makeRuntime({
      callTool: async () => ({ id: 'exec-1', status: 'queued' }),
    });
    const cb = makeCallback();
    const result = await handleToolCall(
      'execute_workflow',
      { workflowId: 'abc' },
      runtime,
      makeMessage('x'),
      cb.fn,
      (r) => `Started ${(r as { id: string }).id}`
    );
    expect(result.success).toBe(true);
    expect(result.text).toBe('Started exec-1');
    expect(result.data).toMatchObject({ tool: 'execute_workflow', result: { id: 'exec-1' } });
    expect(cb.messages[0]).toBe('Started exec-1');
  });

  it('returns failure ActionResult with serialisable error on tool errors', async () => {
    const runtime = makeRuntime({
      callTool: async () => {
        throw new Error('Workflow not found');
      },
    });
    const cb = makeCallback();
    const result = await handleToolCall(
      'execute_workflow',
      { workflowId: 'doesnotexist' },
      runtime,
      makeMessage('x'),
      cb.fn,
      () => 'never'
    );

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error).toBe('Workflow not found');
    expect(result.text).toContain('Workflow not found');
    // The fix: round-trip through JSON must preserve the error string.
    const round = JSON.parse(JSON.stringify(result));
    expect(round.error).toBe('Workflow not found');
    expect(round.text).toContain('Workflow not found');
    expect(cb.messages.length).toBe(1);
    expect(cb.messages[0]).toContain('Workflow not found');
  });

  it('returns failure ActionResult when the service is missing', async () => {
    const runtime = makeRuntime({ missing: true });
    const cb = makeCallback();
    const result = await handleToolCall(
      'execute_workflow',
      {},
      runtime,
      makeMessage('x'),
      cb.fn,
      () => 'never'
    );
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error).toContain('KeeperHubService is not running');
    expect(result.data).toMatchObject({ stage: 'service_init' });
  });

  it('returns failure ActionResult when KH_API_KEY is missing', async () => {
    const runtime = makeRuntime({ ready: false });
    const cb = makeCallback();
    const result = await handleToolCall(
      'execute_workflow',
      {},
      runtime,
      makeMessage('x'),
      cb.fn,
      () => 'never'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('KH_API_KEY');
  });
});
