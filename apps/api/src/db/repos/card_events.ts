import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { CardEventDto, CardEventKind, SystemEventType, CreateCommentInput, ProjectEventDto, ProjectEventsResponse, WebhookTrigger } from '@kbrelay/shared';
import { classifyRedaction } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { mentionableUsers } from './users';
import { reconcileMentionStmts, deleteMentionsForCommentStmt } from './mentions';
import {
  linkAttachmentsToEventStmt,
  blobKeysForEvent,
  deleteAttachmentsForEventStmt,
} from './attachments';

interface CardEventRow {
  id: string;
  card_id: string;
  author_user_id: string | null;
  kind: string;
  event_type: string | null;
  body: string | null;
  meta_json: string | null;
  created_at: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

function toDto(r: CardEventRow): CardEventDto {
  const redacted = r.deleted_at != null;
  let meta: Record<string, unknown> | null = null;
  if (!redacted && r.meta_json) {
    try {
      meta = JSON.parse(r.meta_json) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  }
  return {
    id: r.id,
    cardId: r.card_id,
    authorUserId: r.author_user_id,
    kind: r.kind as CardEventKind,
    eventType: (r.event_type as SystemEventType | null) ?? null,
    // Redacted comments carry no content — belt-and-suspenders even though the
    // DB row is nulled on redaction.
    body: redacted ? null : r.body,
    meta,
    createdAt: r.created_at,
    deletedAt: r.deleted_at ?? null,
    deletedBy: r.deleted_by ?? null,
  };
}

export interface EventInsert {
  tenantId: string;
  cardId: string;
  /** Null for policy-driven events with no human/agent actor (lazy auto-archive, KBR-60). */
  authorUserId: string | null;
  kind: CardEventKind;
  eventType?: SystemEventType | null;
  body?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Build a prepared INSERT for a card event without executing it, so callers can
 * compose it into the same `env.db.batch([...])` as the card mutation it records
 * — a move can't land without its event, and vice versa.
 */
export function insertEventStmt(env: Env, e: EventInsert): DbStatement {
  return env.db.prepare(
    `INSERT INTO card_events
       (id, tenant_id, card_id, author_user_id, kind, event_type, body, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    newId('evt'),
    e.tenantId,
    e.cardId,
    e.authorUserId,
    e.kind,
    e.eventType ?? null,
    e.body ?? null,
    e.meta ? JSON.stringify(e.meta) : null,
    Date.now(),
  );
}

/** Feed page size bounds (v0.17.0). */
const FEED_DEFAULT_LIMIT = 50;
const FEED_MAX_LIMIT = 200;

/** Opaque feed cursor: "<createdAt>_<eventId>". Malformed input ⇒ null (start). */
function parseFeedCursor(cursor: string | undefined): { ts: number; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.indexOf('_');
  if (sep <= 0) return null;
  const ts = Number(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  return Number.isFinite(ts) && id ? { ts, id } : null;
}

/**
 * Project activity feed (v0.17.0, KBR-67): newest-first union of the project's
 * card timelines, each event enriched with its card's key + summary. A pure
 * projection — zero new writes; redacted comments surface as tombstones via
 * `toDto` exactly like the card timeline. `card_events` has no project_id, so
 * we join through cards (measured fine at current scale; denormalize only if
 * it ever hurts).
 */
export async function listProjectEvents(
  env: Env,
  tenantId: string,
  projectId: string,
  opts: { since?: number; limit?: number; cursor?: string } = {},
): Promise<ProjectEventsResponse> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? FEED_DEFAULT_LIMIT), 1), FEED_MAX_LIMIT);
  const conds = ['c.project_id = ?', 'e.tenant_id = ?'];
  const binds: (string | number)[] = [projectId, tenantId];
  if (opts.since != null) {
    conds.push('e.created_at >= ?');
    binds.push(opts.since);
  }
  const cur = parseFeedCursor(opts.cursor);
  if (cur) {
    conds.push('(e.created_at < ? OR (e.created_at = ? AND e.id < ?))');
    binds.push(cur.ts, cur.ts, cur.id);
  }
  // Fetch one extra row to know whether another page exists.
  const rs = await env.db.prepare(
    `SELECT e.*, c.seq AS card_seq, c.summary AS card_summary, p.code AS project_code
       FROM card_events e
       JOIN cards c ON c.id = e.card_id AND c.tenant_id = e.tenant_id
       JOIN projects p ON p.id = c.project_id AND p.tenant_id = c.tenant_id
      WHERE ${conds.join(' AND ')}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ?`,
  )
    .bind(...binds, limit + 1)
    .all<CardEventRow & { card_seq: number | null; card_summary: string; project_code: string | null }>();

  const rows = rs.results ?? [];
  const page = rows.slice(0, limit);
  const events: ProjectEventDto[] = page.map((r) => ({
    ...toDto(r),
    cardKey: r.project_code && r.card_seq != null ? `${r.project_code}-${r.card_seq}` : null,
    cardSummary: r.card_summary,
  }));
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last ? `${last.created_at}_${last.id}` : null;
  return { events, nextCursor };
}

/** All timeline entries for a card, oldest → newest (a log reads top-down). */
export async function listTimeline(
  env: Env,
  tenantId: string,
  cardId: string,
): Promise<CardEventDto[]> {
  const rs = await env.db.prepare(
    // Tiebreak on rowid (insertion order), not id: ids are random UUIDs, so
    // two events in the same created_at millisecond would otherwise order
    // non-deterministically (KBR-98 flaky due.test.ts, and wrong timeline order
    // for same-ms events in the real UI). rowid is monotonic on both D1 + libsql.
    'SELECT * FROM card_events WHERE card_id = ? AND tenant_id = ? ORDER BY created_at ASC, rowid ASC',
  )
    .bind(cardId, tenantId)
    .all<CardEventRow>();
  return (rs.results ?? []).map(toDto);
}

/** Add a user-authored comment (note or handoff) to a card's timeline. */
export async function addComment(
  env: Env,
  tenantId: string,
  cardId: string,
  userId: string,
  input: CreateCommentInput,
  /** Optional collector for callback triggers (KBR-14); the handler dispatches them. */
  triggers?: WebhookTrigger[],
): Promise<CardEventDto> {
  const id = newId('evt');
  const kind = input.type ?? 'note';
  const meta = kind === 'handoff' && input.meta ? JSON.stringify(input.meta) : null;

  // Mentions authored in the comment body, keyed to this comment's id. Scoped
  // to the card's project so a mention of a no-access user is dropped.
  const card = await env.db.prepare('SELECT project_id FROM cards WHERE id = ? AND tenant_id = ?')
    .bind(cardId, tenantId)
    .first<{ project_id: string }>();
  const users = card ? await mentionableUsers(env, tenantId, card.project_id) : [];
  const mentionStmts = await reconcileMentionStmts(
    env,
    { tenantId, cardId, authorId: userId, sourceKind: 'comment', sourceId: id, text: input.body },
    users,
    triggers,
  );

  // Link any attachments uploaded for this comment to its new event (v0.16.0).
  const linkStmt = linkAttachmentsToEventStmt(env, tenantId, cardId, id, input.attachmentIds ?? []);

  await env.db.batch([
    env.db.prepare(
      `INSERT INTO card_events
         (id, tenant_id, card_id, author_user_id, kind, event_type, body, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    ).bind(id, tenantId, cardId, userId, kind, input.body, meta, Date.now()),
    ...mentionStmts,
    ...(linkStmt ? [linkStmt] : []),
  ]);

  const row = await env.db.prepare('SELECT * FROM card_events WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<CardEventRow>();
  if (!row) throw new Error('Comment insert did not return row');
  return toDto(row);
}

/**
 * Redact a comment (soft-delete): null its body + meta, keep the row as a
 * tombstone, and retract the mentions it authored. Append-only-safe — only the
 * author may redact, system events are refused, and it's idempotent.
 */
/** Redact a comment. Returns the tombstone DTO plus the attachment blob keys to
 *  purge — the caller runs the purge OFF the response path via `ctx.waitUntil`
 *  (KBR-41). The rows are hard-deleted regardless of the purge outcome. */
export async function redactComment(
  env: Env,
  tenantId: string,
  cardId: string,
  commentId: string,
  userId: string,
): Promise<{ event: CardEventDto; blobKeys: string[] }> {
  const row = await env.db.prepare(
    'SELECT * FROM card_events WHERE id = ? AND card_id = ? AND tenant_id = ?',
  )
    .bind(commentId, cardId, tenantId)
    .first<CardEventRow>();
  if (!row) throw new HttpError(404, 'Comment not found');

  const verdict = classifyRedaction(
    { kind: row.kind as CardEventKind, authorUserId: row.author_user_id, deletedAt: row.deleted_at },
    userId,
  );
  if (verdict.error === 'not_comment') throw new HttpError(400, 'System events cannot be redacted');
  if (verdict.error === 'not_author') throw new HttpError(403, 'You can only redact your own comment');
  if (verdict.alreadyRedacted) return { event: toDto(row), blobKeys: [] }; // idempotent no-op

  // Redaction removes content that must not persist — that includes a leaked
  // file, so hard-delete this comment's attachments (rows + bytes), not just the
  // text. The tombstone remains; the files do not.
  const blobKeys = await blobKeysForEvent(env, tenantId, commentId);

  await env.db.batch([
    env.db.prepare(
      `UPDATE card_events SET body = NULL, meta_json = NULL, deleted_at = ?, deleted_by = ?
        WHERE id = ? AND tenant_id = ?`,
    ).bind(Date.now(), userId, commentId, tenantId),
    // The comment's @-mentions no longer point at live text — retract them.
    deleteMentionsForCommentStmt(env, tenantId, cardId, commentId),
    deleteAttachmentsForEventStmt(env, tenantId, commentId),
  ]);

  const updated = await env.db.prepare('SELECT * FROM card_events WHERE id = ? AND tenant_id = ?')
    .bind(commentId, tenantId)
    .first<CardEventRow>();
  if (!updated) throw new HttpError(500, 'Redaction did not return row');
  return { event: toDto(updated), blobKeys };
}
