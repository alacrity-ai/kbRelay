import { SEARCH_MIN_QUERY } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { tenantScope } from '../auth/tenant-scope';
import { searchTenant } from '../db/repos/search';

/**
 * GET /api/v1/search?q=&limit= — global quick-find (v0.17.0, KBR-68).
 * Tenant-wide; RBAC is enforced inside the query (members only see projects
 * they were granted), so no route-level access scope applies here.
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
  const hits = await searchTenant(ctx.env, tenantId, q, {
    userId,
    isAdmin: ctx.auth?.role === 'admin',
    // Opt-in archived (KBR-130); anything but "1" excludes them.
    includeArchived: ctx.url.searchParams.get('archived') === '1',
  }, limit);
  return jsonResponse(200, { hits }, ctx.cors);
}
