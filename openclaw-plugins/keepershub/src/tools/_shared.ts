/**
 * Shared helpers for KeeperHub OpenClaw tool registrations.
 *
 * Tools registered with `api.registerTool(...)` must return a value of shape
 * `{ content: [...], isError? }`. We standardize on text content blocks here
 * and centralize MCP error -> tool-result translation so every tool reports
 * failures the same way.
 */

import type { KeeperHubClient } from '../client.js';
import { getClient } from '../client.js';
import { resolveApiKey } from '../config.js';

/** Subset of the OpenClaw plugin api we need for tool registration. */
export interface PluginApiLike {
  pluginConfig?: Record<string, unknown>;
  logger?: {
    debug?(...args: unknown[]): void;
    info?(...args: unknown[]): void;
    warn?(...args: unknown[]): void;
    error?(...args: unknown[]): void;
  };
}

export interface ToolTextBlock {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolTextBlock[];
  isError?: boolean;
}

/** Wrap a string in the `{ content: [{ type: "text", text }] }` envelope. */
export function toToolText(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

/** Render a thrown value or string as an `isError: true` tool result. */
export function toToolError(err: unknown, prefix = 'KeeperHub error'): ToolResult {
  const raw = err instanceof Error ? err.message : String(err ?? 'unknown error');
  const text = raw.startsWith('KeeperHub') ? raw : `${prefix}: ${raw}`;
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Resolve and return the active client, or `null` plus an error tool-result
 * when no API key is configured. Tools call this once at the top of `execute`
 * and short-circuit on the error case so missing config produces a clear
 * agent-visible message instead of a thrown registration-time exception.
 */
export function resolveClient(
  api: PluginApiLike,
): { client: KeeperHubClient; error: null } | { client: null; error: ToolResult } {
  const apiKey = resolveApiKey(api);
  if (!apiKey) {
    return {
      client: null,
      error: toToolError(
        'KH_API_KEY is not configured. Set plugins.entries.keepershub.config.apiKey or the KH_API_KEY environment variable.',
      ),
    };
  }
  const client = getClient(apiKey, api.logger ?? console);
  return { client, error: null };
}

/**
 * Allow callers to override the singleton lookup in tests by wiring a fake
 * client straight through. Production code should always pass `api` and rely
 * on `resolveClient`.
 */
export interface RunMcpOptions {
  /** Optional fake client for tests; bypasses `resolveClient`. */
  client?: KeeperHubClient | null;
}

/**
 * Common wrapper around `KeeperHubClient.callTool` that produces correctly
 * shaped tool results on both success and failure.
 */
export async function runMcp(
  api: PluginApiLike,
  toolName: string,
  args: Record<string, unknown>,
  format: (result: unknown) => string,
  opts: RunMcpOptions = {},
): Promise<ToolResult> {
  let client: KeeperHubClient | null;
  if (opts.client !== undefined) {
    client = opts.client;
    if (!client) return toToolError('KH_API_KEY is not configured.');
  } else {
    const resolved = resolveClient(api);
    if (resolved.error) return resolved.error;
    client = resolved.client;
  }

  try {
    const result = await client.callTool(toolName, args);
    return toToolText(format(result));
  } catch (err) {
    api.logger?.error?.(`[KeeperHub] ${toolName} failed:`, err);
    return toToolError(err);
  }
}

/** Strip undefined keys before sending to the upstream — KeeperHub MCP rejects unknown undefined values cleanly, but explicit cleanup keeps logs tidy. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/** Pretty-print a JSON value inside a fenced code block for tool transcripts. */
export function fencedJson(value: unknown): string {
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

/** Coerce arbitrary values to a record-shape entry for safe key access. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
