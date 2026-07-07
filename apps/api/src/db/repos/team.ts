import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { TeamResponse, TeamMember, PendingInvite, MembershipRole, UserKind } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { sha256Hex } from '../../auth/authenticate';
import { hashPassword, PASSWORD_ALGO } from '../../lib/password';
import { randomToken, deriveHandle, uniqueHandle } from './auth';
import { tenantOwnerId } from './users';

/**
 * Team management + project-access data ops (v0.11.0). All the admin-gated
 * team endpoints and the project_access grants live here so the routes stay
 * thin and the logic is unit-testable. `project_access` is binary: a row =
 * full access to that project.
 */

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Project access grants ─────────────────────────────────────

/** Grant a user access to a project (idempotent). Used when a member creates one. */
export function grantProjectAccessStmt(
  env: Env,
  tenantId: string,
  projectId: string,
  userId: string,
): DbStatement {
  return env.db.prepare(
    `INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
     VALUES (?, ?, ?, ?)`,
  ).bind(tenantId, projectId, userId, Date.now());
}

/** Replace a member's entire project-access set with `projectIds` (the checklist save). */
export async function replaceMemberProjectAccess(
  env: Env,
  tenantId: string,
  userId: string,
  projectIds: string[],
): Promise<void> {
  const member = await env.db.prepare(
    'SELECT 1 AS ok FROM memberships WHERE tenant_id = ? AND user_id = ?',
  )
    .bind(tenantId, userId)
    .first<{ ok: number }>();
  if (!member) throw new HttpError(404, 'Member not found');

  // Keep only ids that are real projects in this tenant.
  let valid: string[] = [];
  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(', ');
    const rs = await env.db.prepare(
      `SELECT id FROM projects WHERE tenant_id = ? AND id IN (${placeholders})`,
    )
      .bind(tenantId, ...projectIds)
      .all<{ id: string }>();
    valid = (rs.results ?? []).map((r) => r.id);
  }

  const now = Date.now();
  const stmts: DbStatement[] = [
    env.db.prepare('DELETE FROM project_access WHERE tenant_id = ? AND user_id = ?').bind(
      tenantId,
      userId,
    ),
    ...valid.map((pid) =>
      env.db.prepare(
        `INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
         VALUES (?, ?, ?, ?)`,
      ).bind(tenantId, pid, userId, now),
    ),
  ];
  await env.db.batch(stmts);
}

// ── Team listing ──────────────────────────────────────────────

export async function listTeam(env: Env, tenantId: string): Promise<TeamResponse> {
  const ownerId = await tenantOwnerId(env, tenantId);
  const membersRs = await env.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.email AS email, u.kind AS kind, m.role AS role
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? ORDER BY u.name ASC`,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; email: string | null; kind: string; role: string }>();

  const accessRs = await env.db.prepare(
    'SELECT project_id, user_id FROM project_access WHERE tenant_id = ?',
  )
    .bind(tenantId)
    .all<{ project_id: string; user_id: string }>();
  const byUser = new Map<string, string[]>();
  for (const row of accessRs.results ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.project_id);
    byUser.set(row.user_id, list);
  }

  const members: TeamMember[] = (membersRs.results ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    kind: m.kind as UserKind,
    role: m.role as MembershipRole,
    isOwner: m.id === ownerId,
    projectIds: byUser.get(m.id) ?? [],
  }));

  const now = Date.now();
  const invitesRs = await env.db.prepare(
    `SELECT id, email, role, created_at, expires_at FROM invites
      WHERE tenant_id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC`,
  )
    .bind(tenantId, now)
    .all<{ id: string; email: string; role: string; created_at: number; expires_at: number }>();
  const invites: PendingInvite[] = (invitesRs.results ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role as MembershipRole,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
  }));

  return { members, invites };
}

// ── Invites ───────────────────────────────────────────────────

/** Create an invite; returns the cleartext token for the email link. Throws 409 if already a member. */
export async function inviteMember(
  env: Env,
  tenantId: string,
  invitedByUserId: string,
  email: string,
  role: MembershipRole,
): Promise<{ inviteId: string; cleartext: string }> {
  const already = await env.db.prepare(
    `SELECT 1 AS ok FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND u.email = ?`,
  )
    .bind(tenantId, email)
    .first<{ ok: number }>();
  if (already) throw new HttpError(409, 'That email is already a member of this workspace');

  const cleartext = randomToken();
  const tokenHash = await sha256Hex(cleartext);
  const id = newId('inv');
  const now = Date.now();
  await env.db.batch([
    // Supersede any still-pending invite for the same email (one live invite per email).
    env.db.prepare(
      `UPDATE invites SET revoked_at = ?
        WHERE tenant_id = ? AND email = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
    ).bind(now, tenantId, email),
    env.db.prepare(
      `INSERT INTO invites (id, tenant_id, email, role, token_hash, invited_by_user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, tenantId, email, role, tokenHash, invitedByUserId, now + INVITE_TTL_MS, now),
  ]);
  return { inviteId: id, cleartext };
}

export async function revokeInvite(env: Env, tenantId: string, inviteId: string): Promise<boolean> {
  const res = await env.db.prepare(
    `UPDATE invites SET revoked_at = ?
      WHERE id = ? AND tenant_id = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
  )
    .bind(Date.now(), inviteId, tenantId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Consume an invite: attach the email's user to the tenant (creating the user
 * if new), then return ids to mint a session. New users must supply name +
 * password. Returns null on invalid / expired / already-consumed tokens.
 */
