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
    return this.send(method, path, {
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /**
   * Multipart upload (v0.17.0, KBR-66) — POST one file part named `file`, the
   * shape `POST /cards/:id/attachments` expects. fetch sets the boundary; we
   * must NOT set content-type ourselves.
   */
  async upload<T = unknown>(
    path: string,
    file: { data: Uint8Array; filename: string; contentType?: string },
  ): Promise<T> {
    const form = new FormData();
    form.set(
      'file',
      new Blob([file.data as BlobPart], { type: file.contentType ?? 'application/octet-stream' }),
      file.filename,
    );
    return this.send('POST', path, { body: form });
  }

  private async send<T>(method: string, path: string, init: { headers?: Record<string, string>; body?: BodyInit }): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${this.config.baseUrl}/api${path}`, {
        method,
        headers: {
          ...init.headers,
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: init.body,
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
