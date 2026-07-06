import type { AuthMeResponse } from '@kbrelay/shared';
import {
  registerInput,
  loginInput,
  forgotPasswordInput,
  resetPasswordInput,
  acceptInviteInput,
  switchTenantInput,
  createTenantInput,
} from '@kbrelay/shared';
import type { RouteContext } from '../router';
import type { Env } from '../env';
import { jsonResponse, errorResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { signSession } from '../lib/jwt';
import { buildSetCookie, buildClearCookie, readSessionCookie, SESSION_TTL_SECONDS } from '../lib/cookies';
import { sendMailgun } from '../services/mailgun';
import { welcomeEmail, passwordResetEmail } from '../email/templates';
import {
  registerTenant,
  loginUser,
  getUserByEmail,
  issuePasswordResetToken,
  consumePasswordResetToken,
  getAuthUser,
  getMembershipRole,
  setLastTenant,
  createTenantForUser,
} from '../db/repos/auth';
import { acceptInvite } from '../db/repos/team';
import { getTenant } from '../db/repos/users';

/**
 * Human auth surface (v0.10.0): register / login / logout / forgot / reset,
 * plus session-required GET /auth/me. Sits alongside the untouched bearer-
 * token path. register/login/logout/forgot/reset are public routes (mounted
 * with `public: true`); /auth/me is protected and works for either auth mode.
 */

/** Sign a JWT for (userId in tenantId) and return the Set-Cookie header value. */
async function mintSessionCookie(env: Env, userId: string, tenantId: string): Promise<string> {
  if (!env.JWT_SECRET) throw new HttpError(503, 'Sessions are not configured (no JWT_SECRET)');
  const token = await signSession(env.JWT_SECRET, { uid: userId, tid: tenantId }, SESSION_TTL_SECONDS);
  return buildSetCookie(env, token);
}

/** Compose the {user, tenant} body returned by register / login / me. */
async function authMeBody(env: Env, tenantId: string, userId: string): Promise<AuthMeResponse> {
  const [user, tenant] = await Promise.all([
    getAuthUser(env, tenantId, userId),
    getTenant(env, tenantId),
  ]);
  if (!user || !tenant) throw new HttpError(500, 'Account state inconsistent');
  return { user, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
}

// ── POST /api/v1/auth/register ────────────────────────────────
export async function handleRegister(ctx: RouteContext): Promise<Response> {
  const { env, cors, request, waitUntil } = ctx;
  const input = await parseJson(request, registerInput);

  const { tenantId, userId } = await registerTenant(env, input);
  const cookie = await mintSessionCookie(env, userId, tenantId);
  const body = await authMeBody(env, tenantId, userId);

  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const welcome = welcomeEmail({
    name: input.name,
    tenantName: input.tenantName,
    signInUrl: `${baseUrl}/auth/sign-in`,
  });
  waitUntil(
    sendMailgun(env, { to: input.email, ...welcome, tags: ['welcome'] }).then((r) => {
      if (!r.ok) console.warn(`[auth] welcome mail failed: ${r.error}`);
    }),
  );

  return jsonResponse(201, body, cors, { 'Set-Cookie': cookie });
}

// ── POST /api/v1/auth/login ───────────────────────────────────
export async function handleLogin(ctx: RouteContext): Promise<Response> {
  const { env, cors, request } = ctx;
  const input = await parseJson(request, loginInput);

  const result = await loginUser(env, input.email, input.password);
  if (!result) return errorResponse(401, 'Invalid email or password', cors);

  const cookie = await mintSessionCookie(env, result.userId, result.tenantId);
  const body = await authMeBody(env, result.tenantId, result.userId);
  return jsonResponse(200, body, cors, { 'Set-Cookie': cookie });
}

// ── POST /api/v1/auth/switch-tenant (v0.18.0, KBR-96) ────────
/** Re-issue the session cookie for another tenant the caller belongs to.
 *  Cookie sessions only — a bearer token's tenant is immutable by design
 *  (mint a key per tenant). 404 (not 403) when there's no membership, so we
 *  don't confirm a tenant id exists. */
export async function handleSwitchTenant(ctx: RouteContext): Promise<Response> {
  const { env, cors, request, auth } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);
  if (!readSessionCookie(request)) {
    throw new HttpError(400, 'Tenant switching is session-only; API keys are single-tenant (mint one per workspace)');
  }
  const input = await parseJson(request, switchTenantInput);
  const role = await getMembershipRole(env, auth.userId, input.tenantId);
  if (!role) throw new HttpError(404, 'Workspace not found');

  await setLastTenant(env, auth.userId, input.tenantId);
  const cookie = await mintSessionCookie(env, auth.userId, input.tenantId);
  const body = await authMeBody(env, input.tenantId, auth.userId);
  return jsonResponse(200, body, cors, { 'Set-Cookie': cookie });
}

// ── POST /api/v1/tenants (v0.18.0, KBR-96) ───────────────────
/** A new workspace for the CURRENT user (tenant + admin membership + starter
 *  agent). The sanctioned path around register's email-409 for existing
 *  accounts. Re-issues the session cookie into the new tenant when the caller
 *  is on a cookie session. */
export async function handleCreateTenant(ctx: RouteContext): Promise<Response> {
  const { env, cors, request, auth } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);
  const input = await parseJson(request, createTenantInput);

  const { tenantId } = await createTenantForUser(env, auth.userId, input.tenantName);
  const body = await authMeBody(env, tenantId, auth.userId);
  const headers: Record<string, string> = {};
  if (readSessionCookie(request)) {
    headers['Set-Cookie'] = await mintSessionCookie(env, auth.userId, tenantId);
  }
  return jsonResponse(201, body, cors, headers);
}

