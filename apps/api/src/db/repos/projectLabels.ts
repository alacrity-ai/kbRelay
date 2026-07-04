import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type {
  ProjectLabelDto,
  CreateProjectLabelInput,
  PatchProjectLabelInput,
  SetProjectLabelsInput,
} from '@kbrelay/shared';
import { MAX_PROJECT_LABELS_PER_TENANT } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';

/**
 * Project labels (KBR-84): tenant-scoped organising buckets. The
 * `project_label_links` join is the only relationship. Deleting a label unlinks
 * it from every project; deleting a project unlinks (but keeps) the labels.
 */

interface ProjectLabelRow {
  id: string;
  name: string;
  color: string;
  created_at: number;
}

const toDto = (r: ProjectLabelRow): ProjectLabelDto => ({
  id: r.id,
  name: r.name,
  color: r.color,
  createdAt: r.created_at,
});

export async function listProjectLabels(env: Env, tenantId: string): Promise<ProjectLabelDto[]> {
  const rs = await env.db.prepare(
    'SELECT * FROM project_labels WHERE tenant_id = ? ORDER BY name COLLATE NOCASE ASC',
  )
    .bind(tenantId)
    .all<ProjectLabelRow>();
  return (rs.results ?? []).map(toDto);
}

export async function getProjectLabel(env: Env, tenantId: string, id: string): Promise<ProjectLabelDto | null> {
  const row = await env.db.prepare('SELECT * FROM project_labels WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<ProjectLabelRow>();
  return row ? toDto(row) : null;
}

async function assertNameFree(env: Env, tenantId: string, name: string, exceptId?: string): Promise<void> {
  const row = await env.db.prepare(
    `SELECT 1 AS x FROM project_labels WHERE tenant_id = ? AND lower(name) = lower(?)${exceptId ? ' AND id != ?' : ''}`,
  )
    .bind(...(exceptId ? [tenantId, name, exceptId] : [tenantId, name]))
    .first<{ x: number }>();
  if (row) throw new HttpError(409, `A project label named "${name}" already exists`);
}

export async function createProjectLabel(
  env: Env,
  tenantId: string,
  input: CreateProjectLabelInput,
): Promise<ProjectLabelDto> {
  const count = await env.db.prepare('SELECT COUNT(*) AS n FROM project_labels WHERE tenant_id = ?')
    .bind(tenantId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PROJECT_LABELS_PER_TENANT) {
    throw new HttpError(409, `Project-label cap reached (${MAX_PROJECT_LABELS_PER_TENANT} per tenant) — labels are a palette, not a taxonomy`);
  }
  await assertNameFree(env, tenantId, input.name);
  const id = newId('plbl');
  await env.db.prepare(
    'INSERT INTO project_labels (id, tenant_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, tenantId, input.name, input.color, Date.now())
    .run();
  const created = await getProjectLabel(env, tenantId, id);
  if (!created) throw new HttpError(500, 'Project label insert did not return row');
  return created;
}

export async function patchProjectLabel(
  env: Env,
  tenantId: string,
  id: string,
  input: PatchProjectLabelInput,
): Promise<ProjectLabelDto> {
  const existing = await getProjectLabel(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Project label not found');
  if (input.name !== undefined && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameFree(env, tenantId, input.name, id);
  }
  await env.db.prepare('UPDATE project_labels SET name = ?, color = ? WHERE id = ? AND tenant_id = ?')
    .bind(input.name ?? existing.name, input.color ?? existing.color, id, tenantId)
    .run();
  const updated = await getProjectLabel(env, tenantId, id);
  if (!updated) throw new HttpError(500, 'Project label update did not return row');
  return updated;
}

/** Delete a project label + its links. The projects themselves are untouched. */
export async function deleteProjectLabel(env: Env, tenantId: string, id: string): Promise<void> {
  const existing = await getProjectLabel(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Project label not found');
  await env.db.batch([
    env.db.prepare('DELETE FROM project_label_links WHERE label_id = ? AND tenant_id = ?').bind(id, tenantId),
    env.db.prepare('DELETE FROM project_labels WHERE id = ? AND tenant_id = ?').bind(id, tenantId),
  ]);
}

/** Labels for a set of projects, one grouped query (mirrors labelsForCards). */
export async function labelsForProjects(
  env: Env,
  tenantId: string,
  projectIds: string[],
): Promise<Record<string, ProjectLabelDto[]>> {
  if (projectIds.length === 0) return {};
  const placeholders = projectIds.map(() => '?').join(', ');
  const rs = await env.db.prepare(
    `SELECT pll.project_id, l.id, l.name, l.color, l.created_at
       FROM project_label_links pll JOIN project_labels l ON l.id = pll.label_id
      WHERE pll.tenant_id = ? AND pll.project_id IN (${placeholders})
      ORDER BY l.name COLLATE NOCASE ASC`,
  )
    .bind(tenantId, ...projectIds)
    .all<{ project_id: string; id: string; name: string; color: string; created_at: number }>();
  const out: Record<string, ProjectLabelDto[]> = {};
  for (const r of rs.results ?? []) {
    (out[r.project_id] ??= []).push({ id: r.id, name: r.name, color: r.color, createdAt: r.created_at });
  }
  return out;
}

/**
 * Resolve a set-labels request to canonical label rows. Web sends ids; agents
 * send names (case-insensitive, resolved within the tenant). Unknown entries
 * are a 400 — never silently dropped. Both provided is a 400.
 */
export async function resolveProjectLabelSelection(
  env: Env,
  tenantId: string,
  input: SetProjectLabelsInput,
): Promise<ProjectLabelDto[]> {
  if (input.labelIds !== undefined && input.labelNames !== undefined) {
    throw new HttpError(400, 'Provide labelIds or labelNames, not both');
  }
  const all = await listProjectLabels(env, tenantId);
  if (input.labelIds !== undefined) {
    const byId = new Map(all.map((l) => [l.id, l]));
    return input.labelIds.map((id) => {
      const l = byId.get(id);
      if (!l) throw new HttpError(400, `Unknown project-label id "${id}"`);
      return l;
    });
  }
  const byName = new Map(all.map((l) => [l.name.toLowerCase(), l]));
  return (input.labelNames ?? []).map((n) => {
    const l = byName.get(n.trim().toLowerCase());
    if (!l) {
      throw new HttpError(400, `Unknown project-label "${n}" — available: ${all.map((x) => x.name).join(', ') || '(none)'}`);
    }
    return l;
  });
}

/** Replace a project's label set with the given label ids. */
export async function setProjectLabels(
  env: Env,
  tenantId: string,
  projectId: string,
  labelIds: string[],
): Promise<void> {
  await env.db.batch([
    env.db.prepare('DELETE FROM project_label_links WHERE project_id = ? AND tenant_id = ?').bind(projectId, tenantId),
    ...labelIds.map((lid) =>
      env.db.prepare('INSERT INTO project_label_links (tenant_id, project_id, label_id) VALUES (?, ?, ?)').bind(tenantId, projectId, lid),
    ),
  ]);
}

/** Cascade for project deletion — unlink the project (labels are tenant-owned). */
export function deleteProjectLabelLinksForProjectStmt(env: Env, tenantId: string, projectId: string): DbStatement {
  return env.db.prepare('DELETE FROM project_label_links WHERE project_id = ? AND tenant_id = ?').bind(projectId, tenantId);
}
