import type { Env } from '../../env';
import type { UserDto, UserKind, Role } from '@kbrelay/shared';
import { colorForUser } from '@kbrelay/shared';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
}

interface UserRow {
  id: string;
  name: string;
  kind: string;
  role: string | null;
  color: string | null;
  handle: string | null;
}

export async function getTenant(env: Env, tenantId: string): Promise<TenantRow | null> {
  return env.db.prepare('SELECT id, name, slug FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first<TenantRow>();
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
    ? `SELECT u.id, u.name, u.kind, u.role, u.color, u.handle
         FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
        WHERE m.role = 'admin'
           OR EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = ? AND pa.user_id = u.id)
        ORDER BY u.name ASC`
    : `SELECT u.id, u.name, u.kind, u.role, u.color, u.handle
         FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.tenant_id = ?
        ORDER BY u.name ASC`;
  const rs = await env.db.prepare(sql)
    .bind(...(projectId ? [tenantId, projectId] : [tenantId]))
    .all<UserRow>();
  return (rs.results ?? []).map(toUserDto);
}

/** Set a user's color. Returns the effective (resolved) color. */
export async function updateUserColor(
  env: Env,
  tenantId: string,
  userId: string,
  color: string,
): Promise<void> {
  await env.db.prepare('UPDATE users SET color = ? WHERE id = ? AND tenant_id = ?')
    .bind(color, userId, tenantId)
    .run();
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
