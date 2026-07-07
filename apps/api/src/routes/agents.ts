import { createAgentInput, patchAgentInput, setAgentProjectsInput, createTokenInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, errorResponse } from '../http';
import { parseJson } from '../validate';
import { HttpError } from '../http';
import {
  listAgents,
  createAgent,
  patchAgent,
  removeAgent,
  replaceAgentProjectAccess,
  resolveAgentActor,
  assertAgentControl,
  type AgentActor,
} from '../db/repos/agents';
import { listTokens, createToken, revokeToken } from '../db/repos/auth';

/**
 * Agent-user surface (v0.14.0, KBR-3; ownership model KBR-115). Open to every
 * authenticated tenant user — the repo scopes everything to the caller:
 * members manage only agents they own, admins additionally manage member-owned
 * and ownerless agents (never another admin's), the tenant owner manages all.
 * Out-of-scope targets 404 (no-leak). Role changes are capped at the owner's
 * role. Token ops reuse the (tenant,user)-scoped token repo fns with the
 * agent's id, behind the same control gate.
 */

async function actor(ctx: RouteContext): Promise<AgentActor> {
  if (!ctx.auth) throw new HttpError(401, 'Authentication required');
  return resolveAgentActor(ctx.env, ctx.auth);
}

// ── GET /api/v1/agents ────────────────────────────────────────
export async function handleListAgents(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  const agents = await listAgents(env, auth!.tenantId, await actor(ctx));
  return jsonResponse(200, { agents }, cors);
}

// ── POST /api/v1/agents ───────────────────────────────────────
export async function handleCreateAgent(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, request } = ctx;
  const creator = await actor(ctx);
  const input = await parseJson(request, createAgentInput);
  const agent = await createAgent(env, auth!.tenantId, creator, input.name, input.projectIds);
  return jsonResponse(201, { agent }, cors);
}

// ── PATCH /api/v1/agents/:userId ──────────────────────────────
export async function handlePatchAgent(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  const who = await actor(ctx);
  const input = await parseJson(request, patchAgentInput);
  await patchAgent(env, auth!.tenantId, who, params.userId!, input);
  return jsonResponse(200, { ok: true }, cors);
}

// ── PUT /api/v1/agents/:userId/projects ───────────────────────
export async function handleSetAgentProjects(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  const who = await actor(ctx);
  const input = await parseJson(request, setAgentProjectsInput);
  await replaceAgentProjectAccess(env, auth!.tenantId, who, params.userId!, input.projectIds);
  return jsonResponse(200, { ok: true }, cors);
}

// ── DELETE /api/v1/agents/:userId ─────────────────────────────
export async function handleRemoveAgent(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  const who = await actor(ctx);
  await removeAgent(env, auth!.tenantId, who, params.userId!);
  return jsonResponse(200, { ok: true }, cors);
}

// ── GET /api/v1/agents/:userId/tokens ─────────────────────────
export async function handleListAgentTokens(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  await assertAgentControl(env, auth!.tenantId, await actor(ctx), params.userId!);
  const tokens = await listTokens(env, auth!.tenantId, params.userId!);
  return jsonResponse(200, { tokens }, cors);
}

// ── POST /api/v1/agents/:userId/tokens ────────────────────────
export async function handleCreateAgentToken(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  await assertAgentControl(env, auth!.tenantId, await actor(ctx), params.userId!);
  const input = await parseJson(request, createTokenInput);
  const created = await createToken(env, auth!.tenantId, params.userId!, input.label);
  return jsonResponse(201, created, cors);
}

// ── DELETE /api/v1/agents/:userId/tokens/:tokenId ─────────────
export async function handleRevokeAgentToken(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  await assertAgentControl(env, auth!.tenantId, await actor(ctx), params.userId!);
  const ok = await revokeToken(env, auth!.tenantId, params.userId!, params.tokenId!);
  if (!ok) return errorResponse(404, 'Token not found', cors);
  return jsonResponse(200, { ok: true }, cors);
}
