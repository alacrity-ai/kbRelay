import type { MeResponse } from '@kbrelay/shared';
import { patchMeInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, errorResponse } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { getTenant, updateMe, getUserProfile } from '../db/repos/users';
import { listMyQueue } from '../db/repos/cards';
import { labelsForCards } from '../db/repos/labels';

/** GET /api/v1/me — whoami for the authenticated token. */
export async function handleMe(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);

  const [tenant, profile] = await Promise.all([
    getTenant(env, auth.tenantId),
    getUserProfile(env, auth.tenantId, auth.userId),
  ]);
  if (!tenant) return errorResponse(404, 'Tenant not found', cors);

  const body: MeResponse = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: { id: auth.userId, name: auth.userName, kind: auth.userKind, role: auth.role, color: auth.color, profile },
  };
  return jsonResponse(200, body, cors);
}

/**
 * GET /api/v1/me/queue?projectId= — the caller's actionable work (v0.15.0),
 * two typed sections since v0.17.0 (KBR-61): `work` (assigned to me, `ready`
 * column) and `review` (I'm the reviewer, `review` column). RBAC-scoped;
 * optionally narrowed to one project. This is the "what needs me now?" front
 * door for agents AND humans — see docs/v0.15.0/2-HUMAN_AGENT_FLOWS_DESIGN.md §4.2.
 */
export async function handleMyQueue(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const projectId = ctx.url.searchParams.get('projectId') ?? undefined;
  const queue = await listMyQueue(ctx.env, tenantId, userId, {
    isAdmin: ctx.auth?.role === 'admin',
    projectId,
  });
  // Labels ride along (KBR-62) so agents can triage by name without lookups.
  const labels = await labelsForCards(
    ctx.env, tenantId, [...queue.work, ...queue.review].map((c) => c.id),
  );
  const withLabels = <T extends { id: string }>(cs: T[]) => cs.map((c) => ({ ...c, labels: labels[c.id] ?? [] }));
  return jsonResponse(200, { work: withLabels(queue.work), review: withLabels(queue.review) }, ctx.cors);
}

/**
 * PATCH /api/v1/me — set your own color. The token is tied to a user, so a
 * caller can only recolor themselves. A card's display color is its assignee's.
 */
export async function handlePatchMe(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, request } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);

  const input = await parseJson(request, patchMeInput);
  await updateMe(env, auth.tenantId, auth.userId, input);

  const [tenant, profile] = await Promise.all([
    getTenant(env, auth.tenantId),
    getUserProfile(env, auth.tenantId, auth.userId),
  ]);
  if (!tenant) return errorResponse(404, 'Tenant not found', cors);

  const body: MeResponse = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    user: {
      id: auth.userId,
      name: auth.userName,
      kind: auth.userKind,
      role: auth.role,
      color: input.color ?? auth.color,
      profile,
    },
  };
  return jsonResponse(200, body, cors);
}
