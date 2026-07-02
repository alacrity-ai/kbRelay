import type { RouteContext } from '../router';
import { jsonResponse } from '../http';
import { tenantScope } from '../auth/tenant-scope';
import { listUsers } from '../db/repos/users';

/**
 * GET /api/v1/users — current tenant members, for assignee/mention pickers.
 * Optional `?projectId=` scopes to users who can access that project (so the
 * @-autocomplete only suggests people a mention would actually reach).
 */
export async function handleListUsers(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const projectId = ctx.url.searchParams.get('projectId') ?? undefined;
  const users = await listUsers(ctx.env, tenantId, projectId);
  return jsonResponse(200, { users }, ctx.cors);
}
