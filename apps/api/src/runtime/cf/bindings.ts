import type { Env } from '../../env';
import type { Db } from '../shared/db';

/**
 * Raw Cloudflare Worker bindings (from `wrangler.toml` vars/secrets + the D1
 * binding). `buildCfBindings` maps these into the runtime-neutral `Env` the
 * dispatcher expects — the D1 binding is the `db` port as-is (it already
 * satisfies the port's shape).
 */
export interface CfBindings {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  PUBLIC_BASE_URL: string;
  JWT_SECRET?: string;
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  MAILGUN_BASE_URL?: string;
  MAILGUN_FROM?: string;
}

export function buildCfBindings(cf: CfBindings): Env {
  return {
    db: cf.DB as unknown as Db,
    ALLOWED_ORIGINS: cf.ALLOWED_ORIGINS,
    PUBLIC_BASE_URL: cf.PUBLIC_BASE_URL,
    JWT_SECRET: cf.JWT_SECRET,
    MAILGUN_API_KEY: cf.MAILGUN_API_KEY,
    MAILGUN_DOMAIN: cf.MAILGUN_DOMAIN,
    MAILGUN_BASE_URL: cf.MAILGUN_BASE_URL,
    MAILGUN_FROM: cf.MAILGUN_FROM,
  };
}
