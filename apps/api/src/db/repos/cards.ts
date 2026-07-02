import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type {
  CardDto,
  QueueCardDto,
  CreateCardInput,
  PatchCardInput,
  SystemEventType,
  WebhookTrigger,
} from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { RANK_STEP } from '../../rank';
import { columnInProject, firstColumnId } from './columns';
import { mentionableUsers } from './users';
import { userHasProjectAccess } from '../../auth/access';
import { projectCode, nextCardSeq } from './projects';
import { insertEventStmt, type EventInsert } from './card_events';
import { reconcileMentionStmts, deleteMentionsForCardStmt } from './mentions';
import { blobKeysForCard, deleteAttachmentsForCardStmt, purgeBlobs } from './attachments';

/** Look up a column's name for durable move-event snapshots. */
async function columnName(env: Env, tenantId: string, id: string): Promise<string | null> {
  const r = await env.db.prepare('SELECT name FROM columns WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<{ name: string }>();
  return r?.name ?? null;
}

/** A column's semantic role (for the assign-into-ready callback trigger). */
async function columnRole(env: Env, tenantId: string, id: string): Promise<string | null> {
  const r = await env.db.prepare('SELECT role FROM columns WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<{ role: string | null }>();
  return r?.role ?? null;
}

/** Is this user an agent? (assign-into-ready only nudges agents.) */
async function isAgent(env: Env, tenantId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const r = await env.db.prepare('SELECT kind FROM users WHERE id = ? AND tenant_id = ?')
    .bind(userId, tenantId)
    .first<{ kind: string }>();
  return r?.kind === 'agent';
}

interface CardRow {
  id: string;
  tenant_id: string;
  project_id: string;
  column_id: string;
  seq: number | null;
  summary: string;
  description: string | null;
  acceptance_criteria: string | null;
  color: string | null;
  position: number;
  assignee_user_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: number;
  updated_at: number;
}

/** `code` is the card's project code, needed to derive the human key (CODE-seq). */
function toDto(r: CardRow, code: string | null): CardDto {
  return {
    id: r.id,
    projectId: r.project_id,
    columnId: r.column_id,
    key: code && r.seq != null ? `${code}-${r.seq}` : null,
    seq: r.seq,
    summary: r.summary,
    description: r.description,
    acceptanceCriteria: r.acceptance_criteria,
    color: r.color,
    position: r.position,
    assigneeUserId: r.assignee_user_id,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface CardFilters {
  columnId?: string;
  assignee?: string;
  q?: string;
}

export async function listCards(
  env: Env,
  tenantId: string,
  projectId: string,
  filters: CardFilters = {},
): Promise<CardDto[]> {
  const clauses = ['tenant_id = ?', 'project_id = ?'];
  const binds: unknown[] = [tenantId, projectId];
  if (filters.columnId) {
    clauses.push('column_id = ?');
    binds.push(filters.columnId);
  }
  if (filters.assignee) {
    clauses.push('assignee_user_id = ?');
    binds.push(filters.assignee);
  }
  if (filters.q) {
    clauses.push('(summary LIKE ? OR description LIKE ?)');
    const like = `%${filters.q}%`;
    binds.push(like, like);
  }
  const [rs, code] = await Promise.all([
    env.db.prepare(`SELECT * FROM cards WHERE ${clauses.join(' AND ')} ORDER BY position ASC`)
      .bind(...binds)
      .all<CardRow>(),
    projectCode(env, tenantId, projectId),
  ]);
  return (rs.results ?? []).map((r) => toDto(r, code));
}

interface QueueRow extends CardRow {
  project_code: string | null;
  project_name: string;
}

/**
 * The caller's actionable queue (v0.15.0): cards assigned to `userId` that sit
 * in a `ready`-role column. RBAC-scoped exactly like `listMentions` — an admin
 * sees all; a member only cards in projects they have `project_access` to.
 * Optional `projectId` narrows to one project. Newest-updated first.
 */
export async function listMyQueue(
  env: Env,
  tenantId: string,
  userId: string,
  opts: { isAdmin: boolean; projectId?: string },
): Promise<QueueCardDto[]> {
  const clauses = ['c.tenant_id = ?', 'c.assignee_user_id = ?', "col.role = 'ready'"];
  const binds: unknown[] = [tenantId, userId];
  if (opts.projectId) {
    clauses.push('c.project_id = ?');
    binds.push(opts.projectId);
  }
  if (!opts.isAdmin) {
    clauses.push('EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = c.project_id AND pa.user_id = ?)');
    binds.push(userId);
  }
  const rs = await env.db.prepare(
    `SELECT c.*, p.code AS project_code, p.name AS project_name
       FROM cards c
       JOIN columns col ON col.id = c.column_id
       JOIN projects p  ON p.id = c.project_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY c.updated_at DESC, c.id ASC`,
  )
    .bind(...binds)
    .all<QueueRow>();
  return (rs.results ?? []).map((r) => ({
    ...toDto(r, r.project_code),
    projectCode: r.project_code,
    projectName: r.project_name,
  }));
}

async function getCardRow(env: Env, tenantId: string, id: string): Promise<CardRow | null> {
  return env.db.prepare('SELECT * FROM cards WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<CardRow>();
}

export async function getCard(env: Env, tenantId: string, id: string): Promise<CardDto | null> {
  const row = await getCardRow(env, tenantId, id);
  if (!row) return null;
  return toDto(row, await projectCode(env, tenantId, row.project_id));
}

export async function createCard(
  env: Env,
  tenantId: string,
  projectId: string,
  userId: string,
  input: CreateCardInput,
  /** Optional collector for callback triggers (KBR-16); the handler dispatches them. */
  triggers?: WebhookTrigger[],
): Promise<CardDto> {
  // Target column: caller's choice (validated) or the project's first column.
  let columnId = input.columnId;
  if (columnId) {
    if (!(await columnInProject(env, tenantId, projectId, columnId))) {
      throw new HttpError(400, 'columnId does not belong to this project');
    }
  } else {
    const first = await firstColumnId(env, tenantId, projectId);
    if (!first) throw new HttpError(409, 'Project has no columns to place the card in');
    columnId = first;
  }

  if (
    input.assigneeUserId &&
    !(await userHasProjectAccess(env, tenantId, projectId, input.assigneeUserId))
  ) {
    throw new HttpError(400, 'assignee has no access to this project');
  }

  // Append to the end of the target column unless a position is pinned.
  let position = input.position;
  if (position === undefined) {
    const max = await env.db.prepare(
      'SELECT MAX(position) AS m FROM cards WHERE tenant_id = ? AND column_id = ?',
    )
      .bind(tenantId, columnId)
      .first<{ m: number | null }>();
    position = (max?.m ?? 0) + RANK_STEP;
  }

  // Assign the next per-project sequence number (monotonic; never reused).
  const seq = await nextCardSeq(env, tenantId, projectId);

  const id = newId('card');
  const now = Date.now();

  // Mentions authored in the initial text (summary / description / acceptance).
  // Scoped to this project so a mention of a no-access user is dropped.
  const users = await mentionableUsers(env, tenantId, projectId);
  const mentionStmts = (
    await Promise.all([
      reconcileMentionStmts(env, { tenantId, cardId: id, authorId: userId, sourceKind: 'summary', sourceId: 'summary', text: input.summary }, users, triggers),
      reconcileMentionStmts(env, { tenantId, cardId: id, authorId: userId, sourceKind: 'description', sourceId: 'description', text: input.description }, users, triggers),
      reconcileMentionStmts(env, { tenantId, cardId: id, authorId: userId, sourceKind: 'acceptance_criteria', sourceId: 'acceptance_criteria', text: input.acceptanceCriteria }, users, triggers),
    ])
  ).flat();

  // Assign-into-ready: a card created directly into a `ready` lane with an agent
  // assignee is immediately actionable — nudge the agent.
  if (triggers && input.assigneeUserId) {
    const [role, agent] = await Promise.all([
      columnRole(env, tenantId, columnId),
      isAgent(env, tenantId, input.assigneeUserId),
    ]);
    if (role === 'ready' && agent) {
      triggers.push({ event: 'card.ready', recipientUserId: input.assigneeUserId, source: { kind: 'assign' } });
    }
  }

  // Insert the card, its 'created' timeline event, and any mentions atomically.
  await env.db.batch([
    env.db.prepare(
      `INSERT INTO cards
         (id, tenant_id, project_id, column_id, seq, summary, description, acceptance_criteria,
          color, position, assignee_user_id, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, tenantId, projectId, columnId, seq, input.summary,
      input.description ?? null, input.acceptanceCriteria ?? null, null, // card color removed (v0.2.0)
      position, input.assigneeUserId ?? null, userId, userId, now, now,
    ),
    insertEventStmt(env, {
      tenantId, cardId: id, authorUserId: userId,
      kind: 'system', eventType: 'created', meta: { columnId },
    }),
    ...mentionStmts,
  ]);

  const row = await getCardRow(env, tenantId, id);
  if (!row) throw new HttpError(500, 'Card insert did not return row');
  return toDto(row, await projectCode(env, tenantId, projectId));
}

/**
 * Patch card fields and/or move it (columnId + position). `updated_by`
 * is always stamped with the acting user — the provenance signal.
 */
export async function patchCard(
  env: Env,
  tenantId: string,
  id: string,
  userId: string,
  input: PatchCardInput,
  /** Optional collector for callback triggers (KBR-16); the handler dispatches them. */
  triggers?: WebhookTrigger[],
): Promise<CardDto> {
  const existing = await getCardRow(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Card not found');

  // A move must target a column in the same project.
  if (input.columnId && input.columnId !== existing.column_id) {
    if (!(await columnInProject(env, tenantId, existing.project_id, input.columnId))) {
      throw new HttpError(400, 'columnId does not belong to this card\'s project');
    }
  }
  if (
    input.assigneeUserId !== undefined &&
    input.assigneeUserId !== null &&
    !(await userHasProjectAccess(env, tenantId, existing.project_id, input.assigneeUserId))
  ) {
    throw new HttpError(400, 'assignee has no access to this project');
  }

  const next = {
    summary: input.summary ?? existing.summary,
    description: input.description === undefined ? existing.description : input.description,
    acceptance_criteria:
      input.acceptanceCriteria === undefined ? existing.acceptance_criteria : input.acceptanceCriteria,
    color: existing.color, // card color is no longer settable (v0.2.0)
    column_id: input.columnId ?? existing.column_id,
    position: input.position ?? existing.position,
    assignee_user_id:
      input.assigneeUserId === undefined ? existing.assignee_user_id : input.assigneeUserId,
  };

  // Derive system timeline events from what actually changed. Provenance is no
  // longer last-write-wins: each change is kept as a durable event. (A pure
  // reorder — position only — changes nothing here, so it emits nothing.)
  const events: EventInsert[] = [];
  const ev = (eventType: SystemEventType, meta: Record<string, unknown>): EventInsert => ({
    tenantId, cardId: id, authorUserId: userId, kind: 'system', eventType, meta,
  });

  if (next.column_id !== existing.column_id) {
    const [fromName, toName] = await Promise.all([
      columnName(env, tenantId, existing.column_id),
      columnName(env, tenantId, next.column_id),
    ]);
    events.push(ev('moved', {
      from: { id: existing.column_id, name: fromName },
      to: { id: next.column_id, name: toName },
    }));
  }
  if (next.assignee_user_id !== existing.assignee_user_id) {
    events.push(ev('assigned', { from: existing.assignee_user_id, to: next.assignee_user_id }));
  }
  const editedFields: string[] = [];
  if (next.summary !== existing.summary) editedFields.push('summary');
  if (next.description !== existing.description) editedFields.push('description');
  if (next.acceptance_criteria !== existing.acceptance_criteria) editedFields.push('acceptanceCriteria');
  if (editedFields.length) events.push(ev('edited', { fields: editedFields }));

  const updateStmt = env.db.prepare(
    `UPDATE cards SET summary = ?, description = ?, acceptance_criteria = ?, color = ?,
        column_id = ?, position = ?, assignee_user_id = ?, updated_by = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`,
  ).bind(
    next.summary, next.description, next.acceptance_criteria, next.color,
    next.column_id, next.position, next.assignee_user_id, userId, Date.now(),
    id, tenantId,
  );

  // Reconcile mentions for each text field ACTUALLY present in this patch — a
  // pure move (columnId/position only) touches no mentions. Editing a handle out
  // of a field retracts that mention; clearing a field removes all of its.
  const mentionStmts: DbStatement[] = [];
  const touchesText =
    input.summary !== undefined ||
    input.description !== undefined ||
    input.acceptanceCriteria !== undefined;
  if (touchesText) {
    const users = await mentionableUsers(env, tenantId, existing.project_id);
    const reconcilers: Promise<DbStatement[]>[] = [];
    const rc = (sourceKind: 'summary' | 'description' | 'acceptance_criteria', text: string | null) =>
      reconcileMentionStmts(env, { tenantId, cardId: id, authorId: userId, sourceKind, sourceId: sourceKind, text }, users, triggers);
    if (input.summary !== undefined) reconcilers.push(rc('summary', next.summary));
    if (input.description !== undefined) reconcilers.push(rc('description', next.description));
    if (input.acceptanceCriteria !== undefined) reconcilers.push(rc('acceptance_criteria', next.acceptance_criteria));
    mentionStmts.push(...(await Promise.all(reconcilers)).flat());
  }

  // Assign-into-ready: fire when the card is now in a `ready` lane assigned to
  // an agent AND this patch caused it (moved into ready, or (re)assigned to the
  // agent while in ready). A pure edit of a card already sitting actionable
  // fires nothing.
  if (
    triggers &&
    next.assignee_user_id &&
    (next.column_id !== existing.column_id || next.assignee_user_id !== existing.assignee_user_id)
  ) {
    const [role, agent] = await Promise.all([
      columnRole(env, tenantId, next.column_id),
      isAgent(env, tenantId, next.assignee_user_id),
    ]);
    if (role === 'ready' && agent) {
      triggers.push({ event: 'card.ready', recipientUserId: next.assignee_user_id, source: { kind: 'assign' } });
    }
  }

  // Card update + its system event(s) + mention reconcile, atomically.
  await env.db.batch([updateStmt, ...events.map((e) => insertEventStmt(env, e)), ...mentionStmts]);

  const row = await getCardRow(env, tenantId, id);
  if (!row) throw new HttpError(500, 'Card update did not return row');
  return toDto(row, await projectCode(env, tenantId, existing.project_id));
}

export async function deleteCard(env: Env, tenantId: string, id: string): Promise<void> {
  const existing = await getCardRow(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Card not found');
  // Grab attachment blob keys before their rows go, so we can purge the bytes.
  const blobKeys = await blobKeysForCard(env, tenantId, id);
  // Cascade the timeline + mentions + attachments explicitly (D1 FK enforcement
  // is not reliably on) so nothing dangles at a deleted card.
  await env.db.batch([
    env.db.prepare('DELETE FROM card_events WHERE card_id = ? AND tenant_id = ?').bind(id, tenantId),
    deleteMentionsForCardStmt(env, tenantId, id),
    deleteAttachmentsForCardStmt(env, tenantId, id),
    env.db.prepare('DELETE FROM cards WHERE id = ? AND tenant_id = ?').bind(id, tenantId),
  ]);
  await purgeBlobs(env, blobKeys);
}
