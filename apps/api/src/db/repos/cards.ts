import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type {
  CardDto,
  QueueCardDto,
  MyQueueResponse,
  CreateCardInput,
  PatchCardInput,
  SystemEventType,
  WebhookTrigger,
} from '@kbrelay/shared';
import { DUE_SOON_WINDOW_MS, isChecklistOnlyEdit, countCardTasks } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { RANK_STEP } from '../../rank';
import { columnInProject, firstColumnId } from './columns';
import { mentionableUsers } from './users';
import { userHasProjectAccess } from '../../auth/access';
import { projectCode, nextCardSeq } from './projects';
import { insertEventStmt, type EventInsert } from './card_events';
import { reconcileMentionStmts, deleteMentionsForCardStmt } from './mentions';
import { blobKeysForCard, deleteAttachmentsForCardStmt } from './attachments';
import { resolveLabelSelection, setCardLabelStmts, labelIdsForCard, deleteCardLabelsStmt } from './labels';

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
  reviewer_user_id: string | null;
  due_at: number | null;
  archived_at: number | null;
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
    reviewerUserId: r.reviewer_user_id,
    dueAt: r.due_at,
    archivedAt: r.archived_at,
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
  /** Due-date convenience filter (KBR-63): `overdue` = past due, `soon` = due
   *  within the next 48h. Both exclude cards with no due date. */
  due?: 'overdue' | 'soon';
  /** `due` = due-soonest first, cards without a due date last. */
  sort?: 'due';
  /** true = ONLY archived cards, newest-archived first; default excludes them (KBR-60). */
  archived?: boolean;
  /** Only cards carrying this label id (KBR-62). */
  label?: string;
}

/** Safety cap on the archived listing (web Archive tab + MCP `list_cards(archived=true)`)
 *  so an unbounded archive can never be read in one query / one payload. Search (`q`)
 *  narrows within it; the true archived total is `countArchived` (KBR-80). */
export const ARCHIVE_LIST_LIMIT = 200;

