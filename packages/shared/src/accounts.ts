/**
 * Human account primitives: self-registration, sessions, password reset,
 * and self-service API keys (v0.10.0).
 *
 * kbRelay has two auth modes that resolve to the same AuthContext:
 *  - bearer API tokens (agents / MCP) — unchanged, the original path;
 *  - a JWT-in-HttpOnly-cookie session (humans) — added here.
 *
 * These are the wire-level input schemas + response DTOs shared by the
 * Worker and the web client. The crypto (PBKDF2, JWT) lives in the API
 * (`apps/api/src/lib`), not here — this module stays dependency-light.
 */

import { z } from 'zod';
import type { UserKind, Role } from './auth.ts';

/**
 * A tenant membership role. The column may still hold kbRelay's older
 * 4-rank enum for forward-compat, but only these two are enforced:
 * `admin` governs team/RBAC/settings; `member` is everyone else.
 */
export type MembershipRole = 'admin' | 'member';

/**
 * Canonical email form: trimmed + lowercased. Used everywhere an email is
 * stored or compared so "Leif@Example.com " and "leif@example.com" collide
 * on the unique index. Pure — safe to unit-test.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** A validated, normalized email. Rejects malformed input at the edge. */
export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email('must be a valid email address')
  .transform((s) => s.toLowerCase());

/** Passwords: ≥8 chars, ≤200 (bcrypt-style ceiling; PBKDF2 has no real cap). */
export const passwordSchema = z.string().min(8, 'password must be at least 8 characters').max(200);

// ── Auth endpoint inputs ──────────────────────────────────────

export const registerInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'name is required').max(80),
  tenantName: z.string().trim().min(1, 'workspace name is required').max(80),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password is required').max(200),
});
export type LoginInput = z.infer<typeof loginInput>;

export const forgotPasswordInput = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInput>;

export const resetPasswordInput = z.object({
  token: z.string().min(1, 'token is required'),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInput>;

// ── Self-service API keys ─────────────────────────────────────

export const createTokenInput = z.object({
  label: z.string().trim().min(1, 'label is required').max(80),
});
export type CreateTokenInput = z.infer<typeof createTokenInput>;

/** A token as listed back to its owner — never includes the secret. */
export interface TokenSummary {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/** Response of POST /me/tokens — the plaintext is shown exactly once. */
export interface CreatedToken {
  token: TokenSummary;
  /** The plaintext secret. Present only on creation; never stored/returned again. */
  secret: string;
}

// ── Session identity ──────────────────────────────────────────

/** The signed-in human/agent as returned by GET /auth/me. */
export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  kind: UserKind;
  /** Enforced membership role in the active tenant. */
  role: MembershipRole;
  /** The 4-rank legacy role, if any (forward-compat; usually null). */
  legacyRole: Role | null;
  color: string;
  handle: string | null;
}

/** Response of GET /auth/me and POST /auth/{register,login}. */
export interface AuthMeResponse {
  user: AuthUser;
  tenant: { id: string; name: string; slug: string };
}

// ── Multi-workspace (v0.18.0, KBR-96) ─────────────────────────

/** One tenant the user belongs to, as returned by GET /me/memberships. */
export interface MembershipDto {
  tenant: { id: string; name: string; slug: string };
  role: MembershipRole;
}

/** Input of POST /auth/switch-tenant (cookie sessions only). */
export const switchTenantInput = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
});
export type SwitchTenantInput = z.infer<typeof switchTenantInput>;

/** Input of POST /tenants — a new workspace for the CURRENT user. */
export const createTenantInput = z.object({
  tenantName: z.string().trim().min(1, 'workspace name is required').max(80),
});
export type CreateTenantInput = z.infer<typeof createTenantInput>;
