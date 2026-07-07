import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { AgentSummary, AuthContext, MembershipRole } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { deriveHandle, uniqueHandle } from './auth';
import { grantProjectAccessStmt, setMemberRole } from './team';
import { tenantOwnerId } from './users';

/**
 * Agent-user management (v0.14.0, KBR-3; ownership model KBR-115). Agents are
 * real users with kind='agent' and an OWNER (the managing human), each with a
 * membership + binary project_access + its own API keys. Token minting itself
 * reuses the (tenant,user)-scoped fns in repos/auth.ts with the agent's id.
 *
 * Every read/mutation here is scoped to an ACTOR (KBR-115):
 *   member       → only agents they own
 *   admin        → own + member-owned + ownerless/orphaned agents
 *   tenant owner → every agent
 * Admins never see another admin's agents; out-of-scope targets 404 (the same
 * no-leak convention as project access). On top of the scope sits a hard cap:
 * an agent's membership role never exceeds its owner's (a member holds their
 * agent's key, so an admin-role member-agent would be privilege escalation).
 *
 * "Agent user in this tenant" = kind='agent' AND has a membership here. That's
 * the invariant `assertAgentInTenant` guards for every mutation/token op.
 */

/** Who is acting on agents, resolved once per request. */
export interface AgentActor {
  userId: string;
  isAdmin: boolean;
  /** The tenant owner (KBR-114) — sees and manages every agent. */
  isOwner: boolean;
}

export async function resolveAgentActor(env: Env, auth: AuthContext): Promise<AgentActor> {
  const ownerId = await tenantOwnerId(env, auth.tenantId);
  return {
    userId: auth.userId,
    isAdmin: auth.role === 'admin',
    isOwner: ownerId !== null && ownerId === auth.userId,
  };
}

interface AgentRow {
  id: string;
  name: string;
  handle: string | null;
  color: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  role: string;
  owner_role: string | null;
  created_at: number;
}

/** WHERE fragment implementing the visibility table above. Binds: none for the
 *  owner, [actorId] otherwise. */
function scopeSql(actor: AgentActor): { sql: string; binds: string[] } {
  if (actor.isOwner) return { sql: '', binds: [] };
  if (actor.isAdmin) {
    // Own, ownerless, orphaned (owner lost their membership), or member-owned.
    return {
      sql: ` AND (u.owner_user_id = ? OR u.owner_user_id IS NULL OR om.role IS NULL OR om.role = 'member')`,
      binds: [actor.userId],
    };
  }
  return { sql: ' AND u.owner_user_id = ?', binds: [actor.userId] };
}

function capFor(ownerRole: string | null): MembershipRole {
  return ownerRole === 'admin' ? 'admin' : 'member';
}

/** List the actor-visible agent users with owner, role/cap, project access,
 *  and key count. */
