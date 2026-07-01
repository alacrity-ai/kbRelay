import type { RouteContext } from '../router';
import { jsonResponse } from '../http';
import { tenantScope } from '../auth/tenant-scope';
import { listUsers } from '../db/repos/users';

/** GET /api/v1/users — tenant members, for assignee pickers. */
export async function handleListUsers(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const users = await listUsers(ctx.env, tenantId);
  return jsonResponse(200, { users }, ctx.cors);
}
