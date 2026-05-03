/**
 * Local type shim for the OpenClaw plugin SDK.
 *
 * The real types ship with the `openclaw` peer dependency. This shim only
 * captures the surface this plugin actually uses so the package can build
 * cleanly without forcing every consumer to install `openclaw` at compile
 * time. When `openclaw` is installed, its declarations take precedence over
 * this ambient module.
 */

declare module 'openclaw/plugin-sdk/plugin-entry' {
  import type { TSchema, Static } from '@sinclair/typebox';

  export interface ToolTextContent {
    type: 'text';
    text: string;
  }

  export interface ToolCallResult {
    content: ToolTextContent[];
    isError?: boolean;
  }

  export interface ToolDefinition<P extends TSchema = TSchema> {
    name: string;
    description: string;
    parameters: P;
    execute(
      id: string,
      params: Static<P>,
      ctx?: unknown,
    ): Promise<ToolCallResult> | ToolCallResult;
  }

  export interface ToolRegistrationOptions {
    optional?: boolean;
  }

  export interface PluginLogger {
    debug?(...args: unknown[]): void;
    info?(...args: unknown[]): void;
    warn?(...args: unknown[]): void;
    error?(...args: unknown[]): void;
  }

  export interface OpenClawPluginApi {
    readonly id: string;
    readonly name: string;
    readonly version?: string;
    readonly description?: string;
    readonly source?: string;
    readonly rootDir?: string;
    readonly config: Record<string, unknown>;
    readonly pluginConfig: Record<string, unknown>;
    readonly logger: PluginLogger;
    readonly registrationMode: string;
    registerTool<P extends TSchema>(
      tool: ToolDefinition<P>,
      opts?: ToolRegistrationOptions,
    ): void;
    resolvePath?(input: string): string;
    [key: string]: unknown;
  }

  export interface PluginEntryDefinition {
    id: string;
    name: string;
    description: string;
    kind?: string;
    configSchema?: unknown;
    register(api: OpenClawPluginApi): void | Promise<void>;
  }

  export function definePluginEntry(def: PluginEntryDefinition): PluginEntryDefinition;
}
