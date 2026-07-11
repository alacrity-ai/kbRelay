import type { Env } from '../env';
import type { AuthContext } from '@kbrelay/shared';
import { HttpError } from '../http';

/**
 * Project RBAC enforcement (v0.11.0). Binary access: an admin sees everything;
 * a member sees only projects with a `project_access` row. No-access resolves
 * to **404** (not 403) so we never leak that a project/card/column exists.
 *
 * The dispatcher calls `enforceProjectAccess` for every project-scoped route,
 * driven by the route's declarative `access` scope. A coverage test iterates
 * the router so a new project route that forgets to declare a scope fails CI.
 */

/** How to find the project id a route operates on, from its path params. */
export type AccessScope =
  | { kind: 'project'; param: string } // params[param] is the project id
  | { kind: 'card'; param: string } // params[param] is a card id → resolve project
  | { kind: 'column'; param: string } // params[param] is a column id → resolve project
  | { kind: 'label'; param: string } // params[param] is a label id → resolve project (KBR-62)
  | { kind: 'attachment'; param: string } // params[param] is an attachment id → card → project
  | { kind: 'cardLink'; param: string }; // params[param] is a card-link id → card → project

/** Resolve the owning project id for a scoped route, or null if it doesn't exist. */
export async function resolveProjectId(
  env: Env,
  tenantId: string,
  scope: AccessScope,
  params: Record<string, string>,
): Promise<string | null> {
  const id = params[scope.param];
  if (!id) return null;
  if (scope.kind === 'project') return id;
  // An attachment resolves to its card's project (attachment → card → project).
  if (scope.kind === 'attachment') {
    const row = await env.db.prepare(
      `SELECT c.project_id FROM attachments a JOIN cards c ON c.id = a.card_id
        WHERE a.id = ? AND a.tenant_id = ?`,
    )
      .bind(id, tenantId)
      .first<{ project_id: string }>();
    return row?.project_id ?? null;
  }
  // A card link resolves to its card's project (link → card → project).
  if (scope.kind === 'cardLink') {
    const row = await env.db.prepare(
      `SELECT c.project_id FROM card_links l JOIN cards c ON c.id = l.card_id
        WHERE l.id = ? AND l.tenant_id = ?`,
    )
      .bind(id, tenantId)
      .first<{ project_id: string }>();
    return row?.project_id ?? null;
  }
  const table = scope.kind === 'card' ? 'cards' : scope.kind === 'label' ? 'labels' : 'columns';
  const row = await env.db.prepare(`SELECT project_id FROM ${table} WHERE id = ? AND tenant_id = ?`)
    .bind(id, tenantId)
    .first<{ project_id: string }>();
  return row?.project_id ?? null;
}

/**
 * Human-ref normalization (KBR-128): card-scoped params accept ticket keys
 * (`KBR-12`) and project-scoped params accept project codes (`KBR`), resolved
 * to canonical ids IN-TENANT before the RBAC check, so handlers only ever see
 * ids and the no-access-is-404 invariant is untouched. The grammar is
 * unambiguous — real ids always carry a `prefix_`, keys/codes never contain
 * `_`. Unresolvable refs are left as-is and fall through to the existing 404.
 */
const TICKET_KEY_RE = /^([A-Za-z0-9]{2,6})-([1-9][0-9]*)$/;
const PROJECT_CODE_RE = /^[A-Za-z0-9]{2,6}$/;

export async function normalizeRefParams(
  env: Env,
  tenantId: string,
  scope: AccessScope,
  params: Record<string, string>,
): Promise<void> {
  const ref = params[scope.param];
  if (!ref || ref.includes('_')) return;
  if (scope.kind === 'card') {
    const m = TICKET_KEY_RE.exec(ref);
    if (!m) return;
    const row = await env.db.prepare(
      `SELECT c.id FROM cards c JOIN projects p ON p.id = c.project_id
        WHERE c.tenant_id = ? AND p.code = ? AND c.seq = ?`,
    )
      .bind(tenantId, m[1]!.toUpperCase(), Number(m[2]))
      .first<{ id: string }>();
    if (row) params[scope.param] = row.id;
  } else if (scope.kind === 'project') {
    if (!PROJECT_CODE_RE.test(ref)) return;
    const row = await env.db.prepare('SELECT id FROM projects WHERE tenant_id = ? AND code = ?')
      .bind(tenantId, ref.toUpperCase())
      .first<{ id: string }>();
    if (row) params[scope.param] = row.id;
  }
}

/** Does the CALLER have access to this project? Admin ⇒ any existing project. */
export async function callerHasProjectAccess(
  env: Env,
  auth: AuthContext,
  projectId: string,
): Promise<boolean> {
  if (auth.role === 'admin') {
    const p = await env.db.prepare('SELECT 1 AS ok FROM projects WHERE id = ? AND tenant_id = ?')
      .bind(projectId, auth.tenantId)
      .first<{ ok: number }>();
    return Boolean(p);
  }
  const row = await env.db.prepare(
    'SELECT 1 AS ok FROM project_access WHERE project_id = ? AND user_id = ? AND tenant_id = ?',
  )
    .bind(projectId, auth.userId, auth.tenantId)
    .first<{ ok: number }>();
  return Boolean(row);
}

/** Enforce caller access for a scoped route; throws 404 on missing OR no-access. */
export async function enforceProjectAccess(
  env: Env,
  auth: AuthContext,
  scope: AccessScope,
  params: Record<string, string>,
): Promise<void> {
  const projectId = await resolveProjectId(env, auth.tenantId, scope, params);
  if (!projectId) throw new HttpError(404, 'Not found');
  if (!(await callerHasProjectAccess(env, auth, projectId))) throw new HttpError(404, 'Not found');
}

/** Is an ARBITRARY tenant user an admin? (for assignee/mention access checks). */
async function userIsAdmin(env: Env, tenantId: string, userId: string): Promise<boolean> {
  const m = await env.db.prepare('SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?')
    .bind(tenantId, userId)
    .first<{ role: string }>();
  return m?.role === 'admin';
}

/** Can an arbitrary tenant user access this project? (admin ⇒ yes). */
export async function userHasProjectAccess(
  env: Env,
  tenantId: string,
  projectId: string,
  userId: string,
): Promise<boolean> {
  if (await userIsAdmin(env, tenantId, userId)) return true;
  const row = await env.db.prepare(
    'SELECT 1 AS ok FROM project_access WHERE project_id = ? AND user_id = ?',
  )
    .bind(projectId, userId)
    .first<{ ok: number }>();
  return Boolean(row);
}

/** Require the caller to be a tenant admin; throws 403 otherwise. */
export function requireAdmin(auth: AuthContext | null): AuthContext {
  if (!auth) throw new HttpError(401, 'Authentication required');
  if (auth.role !== 'admin') throw new HttpError(403, 'Admin access required');
  return auth;
}
