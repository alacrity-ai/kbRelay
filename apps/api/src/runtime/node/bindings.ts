import type { Env } from '../../env';
import { createLibsqlDb } from './libsql-db';
import { createFsBlobStore } from './fs-blob';

/**
 * Build the runtime-neutral `Env` for the self-host Node server from
 * `process.env` (v0.12.0). Config comes from `.env.selfhost`:
 *   DATABASE_URL   e.g. file:/data/kbrelay.db   (default: local file)
 *   JWT_SECRET     required for human sessions (agents' tokens work without it)
 *   BLOB_DIR       attachment storage dir (default: /data/attachments)
 *   PUBLIC_BASE_URL, ALLOWED_ORIGINS, MAILGUN_* (all optional)
 */
export function buildNodeBindings(proc: NodeJS.ProcessEnv = process.env): { env: Env } {
  const url = proc.DATABASE_URL ?? 'file:./kbrelay.db';
  const { db } = createLibsqlDb(url);
  const publicBaseUrl = proc.PUBLIC_BASE_URL ?? 'http://localhost:8080';
  return {
    env: {
      db,
      // Self-host always has a filesystem blob store (attachments live in the
      // same /data volume as the SQLite db). A future S3/MinIO adapter would
      // swap in here behind the same BlobStore port.
      blob: createFsBlobStore(proc.BLOB_DIR ?? '/data/attachments'),
      // Same-origin in self-host (Node serves the SPA too), so CORS is moot;
      // default the allowlist to the public base URL.
      ALLOWED_ORIGINS: proc.ALLOWED_ORIGINS ?? publicBaseUrl,
      PUBLIC_BASE_URL: publicBaseUrl,
      JWT_SECRET: proc.JWT_SECRET,
      MAILGUN_API_KEY: proc.MAILGUN_API_KEY,
      MAILGUN_DOMAIN: proc.MAILGUN_DOMAIN,
      MAILGUN_BASE_URL: proc.MAILGUN_BASE_URL,
      MAILGUN_FROM: proc.MAILGUN_FROM,
    },
  };
}
