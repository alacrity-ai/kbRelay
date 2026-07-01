import { createAgentInput, patchAgentInput, createTokenInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, errorResponse } from '../http';
import { parseJson } from '../validate';
import { requireAdmin } from '../auth/access';
import {
  listAgents,
  createAgent,
  patchAgent,
  removeAgent,
  assertAgentInTenant,
} from '../db/repos/agents';
import { listTokens, createToken, revokeToken } from '../db/repos/auth';

/**
 * Agent-user admin surface (v0.14.0, KBR-3). Every handler is admin-gated
 * (403 otherwise). An admin creates agent users, manages their project access
 * (via the /team/members/:id/projects route), and mints/revokes their API keys.
 * Token ops reuse the (tenant,user)-scoped token repo fns with the agent's id,
 * guarded by assertAgentInTenant so an admin can only touch agents in their own
 * tenant (404 otherwise) — never a human or another tenant's user.
 */

// ── GET /api/v1/agents ────────────────────────────────────────
export async function handleListAgents(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  requireAdmin(auth);
  const agents = await listAgents(env, auth!.tenantId);
  return jsonResponse(200, { agents }, cors);
}

// ── POST /api/v1/agents ───────────────────────────────────────
export async function handleCreateAgent(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, createAgentInput);
  const agent = await createAgent(env, auth!.tenantId, auth!.userId, input.name, input.projectIds);
  return jsonResponse(201, { agent }, cors);
}

// ── PATCH /api/v1/agents/:userId ──────────────────────────────
export async function handlePatchAgent(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, patchAgentInput);
  await patchAgent(env, auth!.tenantId, params.userId!, input);
  return jsonResponse(200, { ok: true }, cors);
}

// ── DELETE /api/v1/agents/:userId ─────────────────────────────
export async function handleRemoveAgent(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  requireAdmin(auth);
  await removeAgent(env, auth!.tenantId, params.userId!);
  return jsonResponse(200, { ok: true }, cors);
}

// ── GET /api/v1/agents/:userId/tokens ─────────────────────────
export async function handleListAgentTokens(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  requireAdmin(auth);
  await assertAgentInTenant(env, auth!.tenantId, params.userId!);
  const tokens = await listTokens(env, auth!.tenantId, params.userId!);
  return jsonResponse(200, { tokens }, cors);
}

// ── POST /api/v1/agents/:userId/tokens ────────────────────────
export async function handleCreateAgentToken(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  requireAdmin(auth);
  await assertAgentInTenant(env, auth!.tenantId, params.userId!);
  const input = await parseJson(request, createTokenInput);
  const created = await createToken(env, auth!.tenantId, params.userId!, input.label);
  return jsonResponse(201, created, cors);
}

// ── DELETE /api/v1/agents/:userId/tokens/:tokenId ─────────────
export async function handleRevokeAgentToken(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  requireAdmin(auth);
  await assertAgentInTenant(env, auth!.tenantId, params.userId!);
  const ok = await revokeToken(env, auth!.tenantId, params.userId!, params.tokenId!);
  if (!ok) return errorResponse(404, 'Token not found', cors);
  return jsonResponse(200, { ok: true }, cors);
}
