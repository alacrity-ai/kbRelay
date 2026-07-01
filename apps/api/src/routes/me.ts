import type { MeResponse } from '@kbrelay/shared';
import { patchMeInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, errorResponse } from '../http';
import { parseJson } from '../validate';
import { getTenant, updateUserColor } from '../db/repos/users';

/** GET /api/v1/me — whoami for the authenticated token. */
export async function handleMe(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);

  const tenant = await getTenant(env, auth.tenantId);
  if (!tenant) return errorResponse(404, 'Tenant not found', cors);

  const body: MeResponse = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: { id: auth.userId, name: auth.userName, kind: auth.userKind, role: auth.role, color: auth.color },
  };
  return jsonResponse(200, body, cors);
}

/**
 * PATCH /api/v1/me — set your own color. The token is tied to a user, so a
 * caller can only recolor themselves. A card's display color is its assignee's.
 */
export async function handlePatchMe(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, request } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);

  const input = await parseJson(request, patchMeInput);
  await updateUserColor(env, auth.tenantId, auth.userId, input.color);

  const tenant = await getTenant(env, auth.tenantId);
  if (!tenant) return errorResponse(404, 'Tenant not found', cors);

  const body: MeResponse = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: { id: auth.userId, name: auth.userName, kind: auth.userKind, role: auth.role, color: input.color },
  };
  return jsonResponse(200, body, cors);
}