export async function listCards(
  env: Env,
  tenantId: string,
  projectId: string,
  filters: CardFilters = {},
): Promise<CardDto[]> {
  // Archived cards leave the board by default; ?archived=1 flips the lens (KBR-60).
  const clauses = ['tenant_id = ?', 'project_id = ?', filters.archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL'];
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
    const like = `%${filters.q}%`;
    // A trailing integer ("KBR-12", "kbr 12", or a bare "12") also matches the card's
    // per-project seq, so search finds cards by ticket key — the human key `CODE-seq`
    // isn't a stored column (KBR-80).
    const seqDigits = filters.q.match(/(\d+)\s*$/)?.[1];
    const seq = seqDigits !== undefined ? Number(seqDigits) : NaN;
    if (Number.isSafeInteger(seq)) {
      clauses.push('(summary LIKE ? OR description LIKE ? OR seq = ?)');
      binds.push(like, like, seq);
    } else {
      clauses.push('(summary LIKE ? OR description LIKE ?)');
      binds.push(like, like);
    }
  }
  if (filters.label) {
    clauses.push('EXISTS (SELECT 1 FROM card_labels cl WHERE cl.card_id = cards.id AND cl.label_id = ?)');
    binds.push(filters.label);
  }
  if (filters.due) {
    const now = Date.now();
    if (filters.due === 'overdue') {
      clauses.push('due_at IS NOT NULL AND due_at < ?');
      binds.push(now);
    } else {
      clauses.push('due_at IS NOT NULL AND due_at >= ? AND due_at < ?');
      binds.push(now, now + DUE_SOON_WINDOW_MS);
    }
  }
  const order = filters.archived
    ? 'archived_at DESC'
    : filters.sort === 'due'
      ? '(due_at IS NULL) ASC, due_at ASC, position ASC'
      : 'position ASC';
  // Bound the archived lens so a huge archive can't be streamed in one read (KBR-80).
  // ARCHIVE_LIST_LIMIT is a module constant (not user input) — safe to inline.
  const limit = filters.archived ? ` LIMIT ${ARCHIVE_LIST_LIMIT}` : '';
  const [rs, code] = await Promise.all([
    env.db.prepare(`SELECT * FROM cards WHERE ${clauses.join(' AND ')} ORDER BY ${order}${limit}`)
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

/** One RBAC-scoped queue section: cards where `whoCol` = userId in a `role` column. */
async function queueSection(
  env: Env,
  tenantId: string,
  userId: string,
  opts: { isAdmin: boolean; projectId?: string },
  whoCol: 'assignee_user_id' | 'reviewer_user_id',
  role: 'ready' | 'review',
): Promise<QueueCardDto[]> {
  const clauses = ['c.tenant_id = ?', `c.${whoCol} = ?`, 'col.role = ?', 'c.archived_at IS NULL'];
  const binds: unknown[] = [tenantId, userId, role];
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
      ORDER BY (c.due_at IS NULL) ASC, c.due_at ASC, c.updated_at DESC, c.id ASC`,
  )
    .bind(...binds)
    .all<QueueRow>();
  return (rs.results ?? []).map((r) => ({
    ...toDto(r, r.project_code),
    projectCode: r.project_code,
    projectName: r.project_name,
  }));
}

/**
 * The caller's actionable queue (v0.15.0; two sections since v0.17.0/KBR-61):
 *  - `work`: cards assigned to `userId` sitting in a `ready`-role column.
 *  - `review`: cards where `userId` is the reviewer sitting in a `review`-role column.
 * RBAC-scoped exactly like `listMentions` — an admin sees all; a member only
 * cards in projects they have `project_access` to. Optional `projectId`
 * narrows to one project. Due-soonest first (KBR-63), then newest-updated;
 * cards with no due date sort after every dated one.
 */
export async function listMyQueue(
  env: Env,
  tenantId: string,
  userId: string,
  opts: { isAdmin: boolean; projectId?: string },
): Promise<MyQueueResponse> {
  const [work, review] = await Promise.all([
    queueSection(env, tenantId, userId, opts, 'assignee_user_id', 'ready'),
    queueSection(env, tenantId, userId, opts, 'reviewer_user_id', 'review'),
  ]);
  return { work, review };
}

async function getCardRow(env: Env, tenantId: string, id: string): Promise<CardRow | null> {
  return env.db.prepare('SELECT * FROM cards WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<CardRow>();
}

/** How many cards a project has archived (KBR-75) — for the Done-lane badge. */
export async function countArchivedCards(env: Env, tenantId: string, projectId: string): Promise<number> {
  const row = await env.db.prepare(
    'SELECT COUNT(*) AS n FROM cards WHERE tenant_id = ? AND project_id = ? AND archived_at IS NOT NULL',
  )
    .bind(tenantId, projectId)
    .first<{ n: number }>();
  return row?.n ?? 0;
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
  if (
    input.reviewerUserId &&
    !(await userHasProjectAccess(env, tenantId, projectId, input.reviewerUserId))
  ) {
    throw new HttpError(400, 'reviewer has no access to this project');
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

  // Labels at birth (KBR-62): resolve ids/names to rows (400 on unknown).
  const labels = await resolveLabelSelection(env, tenantId, projectId, input);

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
          color, position, assignee_user_id, reviewer_user_id, due_at, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, tenantId, projectId, columnId, seq, input.summary,
      input.description ?? null, input.acceptanceCriteria ?? null, null, // card color removed (v0.2.0)
      position, input.assigneeUserId ?? null, input.reviewerUserId ?? null, input.dueAt ?? null,
      userId, userId, now, now,
    ),
    insertEventStmt(env, {
      tenantId, cardId: id, authorUserId: userId,
      kind: 'system', eventType: 'created', meta: { columnId },
    }),
    ...(labels && labels.length ? setCardLabelStmts(env, tenantId, id, labels.map((l) => l.id)) : []),
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
  if (
    input.reviewerUserId !== undefined &&
    input.reviewerUserId !== null &&
    !(await userHasProjectAccess(env, tenantId, existing.project_id, input.reviewerUserId))
  ) {
    throw new HttpError(400, 'reviewer has no access to this project');
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
    reviewer_user_id:
      input.reviewerUserId === undefined ? existing.reviewer_user_id : input.reviewerUserId,
    due_at: input.dueAt === undefined ? existing.due_at : input.dueAt,
    // Archive flag (KBR-60): true stamps now, false clears; untouched otherwise.
    // A restore drops the card back into its retained column_id — no recompute.
    archived_at:
      input.archived === undefined
        ? existing.archived_at
        : input.archived
          ? existing.archived_at ?? Date.now()
          : null,
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
  if (next.reviewer_user_id !== existing.reviewer_user_id) {
    events.push(ev('reviewer', { from: existing.reviewer_user_id, to: next.reviewer_user_id }));
  }
  if (next.due_at !== existing.due_at) {
    events.push(ev('due', { from: existing.due_at, to: next.due_at }));
  }
  if (next.archived_at !== existing.archived_at) {
    events.push(ev(next.archived_at != null ? 'archived' : 'restored', {}));
  }

  // Label set replace (KBR-62): resolve the selection, diff against the current
  // set, and log added/removed BY NAME so the timeline reads without lookups.
  const labelStmts: DbStatement[] = [];
  const labelSelection = await resolveLabelSelection(env, tenantId, existing.project_id, input);
  if (labelSelection !== null) {
    const currentIds = new Set(await labelIdsForCard(env, tenantId, id));
    const nextIds = new Set(labelSelection.map((l) => l.id));
    const changed = currentIds.size !== nextIds.size || [...nextIds].some((x) => !currentIds.has(x));
    if (changed) {
      const byId = new Map(labelSelection.map((l) => [l.id, l.name]));
      // Removed names need a lookup against the project's full label list.
      const all = new Map((await resolveLabelSelection(env, tenantId, existing.project_id, { labelIds: [...currentIds] }) ?? []).map((l) => [l.id, l.name]));
      events.push(ev('labels', {
        added: [...nextIds].filter((x) => !currentIds.has(x)).map((x) => byId.get(x)),
        removed: [...currentIds].filter((x) => !nextIds.has(x)).map((x) => all.get(x)),
      }));
      labelStmts.push(...setCardLabelStmts(env, tenantId, id, [...nextIds]));
    }
  }
  const editedFields: string[] = [];
  if (next.summary !== existing.summary) editedFields.push('summary');
  if (next.description !== existing.description) editedFields.push('description');
  if (next.acceptance_criteria !== existing.acceptance_criteria) editedFields.push('acceptanceCriteria');
  if (editedFields.length) {
    // Checkbox-only edits get a compact `task` event instead of `edited`, so a
    // run of checklist clicks doesn't spam the activity feed (KBR-72).
    const checklistOnly = editedFields.every(
      (f) =>
        (f === 'description' && isChecklistOnlyEdit(existing.description, next.description)) ||
        (f === 'acceptanceCriteria' && isChecklistOnlyEdit(existing.acceptance_criteria, next.acceptance_criteria)),
    );
    if (checklistOnly) {
      const counts = countCardTasks(next.description, next.acceptance_criteria);
      events.push(ev('task', { fields: editedFields, done: counts.done, total: counts.total }));
    } else {
      events.push(ev('edited', { fields: editedFields }));
    }
  }

  const updateStmt = env.db.prepare(
    `UPDATE cards SET summary = ?, description = ?, acceptance_criteria = ?, color = ?,
        column_id = ?, position = ?, assignee_user_id = ?, reviewer_user_id = ?, due_at = ?, archived_at = ?, updated_by = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`,
  ).bind(
    next.summary, next.description, next.acceptance_criteria, next.color,
    next.column_id, next.position, next.assignee_user_id, next.reviewer_user_id, next.due_at, next.archived_at, userId, Date.now(),
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

  // Card update + its system event(s) + label replace + mention reconcile, atomically.
  await env.db.batch([updateStmt, ...events.map((e) => insertEventStmt(env, e)), ...labelStmts, ...mentionStmts]);

  const row = await getCardRow(env, tenantId, id);
  if (!row) throw new HttpError(500, 'Card update did not return row');
  return toDto(row, await projectCode(env, tenantId, existing.project_id));
}

/**
 * Lazy auto-archive (KBR-60): archive this project's done-column cards whose
 * last activity is older than `days`. Runs on board read when the project's
 * `autoArchiveDoneDays` knob is set — no cron, no scheduler. Each archived
 * card gets an `archived` event with a NULL author + `{auto: true}` meta, so
 * the timeline explains the disappearance without inventing an actor.
 */
export async function autoArchiveDone(
  env: Env,
  tenantId: string,
  projectId: string,
  days: number,
): Promise<number> {
  const cutoff = Date.now() - days * 86_400_000;
  const rs = await env.db.prepare(
    `SELECT c.id FROM cards c
       JOIN columns col ON col.id = c.column_id
      WHERE c.tenant_id = ? AND c.project_id = ? AND c.archived_at IS NULL
        AND col.role = 'done' AND c.updated_at < ?`,
  )
    .bind(tenantId, projectId, cutoff)
    .all<{ id: string }>();
  const ids = (rs.results ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;

  const now = Date.now();
  await env.db.batch([
    ...ids.map((id) =>
      env.db.prepare('UPDATE cards SET archived_at = ? WHERE id = ? AND tenant_id = ?').bind(now, id, tenantId),
    ),
    ...ids.map((id) =>
      insertEventStmt(env, {
        tenantId, cardId: id, authorUserId: null,
        kind: 'system', eventType: 'archived', meta: { auto: true, days },
      }),
    ),
  ]);
  return ids.length;
}

/** Delete a card + its children (timeline, mentions, attachment rows). Returns
 *  the attachment blob keys so the caller can purge the bytes OFF the response
 *  path via `ctx.waitUntil` (KBR-41) — the rows are already gone regardless. */
export async function deleteCard(env: Env, tenantId: string, id: string): Promise<string[]> {
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
    deleteCardLabelsStmt(env, tenantId, id),
    env.db.prepare('DELETE FROM cards WHERE id = ? AND tenant_id = ?').bind(id, tenantId),
  ]);
  return blobKeys;
}
