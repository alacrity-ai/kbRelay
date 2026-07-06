import type { Env } from '../../env';
import type {
  AuthContext,
  AuthUser,
  UserKind,
  Role,
  MembershipRole,
  TokenSummary,
  CreatedToken,
} from '@kbrelay/shared';
import { colorForUser } from '@kbrelay/shared';
import { newId } from '../ids';
import { sha256Hex } from '../../auth/authenticate';
import { hashPassword, verifyPassword, PASSWORD_ALGO } from '../../lib/password';
import { HttpError } from '../../http';

/**
 * Human-auth / identity repo (v0.10.0). The route layer composes these into
 * the /auth/* + /me/tokens endpoints; keeping the SQL here lets tests hit it
 * directly. Bearer-token auth (agents) is unaffected — see authenticate.ts.
 */

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Session resolution (cookie path) ──────────────────────────

/**
 * Build an AuthContext for a cookie session: the membership (tid, uid) is the
 * source of truth for access + role. Returns null if the membership is gone
 * (e.g. the user was removed from the tenant) so a stale cookie can't act.
 */
export async function loadSessionContext(
  env: Env,
  tenantId: string,
  userId: string,
): Promise<AuthContext | null> {
  const row = await env.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.kind AS kind, u.color AS color, m.role AS role
       FROM memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND m.user_id = ?`,
  )
    .bind(tenantId, userId)
    .first<{ id: string; name: string; kind: string; color: string | null; role: string }>();
  if (!row) return null;

  return {
    tenantId,
    userId: row.id,
    userName: row.name,
    userKind: row.kind as UserKind,
    role: (row.role as Role) ?? null,
    color: row.color ?? colorForUser(row.id),
    tokenId: null,
  };
}

/** The rich signed-in identity for GET /auth/me and register/login responses. */
export async function getAuthUser(
  env: Env,
  tenantId: string,
  userId: string,
): Promise<AuthUser | null> {
  const row = await env.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.email AS email, u.kind AS kind,
            u.role AS legacy_role, u.color AS color, u.handle AS handle, m.role AS role
       FROM memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND m.user_id = ?`,
  )
    .bind(tenantId, userId)
    .first<{
      id: string;
      name: string;
      email: string | null;
      kind: string;
      legacy_role: string | null;
      color: string | null;
      handle: string | null;
      role: string;
    }>();
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    kind: row.kind as UserKind,
    role: (row.role as MembershipRole) ?? 'member',
    legacyRole: (row.legacy_role as Role | null) ?? null,
    color: row.color ?? colorForUser(row.id),
    handle: row.handle ?? null,
  };
}

// ── Registration ──────────────────────────────────────────────

export interface RegisterArgs {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}

/**
 * Create a tenant + owner user (admin membership) + a starter agent user, all
 * in one atomic D1 batch. Throws HttpError(409) if the email is already in use.
 * Returns the ids needed to mint a session.
 */
export async function registerTenant(
  env: Env,
  input: RegisterArgs,
): Promise<{ tenantId: string; userId: string }> {
  const existing = await env.db.prepare('SELECT 1 AS ok FROM users WHERE email = ?')
    .bind(input.email)
    .first<{ ok: number }>();
  if (existing) throw new HttpError(409, 'That email is already registered');

  const now = Date.now();
  const tenantId = newId('t');
  const userId = newId('u');
  const agentId = newId('u');
  const slug = await uniqueTenantSlug(env, input.tenantName);
  const passwordHash = await hashPassword(input.password);
  const humanHandle = await uniqueHandle(env, tenantId, deriveHandle(input.name));
  const agentHandle = await uniqueHandle(env, tenantId, 'assistant', [humanHandle]);

  await env.db.batch([
    env.db.prepare('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').bind(
      tenantId,
      input.tenantName,
      slug,
      now,
    ),
    // Owner (human). Legacy role 'owner' mirrors the seed; membership role 'admin' governs.
    env.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, email, password_hash, password_algo, email_verified_at, created_at)
       VALUES (?, ?, ?, 'human', 'owner', NULL, ?, ?, ?, ?, ?, ?)`,
    ).bind(userId, tenantId, input.name, humanHandle, input.email, passwordHash, PASSWORD_ALGO, now, now),
    // Starter agent so the tenant is agent-ready from minute one; owned by the
    // new owner so it surfaces as a managed agent in the Agents tab (v0.14.0).
    env.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, owner_user_id, created_at)
       VALUES (?, ?, 'Assistant', 'agent', NULL, NULL, ?, ?, ?)`,
    ).bind(agentId, tenantId, agentHandle, userId, now),
    env.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'admin', ?)`,
    ).bind(newId('m'), tenantId, userId, now),
    env.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'member', ?)`,
    ).bind(newId('m'), tenantId, agentId, now),
  ]);

  return { tenantId, userId };
}