// ── POST /api/v1/auth/logout ──────────────────────────────────
export function handleLogout(ctx: RouteContext): Response {
  const { env, cors } = ctx;
  return jsonResponse(200, { ok: true }, cors, { 'Set-Cookie': buildClearCookie(env) });
}

// ── POST /api/v1/auth/forgot-password ─────────────────────────
export async function handleForgotPassword(ctx: RouteContext): Promise<Response> {
  const { env, cors, request, waitUntil } = ctx;
  const input = await parseJson(request, forgotPasswordInput);

  // Always 200 — never leak whether the email exists.
  const user = await getUserByEmail(env, input.email);
  if (user) {
    const cleartext = await issuePasswordResetToken(env, user.id);
    const baseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, '');
    const reset = passwordResetEmail({ resetUrl: `${baseUrl}/auth/reset/${cleartext}` });
    waitUntil(
      sendMailgun(env, { to: input.email, ...reset, tags: ['password-reset'] }).then((r) => {
        if (!r.ok) console.warn(`[auth] reset mail failed: ${r.error}`);
      }),
    );
  }
  return jsonResponse(200, { ok: true }, cors);
}

// ── POST /api/v1/auth/reset-password ──────────────────────────
export async function handleResetPassword(ctx: RouteContext): Promise<Response> {
  const { env, cors, request } = ctx;
  const input = await parseJson(request, resetPasswordInput);

  const ok = await consumePasswordResetToken(env, input.token, input.password);
  if (!ok) return errorResponse(400, 'That reset link is invalid or has expired', cors);
  return jsonResponse(200, { ok: true }, cors);
}

// ── POST /api/v1/auth/accept-invite ───────────────────────────
export async function handleAcceptInvite(ctx: RouteContext): Promise<Response> {
  const { env, cors, request } = ctx;
  const input = await parseJson(request, acceptInviteInput);

  const result = await acceptInvite(env, input.token, { name: input.name, password: input.password });
  if (!result) return errorResponse(400, 'That invite is invalid, expired, or already used', cors);

  const cookie = await mintSessionCookie(env, result.userId, result.tenantId);
  const body = await authMeBody(env, result.tenantId, result.userId);
  return jsonResponse(200, body, cors, { 'Set-Cookie': cookie });
}

// ── GET /api/v1/auth/me ───────────────────────────────────────
export async function handleAuthMe(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', cors);
  const body = await authMeBody(env, auth.tenantId, auth.userId);
  return jsonResponse(200, body, cors);
}