export async function listAgents(env: Env, tenantId: string, actor: AgentActor): Promise<AgentSummary[]> {
  const scope = scopeSql(actor);
  const rs = await env.db.prepare(
    `SELECT u.id AS id, u.name AS name, u.handle AS handle, u.color AS color,
            u.owner_user_id AS owner_user_id, o.name AS owner_name,
            m.role AS role, om.role AS owner_role, u.created_at AS created_at
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
       LEFT JOIN users o ON o.id = u.owner_user_id
       LEFT JOIN memberships om ON om.user_id = u.owner_user_id AND om.tenant_id = ?
      WHERE u.kind = 'agent'${scope.sql}
      ORDER BY u.name ASC`,
  )
    .bind(tenantId, tenantId, ...scope.binds)
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
    color: r.color,
    ownerUserId: r.owner_user_id,
    ownerName: r.owner_name,
    projectIds: projectsByUser.get(r.id) ?? [],
    tokenCount: tokensByUser.get(r.id) ?? 0,
    role: r.role as AgentSummary['role'],
    ownerRole: (r.owner_role as MembershipRole | null) ?? null,
    roleCap: capFor(r.owner_role),
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

interface AgentControl {
  role: MembershipRole;
  ownerUserId: string | null;
  ownerRole: MembershipRole | null;
  roleCap: MembershipRole;
}

/**
 * The scope gate for every agent mutation (KBR-115): throw 404 unless
 * `agentId` is an agent in this tenant AND inside the actor's visibility —
 * out-of-scope reads identically to nonexistent, so nothing leaks.
 */
export async function assertAgentControl(
  env: Env,
  tenantId: string,
  actor: AgentActor,
  agentId: string,
): Promise<AgentControl> {
  const scope = scopeSql(actor);
  const row = await env.db.prepare(
    `SELECT m.role AS role, u.owner_user_id AS owner_user_id, om.role AS owner_role
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
       LEFT JOIN memberships om ON om.user_id = u.owner_user_id AND om.tenant_id = ?
      WHERE u.kind = 'agent' AND u.id = ?${scope.sql}`,
  )
    .bind(tenantId, tenantId, agentId, ...scope.binds)
    .first<{ role: string; owner_user_id: string | null; owner_role: string | null }>();
  if (!row) throw new HttpError(404, 'Agent not found');
  return {
    role: row.role as MembershipRole,
    ownerUserId: row.owner_user_id,
    ownerRole: (row.owner_role as MembershipRole | null) ?? null,
    roleCap: capFor(row.owner_role),
  };
}

/** Project ids the actor can see: everything for admins, their own
 *  project_access set otherwise. */
async function visibleProjectIds(env: Env, tenantId: string, actor: AgentActor): Promise<string[] | 'all'> {
  if (actor.isAdmin) return 'all';
  const rs = await env.db.prepare(
    'SELECT project_id FROM project_access WHERE tenant_id = ? AND user_id = ?',
  )
    .bind(tenantId, actor.userId)
    .all<{ project_id: string }>();
  return (rs.results ?? []).map((r) => r.project_id);
}

/** Keep only ids that are real projects in this tenant (chunked for the D1
 *  100-bind cap). */
async function validProjectIds(env: Env, tenantId: string, projectIds: string[]): Promise<string[]> {
  const valid: string[] = [];
  for (let i = 0; i < projectIds.length; i += 80) {
    const chunk = projectIds.slice(i, i + 80);
    const placeholders = chunk.map(() => '?').join(', ');
    const rs = await env.db.prepare(
      `SELECT id FROM projects WHERE tenant_id = ? AND id IN (${placeholders})`,
    )
      .bind(tenantId, ...chunk)
      .all<{ id: string }>();
    valid.push(...(rs.results ?? []).map((r) => r.id));
  }
  return valid;
}

/**
 * Create an agent user: the user row (kind=agent, owner=creator, handle),
 * its membership (role member), and access grants for `projectIds` — atomic.
 * Open to every tenant user (KBR-115); the grant set is intersected with the
 * projects the CREATOR can see.
 */
export async function createAgent(
  env: Env,
  tenantId: string,
  creator: AgentActor,
  name: string,
  projectIds: string[] = [],
): Promise<AgentSummary> {
  const trimmed = name.trim();
  const userId = newId('u');
  const now = Date.now();
  const handle = await uniqueHandle(env, tenantId, deriveHandle(trimmed));

  let grants: string[] = [];
  if (projectIds.length > 0) {
    const visible = await visibleProjectIds(env, tenantId, creator);
    const requested = visible === 'all' ? projectIds : projectIds.filter((id) => visible.includes(id));
    grants = await validProjectIds(env, tenantId, requested);
  }

  const stmts: DbStatement[] = [
    env.db.prepare(
      `INSERT INTO users (id, tenant_id, name, kind, role, color, handle, owner_user_id, created_at)
       VALUES (?, ?, ?, 'agent', NULL, NULL, ?, ?, ?)`,
    ).bind(userId, tenantId, trimmed, handle, creator.userId, now),
    env.db.prepare(
      `INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'member', ?)`,
    ).bind(newId('m'), tenantId, userId, now),
    ...grants.map((pid) => grantProjectAccessStmt(env, tenantId, pid, userId)),
  ];
  await env.db.batch(stmts);

  const ownerRole: MembershipRole = creator.isAdmin ? 'admin' : 'member';
  return {
    id: userId,
    name: trimmed,
    handle,
    color: null,
    ownerUserId: creator.userId,
    ownerName: null,
    projectIds: grants,
    tokenCount: 0,
    role: 'member', // admin is an explicit promotion (KBR-113), capped by the owner (KBR-115)
    ownerRole,
    roleCap: ownerRole,
    createdAt: now,
  };
}

/**
 * Rename an agent, reassign its owner (admin+), recolor it (KBR-74), and/or
 * set its workspace role (KBR-115). Scope-gated via assertAgentControl; role
 * changes go through setMemberRole so the last-admin guard still applies, and
 * are capped at the owner's role. Owner must be a member of the tenant, and a
 * transfer may not leave the agent outranking its new owner.
 */
export async function patchAgent(
  env: Env,
  tenantId: string,
  actor: AgentActor,
  userId: string,
  input: { name?: string; ownerUserId?: string; color?: string; role?: MembershipRole },
): Promise<void> {
  const agent = await assertAgentControl(env, tenantId, actor, userId);

  let newOwnerRole: MembershipRole | null = null;
  if (input.ownerUserId !== undefined) {
    if (!actor.isAdmin) {
      throw new HttpError(403, "Only admins can reassign an agent's owner");
    }
    const owner = await env.db.prepare(
      'SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?',
    )
      .bind(tenantId, input.ownerUserId)
      .first<{ role: string }>();
    if (!owner) throw new HttpError(400, 'Owner must be a member of this workspace');
    newOwnerRole = owner.role as MembershipRole;
  }

  // The role the agent will end up with, checked against the cap of the owner
  // it will end up with — so a combined {role, ownerUserId} patch is coherent.
  const effectiveRole = input.role ?? agent.role;
  const effectiveCap = capFor(newOwnerRole ?? agent.ownerRole);
  if (effectiveRole === 'admin' && effectiveCap !== 'admin') {
    throw new HttpError(403, "An agent can't outrank its owner");
  }

  if (input.role !== undefined && input.role !== agent.role) {
    await setMemberRole(env, tenantId, userId, input.role);
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (input.name !== undefined) { sets.push('name = ?'); binds.push(input.name.trim()); }
  if (input.ownerUserId !== undefined) { sets.push('owner_user_id = ?'); binds.push(input.ownerUserId); }
  if (input.color !== undefined) { sets.push('color = ?'); binds.push(input.color); }
  if (sets.length === 0) return;

  await env.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...binds, userId, tenantId)
    .run();
}

/**
 * Replace the actor-VISIBLE slice of an agent's project access (KBR-115).
 * Admins replace the whole set; a member's save only grants/revokes within
 * the projects they can see, so an admin-granted project outside the member's
 * view survives their save untouched.
 */
export async function replaceAgentProjectAccess(
  env: Env,
  tenantId: string,
  actor: AgentActor,
  agentId: string,
  projectIds: string[],
): Promise<void> {
  await assertAgentControl(env, tenantId, actor, agentId);
  const visible = await visibleProjectIds(env, tenantId, actor);
  const requested = visible === 'all' ? projectIds : projectIds.filter((id) => visible.includes(id));
  const grants = await validProjectIds(env, tenantId, requested);

  const now = Date.now();
  const stmts: DbStatement[] = [];
  if (visible === 'all') {
    stmts.push(
      env.db.prepare('DELETE FROM project_access WHERE tenant_id = ? AND user_id = ?').bind(tenantId, agentId),
    );
  } else {
    // Revoke only within the actor's visible set (chunked for the D1 bind cap).
    for (let i = 0; i < visible.length; i += 80) {
      const chunk = visible.slice(i, i + 80);
      const placeholders = chunk.map(() => '?').join(', ');
      stmts.push(
        env.db.prepare(
          `DELETE FROM project_access WHERE tenant_id = ? AND user_id = ? AND project_id IN (${placeholders})`,
        ).bind(tenantId, agentId, ...chunk),
      );
    }
  }
  stmts.push(
    ...grants.map((pid) =>
      env.db.prepare(
        `INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
         VALUES (?, ?, ?, ?)`,
      ).bind(tenantId, pid, agentId, now),
    ),
  );
  await env.db.batch(stmts);
}

/**
 * Deactivate an agent: revoke all its tokens, drop its membership + project
 * access. The users row is KEPT so authored-card provenance and old @-mentions
 * still resolve (mirrors human removeMember). Hard delete is intentional-omit.
 */
export async function removeAgent(
  env: Env,
  tenantId: string,
  actor: AgentActor,
  userId: string,
): Promise<void> {
  await assertAgentControl(env, tenantId, actor, userId);
  const now = Date.now();
  await env.db.batch([
    env.db.prepare(
      'UPDATE api_tokens SET revoked_at = ? WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL',
    ).bind(now, tenantId, userId),
    env.db.prepare('DELETE FROM project_access WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId),
    env.db.prepare('DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId),
  ]);
}
