import type { Env } from '../../env';
import type { ProjectDto, ProjectStatus, CreateProjectInput, PatchProjectInput } from '@kbrelay/shared';
import { DEFAULT_COLUMNS } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { RANK_STEP } from '../../rank';
import { grantProjectAccessStmt } from './team';
import { deleteMentionsForProjectStmt } from './mentions';
import { blobKeysForProject, deleteAttachmentsForProjectStmt } from './attachments';

interface ProjectRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  card_seq: number;
  description: string | null;
  color: string | null;
  status: string;
  agent_events_enabled: number;
  auto_archive_done_days: number | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  /** Only selected by listProjects (for the browser's badges). */
  card_count?: number;
}

function toDto(r: ProjectRow): ProjectDto {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    color: r.color,
    status: r.status as ProjectStatus,
    agentEventsEnabled: r.agent_events_enabled !== 0,
    autoArchiveDoneDays: r.auto_archive_done_days,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.card_count === undefined ? {} : { cardCount: r.card_count }),
  };
}

/** Ensure a code is free within the tenant (case-insensitive; codes are stored uppercased). */
async function assertCodeFree(env: Env, tenantId: string, code: string, exceptId?: string): Promise<void> {
  const row = await env.db.prepare(
    `SELECT 1 AS x FROM projects WHERE tenant_id = ? AND code = ?${exceptId ? ' AND id != ?' : ''}`,
  )
    .bind(...(exceptId ? [tenantId, code, exceptId] : [tenantId, code]))
    .first<{ x: number }>();
  if (row) throw new HttpError(409, `Project code "${code}" is already in use`);
}

/** The project's code (for building ticket keys), or null. */
export async function projectCode(env: Env, tenantId: string, projectId: string): Promise<string | null> {
  const row = await env.db.prepare('SELECT code FROM projects WHERE id = ? AND tenant_id = ?')
    .bind(projectId, tenantId)
    .first<{ code: string | null }>();
  return row?.code ?? null;
}

/** Atomically bump and return the project's next card sequence number. */
export async function nextCardSeq(env: Env, tenantId: string, projectId: string): Promise<number> {
  const row = await env.db.prepare(
    'UPDATE projects SET card_seq = card_seq + 1 WHERE id = ? AND tenant_id = ? RETURNING card_seq',
  )
    .bind(projectId, tenantId)
    .first<{ card_seq: number }>();
  if (!row) throw new HttpError(404, 'Project not found');
  return row.card_seq;
}

/**
 * List a tenant's projects. With RBAC (v0.11.0): an admin sees all; a member
 * sees only projects they have a `project_access` row for. Pass `access` to
 * scope to a member; omit (or admin) for the full set.
 */
export async function listProjects(
  env: Env,
  tenantId: string,
  status?: ProjectStatus,
  access?: { userId: string; isAdmin: boolean },
): Promise<ProjectDto[]> {
  const memberScoped = access && !access.isAdmin;
  // Correlated subquery gives each project its total card count for the browser's
  // badges — cheap at tenant scale, and keeps single-project fetches untouched.
  const countCol = ', (SELECT COUNT(*) FROM cards c WHERE c.project_id = p.id) AS card_count';
  let sql: string;
  let binds: unknown[];
  if (memberScoped) {
    sql =
      `SELECT p.*${countCol} FROM projects p
         JOIN project_access pa ON pa.project_id = p.id AND pa.user_id = ?
        WHERE p.tenant_id = ?${status ? ' AND p.status = ?' : ''}
        ORDER BY p.created_at DESC`;
    binds = status ? [access!.userId, tenantId, status] : [access!.userId, tenantId];
  } else {
    sql =
      `SELECT p.*${countCol} FROM projects p WHERE p.tenant_id = ?${status ? ' AND p.status = ?' : ''} ORDER BY p.created_at DESC`;
    binds = status ? [tenantId, status] : [tenantId];
  }
  const rs = await env.db.prepare(sql)
    .bind(...binds)
    .all<ProjectRow>();
  return (rs.results ?? []).map(toDto);
}

