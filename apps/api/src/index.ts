import { dispatch } from './runtime/shared/dispatch';
import { buildCfBindings, type CfBindings } from './runtime/cf/bindings';

/**
 * kbRelay API — the Cloudflare Worker entrypoint (v0.12.0).
 *
 * Thin by design: it maps the Worker `env` (D1 + vars/secrets) into the
 * runtime-neutral `Env` and hands off to the shared `dispatch`. The self-host
 * Node server (`runtime/node/index.ts`) uses the same `dispatch` over a libsql
 * `db`, so the routing/auth/RBAC core is identical on both.
 */
export default {
  async fetch(request: Request, env: CfBindings, ctx: ExecutionContext): Promise<Response> {
    return dispatch(request, buildCfBindings(env), (p) => ctx.waitUntil(p));
  },
};
