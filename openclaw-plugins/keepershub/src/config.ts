/**
 * Plugin config resolution.
 *
 * The OpenClaw plugin manifest declares an `apiKey` config field for
 * `plugins.entries.keepershub.config.apiKey`. We read that first, then fall
 * back to the same env vars the Eliza plugin recognized so existing operator
 * environments keep working without manifest churn.
 */

const ENV_VAR_NAMES = ['KH_API_KEY', 'KEEPERHUB_API_KEY', 'KEEPERSHUB_API_KEY'] as const;

/** Just the surface of `api` we depend on, so the helper is testable without a fake api. */
export interface ApiConfigSurface {
  pluginConfig?: Record<string, unknown>;
}

/** Pick the first non-empty string from a list of candidates. */
function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

/**
 * Resolve the active KeeperHub API key.
 *
 * Order of precedence:
 *   1. `api.pluginConfig.apiKey` (operator config)
 *   2. `process.env.KH_API_KEY`
 *   3. `process.env.KEEPERHUB_API_KEY`
 *   4. `process.env.KEEPERSHUB_API_KEY`
 *
 * Returns `null` when nothing is configured. Tools should surface a clear
 * error message in that case rather than throwing during plugin registration
 * (which would block startup for unrelated reasons).
 */
export function resolveApiKey(api: ApiConfigSurface): string | null {
  const fromConfig = firstString(api.pluginConfig?.apiKey);
  if (fromConfig) return fromConfig;
  for (const name of ENV_VAR_NAMES) {
    const value = firstString(process.env[name]);
    if (value) return value;
  }
  return null;
}

/**
 * Validate the shape of the API key. KeeperHub keys carry a `kh_` prefix; we
 * warn but do not reject other shapes so unusual deployments still work.
 */
export function isLikelyValidApiKey(apiKey: string): boolean {
  return apiKey.startsWith('kh_');
}

/**
 * Names of the env vars we consult, exported for documentation surfaces and
 * the `kh_status` tool.
 */
export const SUPPORTED_ENV_VARS: ReadonlyArray<string> = ENV_VAR_NAMES;
