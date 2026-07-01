import type { Env } from '../../env';
import type { ColumnDto, CreateColumnInput, PatchColumnInput } from '@kbrelay/shared';
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
  created_at: number;
}

function toDto(r: ColumnRow): ColumnDto {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    color: r.color,
    position: r.position,
    createdAt: r.created_at,
  };
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
  await env.db.prepare(
    `INSERT INTO columns (id, tenant_id, project_id, name, color, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, tenantId, projectId, input.name, input.color ?? null, position, Date.now())
    .run();
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
  };
  await env.db.prepare('UPDATE columns SET name = ?, color = ?, position = ? WHERE id = ? AND tenant_id = ?')
    .bind(next.name, next.color, next.position, id, tenantId)
    .run();
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
