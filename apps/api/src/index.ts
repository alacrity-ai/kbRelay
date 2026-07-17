import { dispatch } from './runtime/shared/dispatch';
import { buildCfBindings, type CfBindings } from './runtime/cf/bindings';
import { runBillingSweep } from './services/billing';

/**
 * kbRelay API — the Cloudflare Worker entrypoint (v0.12.0).
 *
 * Thin by design: it maps the Worker `env` (D1 + vars/secrets) into the
 * runtime-neutral `Env` and hands off to the shared `dispatch`. The self-host
 * Node server (`runtime/node/index.ts`) uses the same `dispatch` over a libsql
 * `db`, so the routing/auth/RBAC core is identical on both.
 *
 * `scheduled` is the daily billing sweep (v0.23.0, KBR-135) — cron lives in
 * wrangler.toml, hosted-only by construction: the Node self-host entrypoint
 * has no scheduler and the sweep itself no-ops without SQUARE_ACCESS_TOKEN.
 */
export default {
  async fetch(request: Request, env: CfBindings, ctx: ExecutionContext): Promise<Response> {
    return dispatch(request, buildCfBindings(env), (p) => ctx.waitUntil(p));
  },

  async scheduled(_event: ScheduledEvent, env: CfBindings, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runBillingSweep(buildCfBindings(env), Date.now()));
  },
};
