import type { Env } from '../../env';
import type { UserDto, UserKind, Role } from '@kbrelay/shared';
import { colorForUser } from '@kbrelay/shared';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string | null;
}

interface UserRow {
  id: string;
  name: string;
  kind: string;
  role: string | null;
  color: string | null;
  handle: string | null;
  profile: string | null;
}

export async function getTenant(env: Env, tenantId: string): Promise<TenantRow | null> {
  return env.db.prepare('SELECT id, name, slug, owner_user_id FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first<TenantRow>();
}

/** The tenant owner's user id (KBR-114). Null only for pre-0025 tenants that
 *  had no human admin to backfill from. */
export async function tenantOwnerId(env: Env, tenantId: string): Promise<string | null> {
  const row = await env.db.prepare('SELECT owner_user_id FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first<{ owner_user_id: string | null }>();
  return row?.owner_user_id ?? null;
}

/**
 * Users in a tenant — for assignee pickers and the /users route. Returns only
 * CURRENT members (a removed user keeps its row for provenance but loses its
 * membership, so it must not appear in pickers). With `projectId`, further
 * scopes to users who can access that project (admins + `project_access`) — the
 * same rule the mention reconciler uses, so the @-autocomplete matches who a
 * mention would actually notify.
 */
export async function listUsers(
  env: Env,
  tenantId: string,
  projectId?: string,
): Promise<UserDto[]> {
  const sql = projectId
    ? `SELECT u.id, u.name, u.kind, u.role, u.color, u.handle, u.profile
         FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
        WHERE m.role = 'admin'
           OR EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = ? AND pa.user_id = u.id)
        ORDER BY u.name ASC`
    : `SELECT u.id, u.name, u.kind, u.role, u.color, u.handle, u.profile
         FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
        ORDER BY u.name ASC`;
  const rs = await env.db.prepare(sql)
    .bind(...(projectId ? [tenantId, projectId] : [tenantId]))
    .all<UserRow>();
  return (rs.results ?? []).map(toUserDto);
}

/** Update the caller's own settings — only the fields provided (color / profile). */
export async function updateMe(
  env: Env,
  tenantId: string,
  userId: string,
  input: { color?: string; profile?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (input.color !== undefined) { sets.push('color = ?'); binds.push(input.color); }
  if (input.profile !== undefined) { sets.push('profile = ?'); binds.push(input.profile); }
  if (!sets.length) return;
  binds.push(userId, tenantId);
  await env.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...binds)
    .run();
}

/** The caller's profile text (for /me, which builds its response from the auth ctx + this). */
export async function getUserProfile(env: Env, tenantId: string, userId: string): Promise<string | null> {
  const r = await env.db.prepare('SELECT profile FROM users WHERE id = ? AND tenant_id = ?')
    .bind(userId, tenantId)
    .first<{ profile: string | null }>();
  return r?.profile ?? null;
}

/** Verify a user id belongs to the tenant (used to validate assignees). */
export async function userExistsInTenant(
  env: Env,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const row = await env.db.prepare('SELECT 1 AS ok FROM users WHERE id = ? AND tenant_id = ?')
    .bind(userId, tenantId)
    .first<{ ok: number }>();
  return Boolean(row);
}

export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as UserKind,
    role: (row.role as Role | null) ?? null,
    color: row.color ?? colorForUser(row.id),
    handle: row.handle ?? null,
    profile: row.profile ?? null,
  };
}

/**
 * (id, handle) for every user who can access `projectId` — the lookup the
 * mention reconcilers need. RBAC (v0.11.0): a mention only resolves to a user
 * with access (admins bypass), so mentioning a no-access user is a no-op (the
 * handle is treated as unknown and dropped).
 */
export async function mentionableUsers(
  env: Env,
  tenantId: string,
  projectId: string,
): Promise<Array<{ id: string; handle: string | null; kind: string }>> {
  const rs = await env.db.prepare(
    `SELECT u.id AS id, u.handle AS handle, u.kind AS kind
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
      WHERE m.role = 'admin'
         OR EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = ? AND pa.user_id = u.id)`,
  )
    .bind(tenantId, projectId)
    .all<{ id: string; handle: string | null; kind: string }>();
  return rs.results ?? [];
}
