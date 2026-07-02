import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { CardEventDto, CardEventKind, SystemEventType, CreateCommentInput, WebhookTrigger } from '@kbrelay/shared';
import { classifyRedaction } from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { mentionableUsers } from './users';
import { reconcileMentionStmts, deleteMentionsForCommentStmt } from './mentions';
import {
  linkAttachmentsToEventStmt,
  blobKeysForEvent,
  deleteAttachmentsForEventStmt,
  purgeBlobs,
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
  authorUserId: string;
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

/** All timeline entries for a card, oldest → newest (a log reads top-down). */
export async function listTimeline(
  env: Env,
  tenantId: string,
  cardId: string,
): Promise<CardEventDto[]> {
  const rs = await env.db.prepare(
    'SELECT * FROM card_events WHERE card_id = ? AND tenant_id = ? ORDER BY created_at ASC, id ASC',
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
export async function redactComment(
  env: Env,
  tenantId: string,
  cardId: string,
  commentId: string,
  userId: string,
): Promise<CardEventDto> {
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
  if (verdict.alreadyRedacted) return toDto(row); // idempotent no-op

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
  await purgeBlobs(env, blobKeys);

  const updated = await env.db.prepare('SELECT * FROM card_events WHERE id = ? AND tenant_id = ?')
    .bind(commentId, tenantId)
    .first<CardEventRow>();
  if (!updated) throw new HttpError(500, 'Redaction did not return row');
  return toDto(updated);
}
