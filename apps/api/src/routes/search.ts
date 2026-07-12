import { SEARCH_MIN_QUERY, SEARCH_MAX_RESULTS } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { tenantScope } from '../auth/tenant-scope';
import { searchTenant } from '../db/repos/search';

/**
 * GET /api/v1/search?q=&limit=&offset=&archived= — global quick-find
 * (v0.17.0, KBR-68; paginated KBR-133). Tenant-wide; RBAC is enforced inside
 * the query (members only see projects they were granted), so no route-level
 * access scope applies here.
 *
 * `limit` keeps clamp semantics for back-compat. `offset` (new) is REJECTED
 * when invalid, never clamped — a silently clamped offset returns a
 * valid-looking but wrong page and can trap a client on a terminal page.
 */
export async function handleSearch(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const q = ctx.url.searchParams.get('q')?.trim() ?? '';
  if (q.length < SEARCH_MIN_QUERY) {
    throw new HttpError(400, `q must be at least ${SEARCH_MIN_QUERY} characters`);
  }
  const limitRaw = ctx.url.searchParams.get('limit');
  const limit = limitRaw != null ? Number(limitRaw) : undefined;
  if (limit !== undefined && !Number.isFinite(limit)) {
    throw new HttpError(400, 'limit must be a number');
  }
  const offsetRaw = ctx.url.searchParams.get('offset');
  const offset = offsetRaw != null ? Number(offsetRaw) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= SEARCH_MAX_RESULTS) {
    throw new HttpError(400, `offset must be an integer in [0, ${SEARCH_MAX_RESULTS})`);
  }
  const started = Date.now();
  const page = await searchTenant(ctx.env, tenantId, q, {
    userId,
    isAdmin: ctx.auth?.role === 'admin',
    // Opt-in archived (KBR-130); anything but "1" excludes them.
    includeArchived: ctx.url.searchParams.get('archived') === '1',
  }, { limit, offset });
  // KBR-133: the empirical "LIKE until it visibly hurts" signal — watch these
  // in `wrangler tail` to know when FTS is actually warranted.
  console.log(
    `search tenant=${tenantId} ms=${Date.now() - started} offset=${offset} ` +
      `hits=${page.hits.length} truncated=${page.truncated}`,
  );
  return jsonResponse(200, page, ctx.cors);
}
