import type { Env } from '../../env';
import type { ColumnDto, ColumnRole, CreateColumnInput, PatchColumnInput } from '@kbrelay/shared';
import type { DbStatement } from '../../runtime/shared/db';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { RANK_STEP } from '../../rank';

interface ColumnRow {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  color: string | null;
  position: number;
  role: string | null;
  created_at: number;
}

function toDto(r: ColumnRow): ColumnDto {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    color: r.color,
    position: r.position,
    role: (r.role as ColumnRole | null) ?? null,
    createdAt: r.created_at,
  };
}

/**
 * A column's role is unique within its project. Setting a non-null role on one
 * column clears the same role off any sibling that holds it — so "make B the
 * Ready column" atomically moves the badge off A. Returns a statement to compose
 * into the same batch as the write (null role → no yank needed).
 */
function yankRoleStmt(
  env: Env,
  tenantId: string,
  projectId: string,
  role: ColumnRole | null | undefined,
  exceptId: string,
): DbStatement | null {
  if (!role) return null;
  return env.db
    .prepare(
      'UPDATE columns SET role = NULL WHERE tenant_id = ? AND project_id = ? AND role = ? AND id != ?',
    )
    .bind(tenantId, projectId, role, exceptId);
}

export async function listColumns(
  env: Env,
  tenantId: string,
  projectId: string,
): Promise<ColumnDto[]> {
  const rs = await env.db.prepare(
    'SELECT * FROM columns WHERE tenant_id = ? AND project_id = ? ORDER BY position ASC',
  )
    .bind(tenantId, projectId)
    .all<ColumnRow>();
  return (rs.results ?? []).map(toDto);
}

async function getColumnRow(env: Env, tenantId: string, id: string): Promise<ColumnRow | null> {
  return env.db.prepare('SELECT * FROM columns WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<ColumnRow>();
}

export async function createColumn(
  env: Env,
  tenantId: string,
  projectId: string,
  input: CreateColumnInput,
): Promise<ColumnDto> {
  // Append to the end unless the caller pins a position.
  let position = input.position;
  if (position === undefined) {
    const max = await env.db.prepare(
      'SELECT MAX(position) AS m FROM columns WHERE tenant_id = ? AND project_id = ?',
    )
      .bind(tenantId, projectId)
      .first<{ m: number | null }>();
    position = (max?.m ?? 0) + RANK_STEP;
  }
  const id = newId('col');
  const role = input.role ?? null;
  // Insert the column and, if it claims a role, yank that role off any sibling —
  // atomically, so a project never has two columns with the same role.
  const stmts: DbStatement[] = [
    env.db.prepare(
      `INSERT INTO columns (id, tenant_id, project_id, name, color, position, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, tenantId, projectId, input.name, input.color ?? null, position, role, Date.now()),
  ];
  const yank = yankRoleStmt(env, tenantId, projectId, role, id);
  if (yank) stmts.unshift(yank); // clear the old holder before inserting the new one
  await env.db.batch(stmts);
  const row = await getColumnRow(env, tenantId, id);
  if (!row) throw new HttpError(500, 'Column insert did not return row');
  return toDto(row);
}

export async function patchColumn(
  env: Env,
  tenantId: string,
  id: string,
  input: PatchColumnInput,
): Promise<ColumnDto> {
  const existing = await getColumnRow(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Column not found');
  const next = {
    name: input.name ?? existing.name,
    color: input.color === undefined ? existing.color : input.color,
    position: input.position ?? existing.position,
    // role: undefined = leave as-is; null = clear; a value = set (and yank).
    role: input.role === undefined ? ((existing.role as ColumnRole | null) ?? null) : input.role,
  };
  const stmts: DbStatement[] = [
    env.db.prepare(
      'UPDATE columns SET name = ?, color = ?, position = ?, role = ? WHERE id = ? AND tenant_id = ?',
    ).bind(next.name, next.color, next.position, next.role, id, tenantId),
  ];
  // Only yank when this patch is actually (re)claiming a role for this column.
  if (input.role) {
    const yank = yankRoleStmt(env, existing.tenant_id, existing.project_id, input.role, id);
    if (yank) stmts.unshift(yank);
  }
  await env.db.batch(stmts);
  const row = await getColumnRow(env, tenantId, id);
  if (!row) throw new HttpError(500, 'Column update did not return row');
  return toDto(row);
}

/** Delete a column. Refuses (409) if it still holds cards — move them first. */
export async function deleteColumn(env: Env, tenantId: string, id: string): Promise<void> {
  const existing = await getColumnRow(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Column not found');
  const count = await env.db.prepare(
    'SELECT COUNT(*) AS n FROM cards WHERE column_id = ? AND tenant_id = ?',
  )
    .bind(id, tenantId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) > 0) {
    throw new HttpError(409, 'Column is not empty — move or delete its cards first');
  }
  await env.db.prepare('DELETE FROM columns WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
}

/** Does this column belong to this tenant + project? (assignment guard) */
export async function columnInProject(
  env: Env,
  tenantId: string,
  projectId: string,
  columnId: string,
): Promise<boolean> {
  const row = await env.db.prepare(
    'SELECT 1 AS ok FROM columns WHERE id = ? AND tenant_id = ? AND project_id = ?',
  )
    .bind(columnId, tenantId, projectId)
    .first<{ ok: number }>();
  return Boolean(row);
}

/** The lowest-position column in a project (the create-card default target). */
export async function firstColumnId(
  env: Env,
  tenantId: string,
  projectId: string,
): Promise<string | null> {
  const row = await env.db.prepare(
    'SELECT id FROM columns WHERE tenant_id = ? AND project_id = ? ORDER BY position ASC LIMIT 1',
  )
    .bind(tenantId, projectId)
    .first<{ id: string }>();
  return row?.id ?? null;
}
