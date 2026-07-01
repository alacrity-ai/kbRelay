import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { AgentSummary } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { deriveHandle, uniqueHandle } from './auth';
import { grantProjectAccessStmt } from './team';

/**
 * Agent-user management (v0.14.0, KBR-3). Admins create/manage agent users:
 * real users with kind='agent' and an OWNER (the managing human), each with a
 * membership + binary project_access + its own API keys. Token minting itself
 * reuses the (tenant,user)-scoped fns in repos/auth.ts with the agent's id.
 *
 * "Agent user in this tenant" = kind='agent' AND has a membership here. That's
 * the invariant `assertAgentInTenant` guards for every mutation/token op.
 */

interface AgentRow {
  id: string;
  name: string;
  handle: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  created_at: number;
}

/** List the tenant's agent users with owner, project access, and key count. */
export async function listAgents(env: Env, tenantId: string): Promise<AgentSummary[]> {
  const rs = await env.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.handle AS handle,
            u.owner_user_id AS owner_user_id, o.name AS owner_name, u.created_at AS created_at
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
       LEFT JOIN users o ON o.id = u.owner_user_id
      WHERE u.kind = 'agent'
      ORDER BY u.name ASC`,
  )
    .bind(tenantId)
    .all<AgentRow>();
  const rows = rs.results ?? [];
  if (rows.length === 0) return [];

  const accessRs = await env.db.prepare(
    'SELECT project_id, user_id FROM project_access WHERE tenant_id = ?',
  )
    .bind(tenantId)
    .all<{ project_id: string; user_id: string }>();
  const projectsByUser = new Map<string, string[]>();
  for (const row of accessRs.results ?? []) {
    const list = projectsByUser.get(row.user_id) ?? [];
    list.push(row.project_id);
    projectsByUser.set(row.user_id, list);
  }

  const tokRs = await env.db.prepare(
    `SELECT user_id, COUNT(*) AS n FROM api_tokens
      WHERE tenant_id = ? AND revoked_at IS NULL GROUP BY user_id`,
  )
    .bind(tenantId)
    .all<{ user_id: string; n: number }>();
  const tokensByUser = new Map<string, number>();
  for (const row of tokRs.results ?? []) tokensByUser.set(row.user_id, row.n);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    handle: r.handle,
    ownerUserId: r.owner_user_id,
    ownerName: r.owner_name,
    projectIds: projectsByUser.get(r.id) ?? [],
    tokenCount: tokensByUser.get(r.id) ?? 0,
    createdAt: r.created_at,
  }));
}

/** Throw 404 unless `userId` is an agent user with a membership in this tenant. */
export async function assertAgentInTenant(
  env: Env,
  tenantId: string,
  userId: string,
): Promise<void> {
  const row = await env.db.prepare(
    `SELECT 1 AS ok
       FROM users u JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
      WHERE u.id = ? AND u.kind = 'agent'`,
  )
    .bind(tenantId, userId)
    .first<{ ok: number }>();
  if (!row) throw new HttpError(404, 'Agent not found');
}

/**
 * Create an agent user: the user row (kind=agent, owner=creator, handle),
 * its membership (role member), and access grants for `projectIds` — atomic.
 */
export async function createAgent(
  env: Env,
  tenantId: string,
  ownerUserId: string,
  name: string,
  projectIds: string[] = [],
): Promise<AgentSummary> {
  const trimmed = name.trim();
  const userId = newId('u');
  const now = Date.now();
  const handle = await uniqueHandle(env, tenantId, deriveHandle(trimmed));

  // Keep only real projects in this tenant.
  let validProjects: string[] = [];
  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(', ');
    const rs = await env.db.prepare(
      `SELECT id FROM projects WHERE tenant_id = ? AND id IN (${placeholders})`,
    )
      .bind(tenantId, ...projectIds)
      .all<{ id: string }>();
    validProjects = (rs.results ?? []).map((r) => r.id);
  }

  const stmts: DbStatement[] = [
    env.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, owner_user_id, created_at)
       VALUES (?, ?, ?, 'agent', NULL, NULL, ?, ?, ?)`,
    ).bind(userId, tenantId, trimmed, handle, ownerUserId, now),
    env.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'member', ?)`,
    ).bind(newId('m'), tenantId, userId, now),
    ...validProjects.map((pid) => grantProjectAccessStmt(env, tenantId, pid, userId)),
  ];
  await env.db.batch(stmts);

  return {
    id: userId,
    name: trimmed,
    handle,
    ownerUserId,
    ownerName: null,
    projectIds: validProjects,
    tokenCount: 0,
    createdAt: now,
  };
}

/** Rename an agent and/or reassign its owner. Owner must be a member of the tenant. */
export async function patchAgent(
  env: Env,
  tenantId: string,
  userId: string,
  input: { name?: string; ownerUserId?: string },
): Promise<void> {
  await assertAgentInTenant(env, tenantId, userId);

  if (input.ownerUserId !== undefined) {
    const owner = await env.db.prepare(
      'SELECT 1 AS ok FROM memberships WHERE tenant_id = ? AND user_id = ?',
    )
      .bind(tenantId, input.ownerUserId)
      .first<{ ok: number }>();
    if (!owner) throw new HttpError(400, 'Owner must be a member of this workspace');
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (input.name !== undefined) { sets.push('name = ?'); binds.push(input.name.trim()); }
  if (input.ownerUserId !== undefined) { sets.push('owner_user_id = ?'); binds.push(input.ownerUserId); }
  if (sets.length === 0) return;

  await env.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...binds, userId, tenantId)
    .run();
}

/**
 * Deactivate an agent: revoke all its tokens, drop its membership + project
 * access. The users row is KEPT so authored-card provenance and old @-mentions
 * still resolve (mirrors human removeMember). Hard delete is intentional-omit.
 */
export async function removeAgent(env: Env, tenantId: string, userId: string): Promise<void> {
  await assertAgentInTenant(env, tenantId, userId);
  const now = Date.now();
  await env.db.batch([
    env.db.prepare(
      'UPDATE api_tokens SET revoked_at = ? WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL',
    ).bind(now, tenantId, userId),
    env.db.prepare('DELETE FROM project_access WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId),
    env.db.prepare('DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId),
  ]);
}
