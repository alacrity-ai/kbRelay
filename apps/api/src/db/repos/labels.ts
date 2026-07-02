import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { LabelDto, CardLabel, CreateLabelInput, PatchLabelInput } from '@kbrelay/shared';
import { MAX_LABELS_PER_PROJECT } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';

/**
 * Labels (v0.17.0, KBR-62): flat, per-project, capped at 12. A label is a
 * palette entry; the card_labels join is the only relationship. Deleting a
 * label unlinks it everywhere — card timelines are unaffected.
 */

interface LabelRow {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: number;
}

const toDto = (r: LabelRow): LabelDto => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  color: r.color,
  createdAt: r.created_at,
});

export async function listLabels(env: Env, tenantId: string, projectId: string): Promise<LabelDto[]> {
  const rs = await env.db.prepare(
    'SELECT * FROM labels WHERE tenant_id = ? AND project_id = ? ORDER BY name COLLATE NOCASE ASC',
  )
    .bind(tenantId, projectId)
    .all<LabelRow>();
  return (rs.results ?? []).map(toDto);
}

export async function getLabel(env: Env, tenantId: string, id: string): Promise<LabelDto | null> {
  const row = await env.db.prepare('SELECT * FROM labels WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<LabelRow>();
  return row ? toDto(row) : null;
}

async function assertNameFree(
  env: Env,
  tenantId: string,
  projectId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const row = await env.db.prepare(
    `SELECT 1 AS x FROM labels WHERE tenant_id = ? AND project_id = ? AND lower(name) = lower(?)${exceptId ? ' AND id != ?' : ''}`,
  )
    .bind(...(exceptId ? [tenantId, projectId, name, exceptId] : [tenantId, projectId, name]))
    .first<{ x: number }>();
  if (row) throw new HttpError(409, `A label named "${name}" already exists in this project`);
}

export async function createLabel(
  env: Env,
  tenantId: string,
  projectId: string,
  input: CreateLabelInput,
): Promise<LabelDto> {
  const count = await env.db.prepare(
    'SELECT COUNT(*) AS n FROM labels WHERE tenant_id = ? AND project_id = ?',
  )
    .bind(tenantId, projectId)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_LABELS_PER_PROJECT) {
    throw new HttpError(409, `Label cap reached (${MAX_LABELS_PER_PROJECT} per project) — labels are a palette, not a taxonomy`);
  }
  await assertNameFree(env, tenantId, projectId, input.name);
  const id = newId('lbl');
  await env.db.prepare(
    'INSERT INTO labels (id, tenant_id, project_id, name, color, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(id, tenantId, projectId, input.name, input.color, Date.now())
    .run();
  const created = await getLabel(env, tenantId, id);
  if (!created) throw new HttpError(500, 'Label insert did not return row');
  return created;
}

export async function patchLabel(
  env: Env,
  tenantId: string,
  id: string,
  input: PatchLabelInput,
): Promise<LabelDto> {
  const existing = await getLabel(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Label not found');
  if (input.name !== undefined && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameFree(env, tenantId, existing.projectId, input.name, id);
  }
  await env.db.prepare('UPDATE labels SET name = ?, color = ? WHERE id = ? AND tenant_id = ?')
    .bind(input.name ?? existing.name, input.color ?? existing.color, id, tenantId)
    .run();
  const updated = await getLabel(env, tenantId, id);
  if (!updated) throw new HttpError(500, 'Label update did not return row');
  return updated;
}

/** Delete a label + its card links. Card timelines are untouched. */
export async function deleteLabel(env: Env, tenantId: string, id: string): Promise<void> {
  const existing = await getLabel(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Label not found');
  await env.db.batch([
    env.db.prepare('DELETE FROM card_labels WHERE label_id = ? AND tenant_id = ?').bind(id, tenantId),
    env.db.prepare('DELETE FROM labels WHERE id = ? AND tenant_id = ?').bind(id, tenantId),
  ]);
}

/** Labels for a set of cards, one grouped query (same spot as attachmentCounts). */
export async function labelsForCards(
  env: Env,
  tenantId: string,
  cardIds: string[],
): Promise<Record<string, CardLabel[]>> {
  if (cardIds.length === 0) return {};
  const placeholders = cardIds.map(() => '?').join(', ');
  const rs = await env.db.prepare(
    `SELECT cl.card_id, l.id, l.name, l.color
       FROM card_labels cl JOIN labels l ON l.id = cl.label_id
      WHERE cl.tenant_id = ? AND cl.card_id IN (${placeholders})
      ORDER BY l.name COLLATE NOCASE ASC`,
  )
    .bind(tenantId, ...cardIds)
    .all<{ card_id: string; id: string; name: string; color: string }>();
  const out: Record<string, CardLabel[]> = {};
  for (const r of rs.results ?? []) {
    (out[r.card_id] ??= []).push({ id: r.id, name: r.name, color: r.color });
  }
  return out;
}

/**
 * Resolve a card patch/create's label selection to canonical label rows.
 * Web sends ids; agents send names (case-insensitive, resolved within the
 * project). Unknown entries are a 400 — never silently dropped.
 */
export async function resolveLabelSelection(
  env: Env,
  tenantId: string,
  projectId: string,
  input: { labelIds?: string[]; labelNames?: string[] },
): Promise<LabelDto[] | null> {
  if (input.labelIds === undefined && input.labelNames === undefined) return null;
  if (input.labelIds !== undefined && input.labelNames !== undefined) {
    throw new HttpError(400, 'Provide labelIds or labelNames, not both');
  }
  const all = await listLabels(env, tenantId, projectId);
  if (input.labelIds !== undefined) {
    const byId = new Map(all.map((l) => [l.id, l]));
    return input.labelIds.map((id) => {
      const l = byId.get(id);
      if (!l) throw new HttpError(400, `Unknown label id "${id}" in this project`);
      return l;
    });
  }
  const byName = new Map(all.map((l) => [l.name.toLowerCase(), l]));
  return input.labelNames!.map((n) => {
    const l = byName.get(n.trim().toLowerCase());
    if (!l) {
      throw new HttpError(400, `Unknown label "${n}" — available: ${all.map((x) => x.name).join(', ') || '(none)'}`);
    }
    return l;
  });
}

/** Statements that replace a card's label set (composed into the card batch). */
export function setCardLabelStmts(
  env: Env,
  tenantId: string,
  cardId: string,
  labelIds: string[],
): DbStatement[] {
  return [
    env.db.prepare('DELETE FROM card_labels WHERE card_id = ? AND tenant_id = ?').bind(cardId, tenantId),
    ...labelIds.map((lid) =>
      env.db.prepare('INSERT INTO card_labels (tenant_id, card_id, label_id) VALUES (?, ?, ?)').bind(tenantId, cardId, lid),
    ),
  ];
}

/** The card's current label ids (for diffing in patch events). */
export async function labelIdsForCard(env: Env, tenantId: string, cardId: string): Promise<string[]> {
  const rs = await env.db.prepare('SELECT label_id FROM card_labels WHERE card_id = ? AND tenant_id = ?')
    .bind(cardId, tenantId)
    .all<{ label_id: string }>();
  return (rs.results ?? []).map((r) => r.label_id);
}

/** Cascade for card deletion (KBR-41 pattern). */
export function deleteCardLabelsStmt(env: Env, tenantId: string, cardId: string): DbStatement {
  return env.db.prepare('DELETE FROM card_labels WHERE card_id = ? AND tenant_id = ?').bind(cardId, tenantId);
}

/** Cascade for project deletion. */
export function deleteLabelsForProjectStmts(env: Env, tenantId: string, projectId: string): DbStatement[] {
  return [
    env.db.prepare(
      `DELETE FROM card_labels WHERE tenant_id = ?
         AND label_id IN (SELECT id FROM labels WHERE project_id = ? AND tenant_id = ?)`,
    ).bind(tenantId, projectId, tenantId),
    env.db.prepare('DELETE FROM labels WHERE project_id = ? AND tenant_id = ?').bind(projectId, tenantId),
  ];
}