// ── Login ─────────────────────────────────────────────────────

/**
 * Verify credentials and choose the active tenant. Returns null uniformly for
 * unknown email / no password / bad password (no account enumeration).
 */
export async function loginUser(
  env: Env,
  email: string,
  password: string,
): Promise<{ tenantId: string; userId: string } | null> {
  const user = await env.db.prepare(
    'SELECT id, tenant_id, last_tenant_id, password_hash FROM users WHERE email = ?',
  )
    .bind(email)
    .first<{ id: string; tenant_id: string | null; last_tenant_id: string | null; password_hash: string | null }>();
  if (!user || !user.password_hash) return null;

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;

  const tenantId = await pickActiveTenant(env, user.id, user.tenant_id, user.last_tenant_id);
  if (!tenantId) return null; // credentials valid but no membership anywhere
  return { tenantId, userId: user.id };
}

/** Prefer where the user last worked (KBR-96), then their origin tenant, then
 *  the oldest membership. A stale last_tenant_id (membership revoked) is skipped. */
async function pickActiveTenant(
  env: Env,
  userId: string,
  originTenantId: string | null,
  lastTenantId: string | null = null,
): Promise<string | null> {
  const rs = await env.db.prepare(
    'SELECT tenant_id FROM memberships WHERE user_id = ? ORDER BY created_at ASC',
  )
    .bind(userId)
    .all<{ tenant_id: string }>();
  const tenantIds = (rs.results ?? []).map((r) => r.tenant_id);
  if (tenantIds.length === 0) return null;
  if (lastTenantId && tenantIds.includes(lastTenantId)) return lastTenantId;
  if (originTenantId && tenantIds.includes(originTenantId)) return originTenantId;
  return tenantIds[0]!;
}

// ── Multi-workspace (v0.18.0, KBR-96) ─────────────────────────

/** All tenants the user belongs to, oldest membership first. */
export async function listMemberships(
  env: Env,
  userId: string,
): Promise<{ tenant: { id: string; name: string; slug: string }; role: 'admin' | 'member' }[]> {
  const rs = await env.db.prepare(
    `SELECT t.id AS id, t.name AS name, t.slug AS slug, m.role AS role
       FROM memberships m
       JOIN tenants t ON t.id = m.tenant_id
      WHERE m.user_id = ?
      ORDER BY m.created_at ASC`,
  )
    .bind(userId)
    .all<{ id: string; name: string; slug: string; role: string }>();
  return (rs.results ?? []).map((r) => ({
    tenant: { id: r.id, name: r.name, slug: r.slug },
    role: r.role === 'admin' ? 'admin' : 'member',
  }));
}

/** The user's membership role in a tenant, or null if they don't belong. */
export async function getMembershipRole(
  env: Env,
  userId: string,
  tenantId: string,
): Promise<'admin' | 'member' | null> {
  const row = await env.db.prepare(
    'SELECT role FROM memberships WHERE user_id = ? AND tenant_id = ?',
  )
    .bind(userId, tenantId)
    .first<{ role: string }>();
  if (!row) return null;
  return row.role === 'admin' ? 'admin' : 'member';
}

/** Remember where the user is working so the next login lands there. */
export async function setLastTenant(env: Env, userId: string, tenantId: string): Promise<void> {
  await env.db.prepare('UPDATE users SET last_tenant_id = ? WHERE id = ?')
    .bind(tenantId, userId)
    .run();
}

/**
 * Create a new workspace for an EXISTING user (KBR-96): tenant + admin
 * membership + starter agent, mirroring registerTenant's seeding. This is the
 * sanctioned path around register's email-409 — an invited-in user can still
 * get a workspace of their own.
 */
