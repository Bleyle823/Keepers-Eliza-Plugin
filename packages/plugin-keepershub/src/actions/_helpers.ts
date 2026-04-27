import type { HandlerCallback, IAgentRuntime, Memory, State } from '@elizaos/core';
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

export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  runtime: IAgentRuntime,
  message: Memory,
  callback: HandlerCallback | undefined,
  successText: (result: unknown) => string
) {
  const svc = getService(runtime);
  try {
    const result = await svc.callTool(toolName, args);
    const text = successText(result);
    if (callback) {
      await callback({ text, source: message.content.source });
    }
    return { text, success: true, data: { result } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[KeeperHub] ${toolName} failed:`, msg);
    if (callback) {
      await callback({ text: `KeeperHub error: ${msg}`, source: message.content.source });
    }
    return { success: false, error: error instanceof Error ? error : new Error(msg) };
  }
}
