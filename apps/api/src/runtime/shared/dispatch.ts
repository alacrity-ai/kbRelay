import type { Env } from '../../env';
import { getCorsHeaders, jsonResponse, errorResponse, HttpError } from '../../http';
import { routes } from '../../router';
import { authenticate } from '../../auth/authenticate';
import { authenticateSession } from '../../auth/session';
import { enforceProjectAccess } from '../../auth/access';

/**
 * The runtime-neutral request dispatcher (v0.12.0). Both entrypoints call this:
 * the Cloudflare Worker (`src/index.ts`) and the self-host Node server
 * (`runtime/node/index.ts`). It only touches the Web-standard `Request`/
 * `Response` and the built `Env` (with its `db` port) — never a runtime
 * primitive — so the same routing/auth/RBAC core runs unchanged on both.
 */
export async function dispatch(
  request: Request,
  env: Env,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  const cors = getCorsHeaders(request, env.ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(request.url);

  try {
    // Public: liveness.
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse(200, { ok: true, service: 'kbrelay', ts: Date.now() }, cors);
    }

    for (const r of routes) {
      if (r.method !== request.method) continue;
      const params = matchPath(r.pattern, url.pathname);
      if (!params) continue;

      // Authenticate everything except explicitly-public routes. Two modes:
      // bearer token first (agents/MCP), then the JWT session cookie (humans).
      let auth = null;
      if (!r.public) {
        auth = (await authenticate(request, env)) ?? (await authenticateSession(request, env));
        if (!auth) return errorResponse(401, 'Missing or invalid credentials', cors);

        // Project RBAC: enforce caller access for project-scoped routes
        // (throws 404 on missing or no-access) before the handler runs.
        if (r.access) await enforceProjectAccess(env, auth, r.access, params);
      }

      return await r.handler({ request, env, url, params, cors, auth, waitUntil });
    }

    return errorResponse(404, 'Not found', cors);
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.status, err.message, cors, err.details, err.headers);
    }
    console.error('Unhandled error:', err instanceof Error ? (err.stack ?? err.message) : err);
    return errorResponse(500, 'Internal error', cors);
  }
}

/**
 * Match a path template like `/api/v1/projects/:id/cards` against a concrete
 * pathname. Returns the extracted params, or null if no match.
 */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const pSeg = pattern.split('/').filter(Boolean);
  const uSeg = pathname.split('/').filter(Boolean);
  if (pSeg.length !== uSeg.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pSeg.length; i++) {
    const p = pSeg[i]!;
    const u = uSeg[i]!;
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(u);
    } else if (p !== u) {
      return null;
    }
  }
  return params;
}