export async function createTenantForUser(
  env: Env,
  userId: string,
  tenantName: string,
): Promise<{ tenantId: string }> {
  const user = await env.db.prepare('SELECT id, name FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; name: string }>();
  if (!user) throw new HttpError(404, 'User not found');

  const now = Date.now();
  const tenantId = newId('t');
  const agentId = newId('u');
  const slug = await uniqueTenantSlug(env, tenantName);
  const agentHandle = await uniqueHandle(env, tenantId, 'assistant');

  await env.db.batch([
    env.db.prepare('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').bind(
      tenantId,
      tenantName,
      slug,
      now,
    ),
    env.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'admin', ?)`,
    ).bind(newId('m'), tenantId, userId, now),
    // Starter agent so the workspace is agent-ready, owned by its creator.
    env.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, owner_user_id, created_at)
       VALUES (?, ?, 'Assistant', 'agent', NULL, NULL, ?, ?, ?)`,
    ).bind(agentId, tenantId, agentHandle, userId, now),
    env.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'member', ?)`,
    ).bind(newId('m'), tenantId, agentId, now),
    env.db.prepare('UPDATE users SET last_tenant_id = ? WHERE id = ?').bind(tenantId, userId),
  ]);

  return { tenantId };
}

// ── Password reset ────────────────────────────────────────────

export async function getUserByEmail(
  env: Env,
  email: string,
): Promise<{ id: string } | null> {
  return env.db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
}

/** Issue a single-use reset token; store only its sha256. Returns the cleartext. */
export async function issuePasswordResetToken(env: Env, userId: string): Promise<string> {
  const cleartext = randomToken();
  const tokenHash = await sha256Hex(cleartext);
  const now = Date.now();
  await env.db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(newId('prt'), userId, tokenHash, now + RESET_TTL_MS, now)
    .run();
  return cleartext;
}

/** Consume a reset token and set a new password. Returns false if invalid/expired/used. */
export async function consumePasswordResetToken(
  env: Env,
  cleartext: string,
  newPassword: string,
): Promise<boolean> {
  const tokenHash = await sha256Hex(cleartext);
  const row = await env.db.prepare(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
  )
    .bind(tokenHash)
    .first<{ id: string; user_id: string; expires_at: number; used_at: number | null }>();
  if (!row || row.used_at || row.expires_at < Date.now()) return false;

  const now = Date.now();
  const passwordHash = await hashPassword(newPassword);
  await env.db.batch([
    env.db.prepare(
      'UPDATE users SET password_hash = ?, password_algo = ? WHERE id = ?',
    ).bind(passwordHash, PASSWORD_ALGO, row.user_id),
    env.db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').bind(now, row.id),
  ]);
  return true;
}

// ── Self-service API keys ─────────────────────────────────────

export async function listTokens(
  env: Env,
  tenantId: string,
  userId: string,
): Promise<TokenSummary[]> {
  const rs = await env.db.prepare(
    `SELECT id, label, created_at, last_used_at
       FROM api_tokens
      WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL
      ORDER BY created_at DESC`,
  )
    .bind(tenantId, userId)
    .all<{ id: string; label: string; created_at: number; last_used_at: number | null }>();
  return (rs.results ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

/** Mint a token for the caller; return the plaintext ONCE (only the hash is stored). */
export async function createToken(
  env: Env,
  tenantId: string,
  userId: string,
  label: string,
): Promise<CreatedToken> {
  const secret = randomToken();
  const tokenHash = await sha256Hex(secret);
  const id = newId('tok');
  const now = Date.now();
  await env.db.prepare(
    `INSERT INTO api_tokens (id, tenant_id, user_id, token_hash, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, tenantId, userId, tokenHash, label, now)
    .run();
  return {
    token: { id, label, createdAt: now, lastUsedAt: null },
    secret,
  };
}

/** Revoke one of the caller's own tokens. Returns false if not found / not theirs. */
export async function revokeToken(
  env: Env,
  tenantId: string,
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const res = await env.db.prepare(
    `UPDATE api_tokens SET revoked_at = ?
      WHERE id = ? AND tenant_id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(Date.now(), tokenId, tenantId, userId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

// ── Small helpers ─────────────────────────────────────────────

/** 32 random bytes as lowercase hex — the plaintext form of reset/api/invite tokens. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'workspace';
}

async function uniqueTenantSlug(env: Env, name: string): Promise<string> {
  const base = slugify(name);
  let attempt = base;
  for (let n = 2; n < 100; n++) {
    const clash = await env.db.prepare('SELECT 1 AS ok FROM tenants WHERE slug = ?')
      .bind(attempt)
      .first<{ ok: number }>();
    if (!clash) return attempt;
    attempt = `${base}-${n}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Derive an @-handle from a display name; falls back to "user". */
export function deriveHandle(name: string): string {
  const first = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .trim()
    .split(/\s+/)[0];
  const cleaned = (first ?? '').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return cleaned || 'user';
}

export async function uniqueHandle(
  env: Env,
  tenantId: string,
  base: string,
  taken: string[] = [],
): Promise<string> {
  let attempt = base;
  for (let n = 2; n < 100; n++) {
    const clash =
      taken.includes(attempt) ||
      (await env.db.prepare('SELECT 1 AS ok FROM users WHERE tenant_id = ? AND handle = ?')
        .bind(tenantId, attempt)
        .first<{ ok: number }>());
    if (!clash) return attempt;
    attempt = `${base}${n}`;
  }
  return `${base}${crypto.randomUUID().slice(0, 4)}`;
}