export async function acceptInvite(
  env: Env,
  cleartext: string,
  newUser: { name?: string; password?: string },
): Promise<{ tenantId: string; userId: string } | null> {
  const tokenHash = await sha256Hex(cleartext);
  const invite = await env.db.prepare(
    `SELECT id, tenant_id, email, role, expires_at, accepted_at, revoked_at
       FROM invites WHERE token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{
      id: string;
      tenant_id: string;
      email: string;
      role: string;
      expires_at: number;
      accepted_at: number | null;
      revoked_at: number | null;
    }>();
  if (!invite || invite.accepted_at || invite.revoked_at || invite.expires_at < Date.now()) {
    return null;
  }

  const now = Date.now();
  const existing = await env.db.prepare('SELECT id FROM users WHERE email = ?')
    .bind(invite.email)
    .first<{ id: string }>();

  if (existing) {
    // Attach a membership if they don't already have one; then accept.
    const hasMembership = await env.db.prepare(
      'SELECT 1 AS ok FROM memberships WHERE tenant_id = ? AND user_id = ?',
    )
      .bind(invite.tenant_id, existing.id)
      .first<{ ok: number }>();
    const stmts: DbStatement[] = [];
    if (!hasMembership) {
      stmts.push(
        env.db.prepare(
          'INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
        ).bind(newId('m'), invite.tenant_id, existing.id, invite.role, now),
      );
    }
    stmts.push(
      env.db.prepare('UPDATE invites SET accepted_at = ?, accepted_user_id = ? WHERE id = ?').bind(
        now,
        existing.id,
        invite.id,
      ),
    );
    await env.db.batch(stmts);
    return { tenantId: invite.tenant_id, userId: existing.id };
  }

  // Brand-new user: must set a password (and name).
  if (!newUser.password) throw new HttpError(400, 'A password is required to accept this invite');
  const userId = newId('u');
  const name = newUser.name?.trim() || invite.email.split('@')[0]!;
  const handle = await uniqueHandle(env, invite.tenant_id, deriveHandle(name));
  const passwordHash = await hashPassword(newUser.password);
  await env.db.batch([
    env.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, email, password_hash, password_algo, email_verified_at, created_at)
       VALUES (?, ?, ?, 'human', NULL, NULL, ?, ?, ?, ?, ?, ?)`,
    ).bind(userId, invite.tenant_id, name, handle, invite.email, passwordHash, PASSWORD_ALGO, now, now),
    env.db.prepare(
      'INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(newId('m'), invite.tenant_id, userId, invite.role, now),
    env.db.prepare('UPDATE invites SET accepted_at = ?, accepted_user_id = ? WHERE id = ?').bind(
      now,
      userId,
      invite.id,
    ),
  ]);
  return { tenantId: invite.tenant_id, userId };
}

// ── Roles & removal ───────────────────────────────────────────

async function adminCount(env: Env, tenantId: string): Promise<number> {
  const r = await env.db.prepare(
    "SELECT COUNT(*) AS n FROM memberships WHERE tenant_id = ? AND role = 'admin'",
  )
    .bind(tenantId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

async function memberRole(
  env: Env,
  tenantId: string,
  userId: string,
): Promise<MembershipRole | null> {
  const r = await env.db.prepare('SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?')
    .bind(tenantId, userId)
    .first<{ role: string }>();
  return (r?.role as MembershipRole) ?? null;
}

export async function setMemberRole(
  env: Env,
  tenantId: string,
  userId: string,
  role: MembershipRole,
): Promise<void> {
  const current = await memberRole(env, tenantId, userId);
  if (!current) throw new HttpError(404, 'Member not found');
  // The tenant owner sits above every admin (KBR-114) — no caller may demote
  // them. Ownership transfer is an intentional omit.
  if (role !== 'admin' && userId === (await tenantOwnerId(env, tenantId))) {
    throw new HttpError(409, "The workspace owner's role can't be changed");
  }
  if (current === 'admin' && role !== 'admin' && (await adminCount(env, tenantId)) <= 1) {
    throw new HttpError(409, "You can't demote the last admin");
  }
  await env.db.prepare('UPDATE memberships SET role = ? WHERE tenant_id = ? AND user_id = ?')
    .bind(role, tenantId, userId)
    .run();
}

export async function removeMember(env: Env, tenantId: string, userId: string): Promise<void> {
  const current = await memberRole(env, tenantId, userId);
  if (!current) throw new HttpError(404, 'Member not found');
  if (userId === (await tenantOwnerId(env, tenantId))) {
    throw new HttpError(409, "The workspace owner can't be removed");
  }
  if (current === 'admin' && (await adminCount(env, tenantId)) <= 1) {
    throw new HttpError(409, "You can't remove the last admin");
  }
  await env.db.batch([
    env.db.prepare('DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId),
    env.db.prepare('DELETE FROM project_access WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId),
  ]);
}
