/**
 * KeeperHub MCP transport client.
 *
 * Maintains a single MCP session per process keyed by API key. Lazily opens
 * the session on the first tool call so plugin startup does no network I/O.
 * Re-initializes transparently when the upstream returns 401 or a
 * 404 "session" body (matches the Eliza service behavior).
 */

const MCP_URL = 'https://app.keeperhub.com/mcp';
const MCP_PROTOCOL_VERSION = '2024-11-05';
const CLIENT_NAME = 'openclaw-keepershub';
const CLIENT_VERSION = '1.0.0';

export interface KeeperHubOrgContext {
  orgId: string | null;
  workflowCount: number;
}

export interface CallToolResult {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Minimal logger contract so the client can write to either an OpenClaw
 * `api.logger` or `console` depending on caller context.
 */
export interface ClientLogger {
  debug?(...args: unknown[]): void;
  info?(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
  error?(...args: unknown[]): void;
}

export class KeeperHubClient {
  readonly apiKey: string;
  private readonly logger: ClientLogger;
  private sessionId: string | null = null;
  private requestId = 0;
  orgContext: KeeperHubOrgContext = { orgId: null, workflowCount: 0 };

  constructor(apiKey: string, logger: ClientLogger = console) {
    if (!apiKey) {
      throw new Error('KeeperHubClient requires a non-empty apiKey');
    }
    this.apiKey = apiKey;
    this.logger = logger;
  }

  /**
   * Issue a `tools/call` against the KeeperHub MCP endpoint. The MCP server
   * returns the tool payload as a single text-content block; we attempt to
   * `JSON.parse` it and fall back to the raw string when parsing fails so the
   * caller always gets the most structured value available.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.ensureSession();
    const result = (await this.postMcp({
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/call',
      params: { name, arguments: args },
    })) as CallToolResult | undefined;

    if (result?.isError) {
      const msg = result.content?.[0]?.text ?? 'Unknown KeeperHub error';
      throw new Error(`KeeperHub tool error (${name}): ${msg}`);
    }

    const text = result?.content?.[0]?.text;
    if (typeof text === 'string') {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return result;
  }

  /**
   * Best-effort discovery of the org id and workflow count. Failures are
   * non-fatal — the cached `orgContext` simply stays empty.
   */
  async refreshOrgContext(): Promise<KeeperHubOrgContext> {
    try {
      const workflows = (await this.callTool('list_workflows', {})) as unknown;
      const list = Array.isArray(workflows) ? (workflows as Array<Record<string, unknown>>) : [];
      const orgId =
        list.length > 0 ? ((list[0]?.organizationId as string | undefined) ?? null) : null;
      this.orgContext = { orgId, workflowCount: list.length };
    } catch {
      // Non-fatal; context stays whatever it was.
    }
    return this.orgContext;
  }

  /**
   * Force the next request to re-initialize the MCP session. Useful for tests
   * and for callers that detect their own session-expired error mid-flight.
   */
  resetSession(): void {
    this.sessionId = null;
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionId) return;

    const body = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
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
    this.logger.info?.('[KeeperHub] MCP session established');
  }

  private async postMcp(body: object): Promise<unknown> {
    if (!this.sessionId) throw new Error('No active MCP session');

    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { ...this.headers(), 'mcp-session-id': this.sessionId },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      this.logger.warn?.('[KeeperHub] Session unauthorized, re-initializing');
      this.sessionId = null;
      await this.ensureSession();
      return this.postMcp(body);
    }

    if (res.status === 404) {
      const text = await res.text().catch(() => '');
      if (text.toLowerCase().includes('session')) {
        this.logger.warn?.('[KeeperHub] Session expired, re-initializing');
        this.sessionId = null;
        await this.ensureSession();
        return this.postMcp(body);
      }
      throw new Error(`KeeperHub MCP error (404): ${text}`);
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

/**
 * Module-level singleton keyed by the API key. Re-keying (a different key
 * appearing in config) discards the previous client and its session so we
 * never leak credentials across rotations.
 */
let cachedClient: KeeperHubClient | null = null;
let cachedKey: string | null = null;

export function getClient(apiKey: string, logger: ClientLogger = console): KeeperHubClient {
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new KeeperHubClient(apiKey, logger);
    cachedKey = apiKey;
  }
  return cachedClient;
}

/**
 * Test-only helper. Lets specs reset the singleton between cases without
 * exporting the cache itself.
 */
export function __resetClientForTests(): void {
  cachedClient = null;
  cachedKey = null;
}
