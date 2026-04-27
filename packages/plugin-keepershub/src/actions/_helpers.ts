import type { ActionResult, HandlerCallback, IAgentRuntime, Memory } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { KeeperHubService } from '../service.ts';

export function getService(runtime: IAgentRuntime): KeeperHubService {
  const svc = runtime.getService(KeeperHubService.serviceType) as KeeperHubService | null;
  if (!svc) throw new Error('KeeperHubService is not running. Add plugin-keeperhub to your agent.');
  if (!svc.isReady()) throw new Error('KH_API_KEY is not configured for KeeperHub.');
  return svc;
}

export async function validateKeeperHub(runtime: IAgentRuntime): Promise<boolean> {
  try {
    const svc = runtime.getService(KeeperHubService.serviceType) as KeeperHubService | null;
    return svc !== null && svc.isReady();
  } catch {
    return false;
  }
}

export function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (match) {
    try {
      return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  return {};
}

/**
 * Robustly extract an opaque identifier (workflow id, template id, execution
 * id, integration id, etc.) from free-form text.
 *
 * The returned value must look id-shaped — i.e. one of:
 *   - explicitly preceded by `:` / `=`
 *   - explicitly quoted (backticks, single or double quotes)
 *   - 16+ alphanumerics in a row (cuid / uuid / nanoid family)
 *   - contains a digit
 *   - contains a dash, dot, slash or underscore
 *
 * This avoids the classic bug where `text.match(/(?:workflow|id)[:\s]+([a-z0-9]+)/i)`
 * happily captures `now` from "execute workflow now" and ships that as the id
 * to the upstream API, which then 404s.
 *
 * @param text     the message text to parse
 * @param keywords accepted keyword aliases, e.g. ['workflow', 'workflowId', 'id']
 */
export function extractId(text: string, keywords: string[]): string | null {
  if (!text || keywords.length === 0) return null;
  const kw = keywords.map((k) => k.replace(/[^a-z0-9_]/gi, '')).join('|');

  // 1) keyword: X / keyword=X / keyword:"X" / keyword=`X`
  const keyed = new RegExp(
    `(?:${kw})\\s*[:=]\\s*[\`'"]?([a-z0-9][a-z0-9_./-]*)[\`'"]?`,
    'i'
  );
  const keyedMatch = text.match(keyed);
  if (keyedMatch?.[1]) return keyedMatch[1].replace(/[`'".,]+$/, '');

  // 2) keyword "X" / keyword `X` / keyword 'X'
  const keywordQuoted = new RegExp(
    `(?:${kw})\\s+[\`'"]([a-z0-9][a-z0-9_./-]*)[\`'"]`,
    'i'
  );
  const keywordQuotedMatch = text.match(keywordQuoted);
  if (keywordQuotedMatch?.[1]) return keywordQuotedMatch[1];

  // 3) keyword X where X looks id-shaped (16+ chars OR has a digit OR has -._/)
  const keywordIdLike = new RegExp(
    `(?:${kw})\\s+(` +
      `[a-z0-9]{16,}` +
      `|[a-z0-9_]*\\d[a-z0-9_./-]*` +
      `|[a-z0-9][a-z0-9_]*[-./_][a-z0-9_./-]*` +
      `)`,
    'i'
  );
  const keywordIdLikeMatch = text.match(keywordIdLike);
  if (keywordIdLikeMatch?.[1]) {
    return keywordIdLikeMatch[1].replace(/[`'".,]+$/, '');
  }

  // 4) bare quoted id-shaped token anywhere in the message
  const bareQuoted = text.match(
    /[`'"]([a-z0-9]{16,}|[a-z0-9_]*\d[a-z0-9_./-]*|[a-z0-9][a-z0-9_]*[-./_][a-z0-9_./-]*)[`'"]/i
  );
  if (bareQuoted?.[1]) return bareQuoted[1];

  return null;
}

/**
 * Build a standard, JSON-safe failure ActionResult and (optionally) deliver
 * a callback message. Using `error: <string>` instead of `error: new Error()`
 * is essential — Error objects serialize to `{}` in JSON because their
 * `message` and `stack` are non-enumerable, which is the source of the
 * dreaded `"error": {}` payloads users see in agent logs.
 *
 * Including `text` and `data` ensures the runtime treats the return value as
 * a real ActionResult instead of wrapping it under `legacyResult`.
 */
export async function failureResult(
  errorMessage: string,
  callback: HandlerCallback | undefined,
  message: Memory,
  data: Record<string, unknown> = {}
): Promise<ActionResult> {
  const text = errorMessage.startsWith('KeeperHub')
    ? errorMessage
    : `KeeperHub error: ${errorMessage}`;
  if (callback) {
    await callback({ text, source: message.content.source });
  }
  return {
    success: false,
    text,
    error: errorMessage,
    data: { ...data, errorMessage },
  };
}

/**
 * Validation-error helper for "missing required field" style returns. Always
 * sends the user-friendly callback text and embeds enough structured info in
 * `data` for downstream actions/agents to introspect without scraping logs.
 */
export async function validationError(
  userText: string,
  errorMessage: string,
  callback: HandlerCallback | undefined,
  message: Memory,
  data: Record<string, unknown> = {}
): Promise<ActionResult> {
  if (callback) {
    await callback({ text: userText, source: message.content.source });
  }
  return {
    success: false,
    text: userText,
    error: errorMessage,
    data: { ...data, reason: 'validation_error', errorMessage },
  };
}

/**
 * Common wrapper around `KeeperHubService.callTool` that produces correctly
 * shaped ActionResults on both success and failure.
 *
 * Failure shape uses `error: <string>` (not Error) so the result survives
 * `JSON.stringify()` round-trips and shows up as a real message instead of
 * `{}` in the user's transcript.
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  runtime: IAgentRuntime,
  message: Memory,
  callback: HandlerCallback | undefined,
  successText: (result: unknown) => string
): Promise<ActionResult> {
  let svc: KeeperHubService;
  try {
    svc = getService(runtime);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[KeeperHub] ${toolName} unavailable:`, msg);
    return failureResult(msg, callback, message, { tool: toolName, args, stage: 'service_init' });
  }

  try {
    const result = await svc.callTool(toolName, args);
    const text = successText(result);
    if (callback) {
      await callback({ text, source: message.content.source });
    }
    return {
      text,
      success: true,
      data: { tool: toolName, result },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[KeeperHub] ${toolName} failed:`, msg);
    return failureResult(msg, callback, message, {
      tool: toolName,
      args,
      stage: 'tool_call',
    });
  }
}
