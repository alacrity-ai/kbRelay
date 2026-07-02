import { z } from 'zod';

/**
 * Card timeline — the append-only log that lives beside the card's spec.
 *
 * A row is either a `system` event (auto-emitted on create/move/assign/edit —
 * the durable who-did-what-when history) or a user-authored comment, which is
 * either a plain `note` or a structured `handoff` (the "here's what shipped,
 * how it was verified, what it spun off" hand-back at In Review).
 */

export type CardEventKind = 'system' | 'note' | 'handoff';
/** `reviewer` (v0.17.0): the reviewer pointer changed — meta {from, to}.
 *  `due` (v0.17.0, KBR-63): the due date changed — meta {from, to} epoch ms.
 *  `task` (v0.17.0, KBR-72): a checkbox-only edit — meta {fields, done, total}.
 *  Quieter than `edited`; feed/timeline collapse consecutive runs of these. */
export type SystemEventType = 'created' | 'moved' | 'assigned' | 'edited' | 'reviewer' | 'due' | 'task';

/** Wire shape of a timeline entry (GET /cards/:id/timeline). */
export interface CardEventDto {
  id: string;
  cardId: string;
  authorUserId: string | null;
  kind: CardEventKind;
  /** Set only for `kind: 'system'`. */
  eventType: SystemEventType | null;
  /** Markdown body for note/handoff; null for system events AND redacted comments. */
  body: string | null;
  /** system detail slots (from/to, fields) OR handoff slots (summary/evidence/…).
   *  Null for a redacted comment (content is not retained). */
  meta: Record<string, unknown> | null;
  createdAt: number;
  /** Redaction tombstone: when a comment was soft-deleted, and by whom. Null = live. */
  deletedAt: number | null;
  deletedBy: string | null;
}

/**
 * Project activity feed (v0.17.0, KBR-67): a card event enriched with its
 * card's key + summary, so a feed row is readable without a follow-up lookup.
 * GET /projects/:id/events — newest-first, cursor-paginated.
 */
export interface ProjectEventDto extends CardEventDto {
  /** Human ticket key (e.g. "KBR-12"); null if the project pre-dates codes. */
  cardKey: string | null;
  cardSummary: string;
}

export interface ProjectEventsResponse {
  events: ProjectEventDto[];
  /** Pass back as ?cursor= to fetch the next (older) page. Null = end. */
  nextCursor: string | null;
}

/**
 * Pure guard for comment redaction (v0.9.0). Redaction is append-only-safe:
 * only a comment's own author may redact it, system events are the immutable
 * audit spine, and redacting an already-redacted comment is an idempotent no-op.
 */
export type RedactionError = 'not_comment' | 'not_author';
export function classifyRedaction(
  e: { kind: CardEventKind; authorUserId: string | null; deletedAt?: number | null },
  userId: string,
): { allowed: boolean; alreadyRedacted: boolean; error: RedactionError | null } {
  if (e.kind === 'system') return { allowed: false, alreadyRedacted: false, error: 'not_comment' };
  if (e.authorUserId !== userId) return { allowed: false, alreadyRedacted: false, error: 'not_author' };
  return { allowed: true, alreadyRedacted: e.deletedAt != null, error: null };
}

/** Structured slots on a handoff comment. All optional. */
export const handoffMeta = z
  .object({
    summary: z.string().max(2_000).optional(),
    evidence: z.array(z.string().max(500)).max(50).optional(),
    verify: z.array(z.string().max(500)).max(50).optional(),
    spunOff: z.array(z.string().max(120)).max(50).optional(),
  })
  .strict();
export type HandoffMeta = z.infer<typeof handoffMeta>;

/** POST /cards/:id/comments — add a note or a handoff to the timeline.
 *  `type` omitted ⇒ 'note' (defaulted in the handler; kept optional here so the
 *  zod input and output types match). */
export const createCommentInput = z.object({
  type: z.enum(['note', 'handoff']).optional(),
  body: z.string().trim().min(1).max(20_000),
  meta: handoffMeta.optional(), // only meaningful for a handoff
  /** Attachments (v0.16.0) uploaded for this comment; on post they're linked to
   *  the new timeline event. Ignored if they don't belong to this card. */
  attachmentIds: z.array(z.string().min(1).max(64)).max(20).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentInput>;
