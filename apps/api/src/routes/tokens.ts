import { createTokenInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, errorResponse } from '../http';
import { parseJson } from '../validate';
import { listTokens, createToken, revokeToken } from '../db/repos/auth';

/**
 * Self-service API keys (v0.10.0). A signed-in human (cookie) — or an existing
 * token holder — manages their own bearer tokens: the keys they hand to agents
 * and the MCP. The secret is returned exactly once, on creation.
 */

// ── GET /api/v1/me/tokens ─────────────────────────────────────
export async function handleListTokens(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);
  const tokens = await listTokens(env, auth.tenantId, auth.userId);
  return jsonResponse(200, { tokens }, cors);
}

// ── POST /api/v1/me/tokens ────────────────────────────────────
export async function handleCreateToken(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, request } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);
  const input = await parseJson(request, createTokenInput);
  const created = await createToken(env, auth.tenantId, auth.userId, input.label);
  return jsonResponse(201, created, cors);
}

// ── DELETE /api/v1/me/tokens/:id ──────────────────────────────
export async function handleDeleteToken(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);
  const ok = await revokeToken(env, auth.tenantId, auth.userId, params.id!);
  if (!ok) return errorResponse(404, 'Token not found', cors);
  return jsonResponse(200, { ok: true }, cors);
}
