import type { Config } from './config.js';

/**
 * A tiny standalone typed fetch wrapper over kbRelay's HTTP API. Deliberately
 * NOT a workspace dependency on @kbrelay/shared, so the published package is
 * self-contained and `npx -y` needs no extra installs. Sends
 * `Authorization: Bearer <KBRELAY_API_KEY>` (kbRelay's scheme); the token's
 * tenant + RBAC project access govern exactly what it can see and do.
 */
export class KbRelayClient {
  constructor(private readonly config: Config) {}

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${this.config.baseUrl}/api${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          /* non-JSON body */
        }
      }

      if (!res.ok) {
        const err = json as { error?: string; details?: Record<string, string> } | null;
        let message = err?.error ?? `kbRelay request failed (${res.status})`;
        if (err?.details) {
          message += ` — ${Object.entries(err.details).map(([k, v]) => `${k}: ${v}`).join('; ')}`;
        }
        throw new Error(message);
      }
      return json as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('kbRelay request timed out after 30s', { cause: err });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
