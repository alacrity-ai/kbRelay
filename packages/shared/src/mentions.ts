import { z } from 'zod';

/**
 * @-mentions (v0.8.0). A mention is a **live projection** of text: the set of
 * mentions for a location always equals the set of distinct users currently
 * @-mentioned there. These pure helpers are the whole heuristic surface —
 * parsing, resolution, and the reconcile diff — so they're unit-testable
 * without a database. The DB layer just applies the diff.
 */

/**
 * A handle token: `@` not preceded by a word char (so `foo@bar` — an email —
 * does NOT match), then a handle starting alphanumeric. Case-insensitive; the
 * captured handle is lowercased by the parser.
 */
const HANDLE_RE = /(?:^|[^\w@])@([a-z0-9](?:[a-z0-9_-]{0,30}))/gi;

/** Distinct, lowercased handles mentioned in `text`. Repeats collapse to one — a
 *  handle typed 50× yields a single entry (presence, not count). */
export function parseHandles(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(HANDLE_RE)) out.add(m[1]!.toLowerCase());
  return [...out];
}

/**
 * Resolve the distinct recipient user ids mentioned in `text`: parse handles,
 * map to tenant users by handle, drop unknown handles, and drop the author
 * (no self-mention). Order is not significant (callers treat it as a set).
 */
export function resolveMentionRecipients(
  text: string | null | undefined,
  users: ReadonlyArray<{ id: string; handle: string | null }>,
  authorId: string,
): string[] {
  const handles = parseHandles(text);
  if (handles.length === 0) return [];
  const byHandle = new Map<string, string>();
  for (const u of users) if (u.handle) byHandle.set(u.handle.toLowerCase(), u.id);
  const out = new Set<string>();
  for (const h of handles) {
    const id = byHandle.get(h);
    if (id && id !== authorId) out.add(id);
  }
  return [...out];
}

/**
 * The reconcile diff for one location: which recipients to add and which to
 * remove so the stored set becomes `wanted`. Survivors (`wanted ∩ existing`)
 * appear in neither list — the caller leaves their rows (and read-state) alone.
 */
export function diffRecipients(
  wanted: readonly string[],
  existing: readonly string[],
): { add: string[]; remove: string[] } {
  const w = new Set(wanted);
  const e = new Set(existing);
  return {
    add: [...w].filter((id) => !e.has(id)),
    remove: [...e].filter((id) => !w.has(id)),
  };
}

// ── Wire types ─────────────────────────────────────────────
export type MentionSourceKind = 'summary' | 'description' | 'acceptance_criteria' | 'comment';

/** One place the caller is @-mentioned, with enough context to act on it. */
export interface MentionDto {
  id: string;
  cardId: string;
  /** Human ticket key, e.g. "OBL-2" (may be null on un-keyed legacy cards). */
  cardKey: string | null;
  cardSummary: string;
  projectId: string;
  projectCode: string | null;
  projectName: string;
  /** Where the mention lives; `commentId` is set only for `comment` sources. */
  source: { kind: MentionSourceKind; commentId: string | null };
  /** Live text of the field/comment (derived at read time, never a snapshot). */
  excerpt: string;
  /** Who wrote the mention. */
  authorUserId: string;
  createdAt: number;
  /** Null = unread. */
  readAt: number | null;
}

export interface MentionsResponse {
  mentions: MentionDto[];
  unreadCount: number;
}

export const mentionsStatus = z.enum(['unread', 'read', 'all']);
export type MentionsStatus = z.infer<typeof mentionsStatus>;

/** POST /v1/me/mentions/read — ack specific mentions or all of them. */
export const markMentionsReadInput = z
  .object({
    mentionIds: z.array(z.string().min(1).max(64)).max(500).optional(),
    all: z.boolean().optional(),
  })
  .refine((v) => v.all === true || (Array.isArray(v.mentionIds) && v.mentionIds.length > 0), {
    message: 'Provide a non-empty mentionIds array or all:true',
  });
export type MarkMentionsReadInput = z.infer<typeof markMentionsReadInput>;
