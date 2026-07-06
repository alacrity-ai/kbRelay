import type { Env } from '../../env';
import type { Db } from '../shared/db';
import type { BlobStore } from '../shared/blob';
import { resilientDb } from './resilient-db';

/**
 * Raw Cloudflare Worker bindings (from `wrangler.toml` vars/secrets + the D1
 * and R2 bindings). `buildCfBindings` maps these into the runtime-neutral `Env`
 * the dispatcher expects — the D1 binding is the `db` port as-is (it already
 * satisfies the port's shape), and the R2 binding is wrapped into the `blob`
 * port.
 */
export interface CfBindings {
  DB: D1Database;
  /** Attachments bucket (v0.16.0). Optional so a Worker without it still boots. */
  BLOB?: R2Bucket;
  ALLOWED_ORIGINS: string;
  PUBLIC_BASE_URL: string;
  JWT_SECRET?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  MAILGUN_BASE_URL?: string;
  MAILGUN_FROM?: string;
}

/** Wrap an R2 binding as the runtime-neutral `BlobStore` port. */
function r2BlobStore(bucket: R2Bucket): BlobStore {
  return {
    async put(key, body, opts) {
      await bucket.put(key, body, { httpMetadata: { contentType: opts.contentType } });
    },
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return { body: obj.body, size: obj.size };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

export function buildCfBindings(cf: CfBindings): Env {
  return {
    // Wrap the raw D1 binding with the resilient port (KBR-108): per-query
    // timeout, transient-read retry, and a clean 503 instead of a 45s hang.
    db: resilientDb(cf.DB as unknown as Db),
    blob: cf.BLOB ? r2BlobStore(cf.BLOB) : undefined,
    ALLOWED_ORIGINS: cf.ALLOWED_ORIGINS,
    PUBLIC_BASE_URL: cf.PUBLIC_BASE_URL,
    JWT_SECRET: cf.JWT_SECRET,
    MAILGUN_API_KEY: cf.MAILGUN_API_KEY,
    MAILGUN_DOMAIN: cf.MAILGUN_DOMAIN,
    MAILGUN_BASE_URL: cf.MAILGUN_BASE_URL,
    MAILGUN_FROM: cf.MAILGUN_FROM,
  };
}
