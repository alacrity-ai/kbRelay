/**
 * MCP config — two env vars, passed via `claude mcp add … --env …`. No TOML /
 * multi-profile machinery (KISS). Missing either var throws a clear error that
 * the bin shim prints to stderr before exiting.
 */
export interface Config {
  baseUrl: string;
  apiKey: string;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const baseUrl = env.KBRELAY_BASE_URL?.replace(/\/+$/, '');
  const apiKey = env.KBRELAY_API_KEY;
  if (!baseUrl) {
    throw new ConfigError(
      'KBRELAY_BASE_URL is not set — e.g. https://kbrelay.com (or http://localhost:8080 for self-host).',
    );
  }
  if (!apiKey) {
    throw new ConfigError(
      'KBRELAY_API_KEY is not set — mint a token in the kbRelay web "API keys" panel.',
    );
  }
  return { baseUrl, apiKey };
}
