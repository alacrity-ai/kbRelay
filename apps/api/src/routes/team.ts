import { inviteInput, setMemberRoleInput, setProjectAccessInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, errorResponse } from '../http';
import { parseJson } from '../validate';
import { requireAdmin } from '../auth/access';
import { sendMailgun } from '../services/mailgun';
import { inviteEmail } from '../email/templates';
import {
  listTeam,
  inviteMember,
  revokeInvite,
  setMemberRole,
  removeMember,
  replaceMemberProjectAccess,
} from '../db/repos/team';
import { getTenant } from '../db/repos/users';

/**
 * Team management + project RBAC admin surface (v0.11.0). Every handler here is
 * admin-gated via requireAdmin (403 otherwise). accept-invite is public and
 * lives in routes/auth.ts. Project access is binary — grant or revoke.
 */

// ── GET /api/v1/team ──────────────────────────────────────────
export async function handleGetTeam(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  requireAdmin(auth);
  return jsonResponse(200, await listTeam(env, auth!.tenantId), cors);
}

// ── POST /api/v1/team/invites ─────────────────────────────────
export async function handleInvite(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, request, waitUntil } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, inviteInput);

  const { cleartext } = await inviteMember(env, auth!.tenantId, auth!.userId, input.email, input.role);

  const tenant = await getTenant(env, auth!.tenantId);
  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const mail = inviteEmail({
    inviterName: auth!.userName,
    tenantName: tenant?.name ?? 'a workspace',
    role: input.role,
    acceptUrl: `${baseUrl}/auth/accept-invite/${cleartext}`,
  });
  waitUntil(
    sendMailgun(env, { to: input.email, ...mail, tags: ['invite'] }).then((r) => {
      if (!r.ok) console.warn(`[team] invite mail failed: ${r.error}`);
    }),
  );

  return jsonResponse(201, { ok: true }, cors);
}

// ── DELETE /api/v1/team/invites/:id ───────────────────────────
export async function handleRevokeInvite(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  requireAdmin(auth);
  const ok = await revokeInvite(env, auth!.tenantId, params.id!);
  if (!ok) return errorResponse(404, 'Invite not found', cors);
  return jsonResponse(200, { ok: true }, cors);
}

// ── PATCH /api/v1/team/members/:userId ────────────────────────
export async function handleSetMemberRole(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, setMemberRoleInput);
  await setMemberRole(env, auth!.tenantId, params.userId!, input.role);
  return jsonResponse(200, { ok: true }, cors);
}

// ── DELETE /api/v1/team/members/:userId ───────────────────────
export async function handleRemoveMember(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  requireAdmin(auth);
  await removeMember(env, auth!.tenantId, params.userId!);
  return jsonResponse(200, { ok: true }, cors);
}

// ── PUT /api/v1/team/members/:userId/projects ─────────────────
export async function handleSetMemberProjects(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, setProjectAccessInput);
  await replaceMemberProjectAccess(env, auth!.tenantId, params.userId!, input.projectIds);
  return jsonResponse(200, { ok: true }, cors);
}
