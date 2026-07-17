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

  // Billing / Square (v0.23.0, KBR-135). Set only on the hosted Cloudflare
  // deployment — billing is enabled iff SQUARE_ACCESS_TOKEN is present; the
  // Node self-host bindings never set these, so self-host is structurally
  // billing-free with unlimited seats (same graceful-degrade as MAILGUN_*).
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_ENVIRONMENT?: string; // 'sandbox' | 'production'
  SQUARE_LOCATION_ID?: string;
  SQUARE_APP_ID?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;

  // The database port (D1 on Cloudflare, libsql when self-hosted).
  db: Db;

  // The blob storage port for attachments (R2 on Cloudflare, filesystem when
  // self-hosted). Optional: unset ⇒ attachment upload/download return a clean
  // 503 (feature disabled) while the rest of the app is unaffected — the same
  // graceful-degrade as MAILGUN_*.
  blob?: BlobStore;
}
