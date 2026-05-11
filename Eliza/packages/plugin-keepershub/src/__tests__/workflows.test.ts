/**
 * Tests for `executeWorkflowAction` (and the surrounding write actions). These
 * lock in the fix for the symptom the user reported:
 *
 *   {
 *     "actionResult": {
 *       "success": true,
 *       "data": {
 *         "actionName": "EXECUTE_WORKFLOW",
 *         "legacyResult": {
 *           "success": false,
 *           "error": {}                  // ← the bug: Error → {} on JSON.stringify
 *         }
 *       }
 *     }
 *   }
 *
 * After the fix, every failure path must:
 *   - return a non-empty `error` string,
 *   - include `text` and `data` so the runtime does NOT wrap the result under
 *     `legacyResult`,
 *   - survive a JSON.stringify round-trip without losing the error message.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { HandlerCallback, IAgentRuntime, Memory } from '@elizaos/core';

import {
  createWorkflowAction,
  deleteWorkflowAction,
  executeWorkflowAction,
  getWorkflowAction,
  updateWorkflowAction,
} from '../actions/workflows.ts';
import { KeeperHubService } from '../service.ts';

interface CallToolCall {
  name: string;
  args: Record<string, unknown>;
}

function makeRuntime(callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>) {
  const calls: CallToolCall[] = [];
  const fakeService = {
    isReady: () => true,
    callTool: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (callTool) return callTool(name, args);
      return {};
    },
  };
  const runtime = {
    getService: (type: string) =>
      type === KeeperHubService.serviceType ? fakeService : null,
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

describe('executeWorkflowAction', () => {
  let originalError: typeof console.error;
  beforeEach(() => {
    originalError = console.error;
    console.error = mock(() => {});
  });
  afterEach(() => {
    console.error = originalError;
  });

  it('starts a workflow and returns a success ActionResult with execution id', async () => {
    const { runtime, calls } = makeRuntime(async (name) => {
      if (name === 'execute_workflow') return { executionId: 'exec_42' };
      throw new Error(`unexpected tool ${name}`);
    });
    const cb = makeCallback();

    const result = await executeWorkflowAction.handler!(
      runtime,
      makeMessage('execute workflow workflowId: clr1k2j3a0001x9pq7e2v3w4f'),
      undefined,
      {},
      cb.fn
    );

    expect(result).toBeDefined();
    const r = result as { success: boolean; text?: string; data?: { tool: string } };
    expect(r.success).toBe(true);
    expect(r.text).toContain('exec_42');
    expect(r.data?.tool).toBe('execute_workflow');
    expect(calls).toEqual([
      { name: 'execute_workflow', args: { workflowId: 'clr1k2j3a0001x9pq7e2v3w4f' } },
    ]);
  });

  it('does NOT capture English words as workflow ids ("execute workflow now")', async () => {
    const { runtime, calls } = makeRuntime();
    const cb = makeCallback();

    const result = await executeWorkflowAction.handler!(
      runtime,
      makeMessage('execute workflow now'),
      undefined,
      {},
      cb.fn
    );

    const r = result as { success: boolean; text?: string; error?: unknown };
    expect(r.success).toBe(false);
    expect(typeof r.error).toBe('string');
    expect(r.error).toBe('Missing workflowId');
    expect(calls).toEqual([]);
    expect(cb.messages.join('\n')).toContain('list workflows');
  });

  it('failure result survives JSON.stringify (no more "error: {}")', async () => {
    const { runtime } = makeRuntime(async () => {
      throw new Error('Workflow not found');
    });
    const cb = makeCallback();

    const result = await executeWorkflowAction.handler!(
      runtime,
      makeMessage('execute workflow workflowId: clr1k2j3a0001x9pq7e2v3w4f'),
      undefined,
      {},
      cb.fn
    );

    const round = JSON.parse(JSON.stringify(result));
    expect(round.success).toBe(false);
    expect(round.error).toBe('Workflow not found');
    expect(round.text).toContain('Workflow not found');
    // Crucially, ActionResult has the proper shape so the runtime won't
    // rewrap it under `legacyResult`.
    expect(round.data.tool).toBe('execute_workflow');
    expect(round.data.errorMessage).toBe('Workflow not found');
  });

  it('forwards parsed.input as the input payload', async () => {
    const { runtime, calls } = makeRuntime(async () => ({ executionId: 'e1' }));
    const cb = makeCallback();

    await executeWorkflowAction.handler!(
      runtime,
      makeMessage(
        'execute workflow {"workflowId":"clr1k2j3a0001x9pq7e2v3w4f","input":{"chain":"1","amount":"100"}}'
      ),
      undefined,
      {},
      cb.fn
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      name: 'execute_workflow',
      args: {
        workflowId: 'clr1k2j3a0001x9pq7e2v3w4f',
        input: { chain: '1', amount: '100' },
      },
    });
  });
});

describe('write actions: validation errors are JSON-safe', () => {
  it('GET_WORKFLOW returns serialisable error when id is missing', async () => {
    const { runtime, calls } = makeRuntime();
    const cb = makeCallback();
    const result = await getWorkflowAction.handler!(
      runtime,
      makeMessage('get workflow please'),
      undefined,
      {},
      cb.fn
    );
    const round = JSON.parse(JSON.stringify(result));
    expect(round.success).toBe(false);
    expect(round.error).toBe('Missing workflowId');
    expect(calls).toEqual([]);
  });

  it('UPDATE_WORKFLOW returns serialisable error when id is missing', async () => {
    const { runtime } = makeRuntime();
    const cb = makeCallback();
    const result = await updateWorkflowAction.handler!(
      runtime,
      makeMessage('update workflow please'),
      undefined,
      {},
      cb.fn
    );
    const round = JSON.parse(JSON.stringify(result));
    expect(round.error).toBe('Missing workflowId');
  });

  it('DELETE_WORKFLOW returns serialisable error when id is missing', async () => {
    const { runtime } = makeRuntime();
    const cb = makeCallback();
    const result = await deleteWorkflowAction.handler!(
      runtime,
      makeMessage('delete workflow please'),
      undefined,
      {},
      cb.fn
    );
    const round = JSON.parse(JSON.stringify(result));
    expect(round.error).toBe('Missing workflowId');
  });

  it('CREATE_WORKFLOW reports MCP errors as serialisable strings', async () => {
    const { runtime } = makeRuntime(async () => {
      throw new Error('Invalid graph: cycle detected at node X');
    });
    const cb = makeCallback();
    const result = await createWorkflowAction.handler!(
      runtime,
      makeMessage('create workflow {"name":"Bad","nodes":[],"edges":[]}'),
      undefined,
      {},
      cb.fn
    );
    const round = JSON.parse(JSON.stringify(result));
    expect(round.success).toBe(false);
    expect(round.error).toContain('cycle detected');
    expect(round.text).toContain('cycle detected');
  });
});
