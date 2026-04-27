import { Service, type IAgentRuntime, logger } from '@elizaos/core';

const MCP_URL = 'https://app.keeperhub.com/mcp';
const MCP_PROTOCOL_VERSION = '2024-11-05';

export interface KeeperHubOrgContext {
  orgId: string | null;
  workflowCount: number;
}

export class KeeperHubService extends Service {
  static override serviceType = 'keeperhub';

  override capabilityDescription =
    'Connects to KeeperHub MCP server to manage blockchain automation workflows, monitor smart contracts, and execute DeFi actions.';

  private sessionId: string | null = null;
  private apiKey: string | null = null;
  private requestId = 0;
  orgContext: KeeperHubOrgContext = { orgId: null, workflowCount: 0 };

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static override async start(runtime: IAgentRuntime): Promise<Service> {
    logger.info('[KeeperHub] Starting KeeperHubService');
    const service = new KeeperHubService(runtime);
    service.apiKey = runtime.getSetting('KH_API_KEY') ?? process.env.KH_API_KEY ?? null;

    if (!service.apiKey) {
      logger.warn('[KeeperHub] KH_API_KEY not set — KeeperHub actions will fail until configured');
    } else {
      try {
        await service.ensureSession();
        await service.refreshOrgContext();
      } catch (err) {
        logger.warn('[KeeperHub] Failed to initialize session at startup:', err);
      }
    }

    return service;
  }

  static override async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('[KeeperHub] Stopping KeeperHubService');
    const service = runtime.getService(KeeperHubService.serviceType);
    if (service && 'stop' in service && typeof service.stop === 'function') {
      await service.stop();
    }
  }

  override async stop(): Promise<void> {
    this.sessionId = null;
    logger.info('[KeeperHub] KeeperHubService stopped');
  }

  isReady(): boolean {
    return this.apiKey !== null;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.ensureSession();
    const result = await this.postMcp({
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/call',
      params: { name, arguments: args },
    });

    const typed = result as { content?: Array<{ type: string; text: string }>; isError?: boolean };

    if (typed?.isError) {
      const msg = typed.content?.[0]?.text ?? 'Unknown KeeperHub error';
      throw new Error(`KeeperHub tool error (${name}): ${msg}`);
    }

    const text = typed?.content?.[0]?.text;
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return result;
  }

  private async refreshOrgContext(): Promise<void> {
    try {
      const workflows = (await this.callTool('list_workflows', {})) as unknown[];
      const list = Array.isArray(workflows) ? workflows : [];
      const orgId =
        list.length > 0
          ? ((list[0] as Record<string, unknown>).organizationId as string) ?? null
          : null;
      this.orgContext = { orgId, workflowCount: list.length };
    } catch {
      // Non-fatal; context stays empty
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionId) return;
    if (!this.apiKey) throw new Error('KH_API_KEY is not configured');

    const body = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'elizaos-plugin-keeperhub', version: '1.0.0' },
      },
    };

    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`KeeperHub initialize failed (${res.status}): ${text}`);
    }

    const sid = res.headers.get('mcp-session-id');
    if (!sid) throw new Error('KeeperHub did not return mcp-session-id');
    this.sessionId = sid;
    logger.info('[KeeperHub] MCP session established');
  }

  private async postMcp(body: object): Promise<unknown> {
    if (!this.sessionId) throw new Error('No active MCP session');

    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { ...this.headers(), 'mcp-session-id': this.sessionId },
      body: JSON.stringify(body),
    });

    if (res.status === 401 || (res.status === 404 && (await res.text()).includes('session'))) {
      logger.warn('[KeeperHub] Session expired, re-initializing');
      this.sessionId = null;
      await this.ensureSession();
      return this.postMcp(body);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`KeeperHub MCP error (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(`KeeperHub RPC error: ${json.error.message}`);
    return json.result;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }
}