export async function getProject(
  env: Env,
  tenantId: string,
  id: string,
): Promise<ProjectDto | null> {
  const row = await env.db.prepare('SELECT * FROM projects WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<ProjectRow>();
  return row ? toDto(row) : null;
}

/** Create a project and seed the default columns atomically. */
export async function createProject(
  env: Env,
  tenantId: string,
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  const id = newId('prj');
  const now = Date.now();
  await assertCodeFree(env, tenantId, input.code);

  const stmts = [
    env.db.prepare(
      `INSERT INTO projects (id, tenant_id, name, code, description, color, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).bind(id, tenantId, input.name, input.code, input.description ?? null, input.color ?? null, userId, now, now),
    ...DEFAULT_COLUMNS.map((c, i) =>
      env.db.prepare(
        `INSERT INTO columns (id, tenant_id, project_id, name, color, position, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(newId('col'), tenantId, id, c.name, c.color, RANK_STEP * (i + 1), c.role, now),
    ),
    // RBAC: the creator is auto-granted access to their new project (admins
    // bypass, but the grant is harmless and keeps the row set consistent).
    grantProjectAccessStmt(env, tenantId, id, userId),
  ];
  await env.db.batch(stmts);

  const created = await getProject(env, tenantId, id);
  if (!created) throw new HttpError(500, 'Project insert did not return row');
  return created;
}

export async function patchProject(
  env: Env,
  tenantId: string,
  id: string,
  input: PatchProjectInput,
): Promise<ProjectDto> {
  const existing = await getProject(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Project not found');

  if (input.code !== undefined && input.code !== existing.code) {
    await assertCodeFree(env, tenantId, input.code, id);
  }
  const next = {
    name: input.name ?? existing.name,
    code: input.code === undefined ? existing.code : input.code,
    description: input.description === undefined ? existing.description : input.description,
    color: input.color === undefined ? existing.color : input.color,
    status: input.status ?? existing.status,
    agentEventsEnabled:
      input.agentEventsEnabled === undefined ? existing.agentEventsEnabled : input.agentEventsEnabled,
    autoArchiveDoneDays:
      input.autoArchiveDoneDays === undefined ? existing.autoArchiveDoneDays : input.autoArchiveDoneDays,
  };
  await env.db.prepare(
    `UPDATE projects SET name = ?, code = ?, description = ?, color = ?, status = ?, agent_events_enabled = ?, auto_archive_done_days = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`,
  )
    .bind(next.name, next.code, next.description, next.color, next.status, next.agentEventsEnabled ? 1 : 0, next.autoArchiveDoneDays, Date.now(), id, tenantId)
    .run();

  const updated = await getProject(env, tenantId, id);
  if (!updated) throw new HttpError(500, 'Project update did not return row');
  return updated;
}

/**
 * Delete a project and everything under it. We cascade explicitly rather
 * than trusting D1's FK enforcement (which is not reliably on).
 *
 * Returns the attachment blob keys for the whole board so the caller can purge
 * the bytes OFF the response path via `ctx.waitUntil` (KBR-43). The child-table
 * deletes that reference the project's cards by subquery (card_events, mentions,
 * attachments) MUST run before `DELETE FROM cards`, so they come first.
 */
export async function deleteProject(env: Env, tenantId: string, id: string): Promise<string[]> {
  const existing = await getProject(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Project not found');
  // Gather blob keys before the rows are deleted.
  const blobKeys = await blobKeysForProject(env, tenantId, id);
  await env.db.batch([
    env.db.prepare(
      `DELETE FROM card_events WHERE tenant_id = ?
         AND card_id IN (SELECT id FROM cards WHERE project_id = ? AND tenant_id = ?)`,
    ).bind(tenantId, id, tenantId),
    // Mentions + attachment rows for the project's cards — previously orphaned
    // by project deletion (KBR-43). Both reference cards by subquery, so before cards.
    deleteMentionsForProjectStmt(env, tenantId, id),
    deleteAttachmentsForProjectStmt(env, tenantId, id),
    env.db.prepare('DELETE FROM cards WHERE project_id = ? AND tenant_id = ?').bind(id, tenantId),
    env.db.prepare('DELETE FROM columns WHERE project_id = ? AND tenant_id = ?').bind(id, tenantId),
    env.db.prepare('DELETE FROM project_access WHERE project_id = ? AND tenant_id = ?').bind(id, tenantId),
    env.db.prepare('DELETE FROM projects WHERE id = ? AND tenant_id = ?').bind(id, tenantId),
  ]);
  return blobKeys;
}
