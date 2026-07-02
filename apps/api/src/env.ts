import type { Db } from './runtime/shared/db';
import type { BlobStore } from './runtime/shared/blob';

/**
 * The application environment handlers see — runtime-neutral (v0.12.0). Both
 * the Cloudflare Worker and the self-host Node server build one of these:
 * `runtime/cf/bindings.ts` from the Worker `env`, `runtime/node/bindings.ts`
 * from `process.env`. Handlers only ever touch `env.db` + config, never a
 * runtime primitive — that's the portability seam.
 */
export interface Env {
  // Public config.
  ALLOWED_ORIGINS: string;
  PUBLIC_BASE_URL: string;

  // Secrets (optional so local/self-host can run without them: no JWT_SECRET ⇒
  // human sessions disabled; no MAILGUN_* ⇒ email is a graceful no-op).
  JWT_SECRET?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  MAILGUN_BASE_URL?: string;
  MAILGUN_FROM?: string;

  // The database port (D1 on Cloudflare, libsql when self-hosted).
  db: Db;

  // The blob storage port for attachments (R2 on Cloudflare, filesystem when
  // self-hosted). Optional: unset ⇒ attachment upload/download return a clean
  // 503 (feature disabled) while the rest of the app is unaffected — the same
  // graceful-degrade as MAILGUN_*.
  blob?: BlobStore;
}
