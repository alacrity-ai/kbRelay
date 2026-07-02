import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { MentionDto, MentionSourceKind, MentionsStatus, WebhookTrigger } from '@kbrelay/shared';
import { resolveMentionRecipients, diffRecipients } from '@kbrelay/shared';
import { newId } from '../ids';

/**
 * Mentions are a live projection of text. `reconcileMentionStmts` reads the
 * current recipients for a location, diffs them against the handles present in
 * the new text (via the pure helpers in @kbrelay/shared), and returns INSERT/
 * DELETE statements to bring the store into line — composed into the SAME
 * `env.db.batch([...])` as the card/comment write so text and its mentions move
 * together. Survivors are left untouched, preserving their read-state.
 */
export async function reconcileMentionStmts(
  env: Env,
  opts: {
    tenantId: string;
    cardId: string;
    authorId: string;
    sourceKind: MentionSourceKind;
    /** Field literal for card fields; the card_events id for comments. */
    sourceId: string;
    text: string | null | undefined;
  },
  users: ReadonlyArray<{ id: string; handle: string | null; kind?: string }>,
  /** Optional collector: a `card.mention` trigger is pushed per newly-added agent recipient (KBR-14). */
  triggers?: WebhookTrigger[],
): Promise<DbStatement[]> {
  const wanted = resolveMentionRecipients(opts.text, users, opts.authorId);

  const existingRs = await env.db.prepare(
    `SELECT recipient_user_id FROM card_mentions
      WHERE tenant_id = ? AND card_id = ? AND source_kind = ? AND source_id = ?`,
  )
    .bind(opts.tenantId, opts.cardId, opts.sourceKind, opts.sourceId)
    .all<{ recipient_user_id: string }>();
  const existing = (existingRs.results ?? []).map((r) => r.recipient_user_id);

  const { add, remove } = diffRecipients(wanted, existing);

  // Fire a callback for each freshly-added mention whose recipient is an agent.
  if (triggers && add.length) {
    const agentIds = new Set(users.filter((u) => u.kind === 'agent').map((u) => u.id));
    for (const recipientId of add) {
      if (agentIds.has(recipientId)) {
        triggers.push({
          event: 'card.mention',
          recipientUserId: recipientId,
          source: {
            kind: 'mention',
            location: opts.sourceKind,
            commentId: opts.sourceKind === 'comment' ? opts.sourceId : null,
          },
        });
      }
    }
  }

  const stmts: DbStatement[] = [];
  const now = Date.now();

  for (const recipientId of add) {
    stmts.push(
      env.db.prepare(
        `INSERT INTO card_mentions
           (id, tenant_id, card_id, recipient_user_id, author_user_id, source_kind, source_id, created_at, read_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      ).bind(
        newId('men'),
        opts.tenantId,
        opts.cardId,
        recipientId,
        opts.authorId,
        opts.sourceKind,
        opts.sourceId,
        now,
      ),
    );
  }
  if (remove.length > 0) {
    const placeholders = remove.map(() => '?').join(', ');
    stmts.push(
      env.db.prepare(
        `DELETE FROM card_mentions
          WHERE tenant_id = ? AND card_id = ? AND source_kind = ? AND source_id = ?
            AND recipient_user_id IN (${placeholders})`,
      ).bind(opts.tenantId, opts.cardId, opts.sourceKind, opts.sourceId, ...remove),
    );
  }
  return stmts;
}

/** Delete every mention on a card (all fields + all comments) — for card delete. */
export function deleteMentionsForCardStmt(
  env: Env,
  tenantId: string,
  cardId: string,
): DbStatement {
  return env.db.prepare('DELETE FROM card_mentions WHERE tenant_id = ? AND card_id = ?').bind(
    tenantId,
    cardId,
  );
}

/** Delete a single comment's mentions — for the (upcoming) comment-delete path. */
export function deleteMentionsForCommentStmt(
  env: Env,
  tenantId: string,
  cardId: string,
  commentId: string,
): DbStatement {
  return env.db.prepare(
    `DELETE FROM card_mentions
      WHERE tenant_id = ? AND card_id = ? AND source_kind = 'comment' AND source_id = ?`,
  ).bind(tenantId, cardId, commentId);
}

interface MentionJoinRow {
  id: string;
  card_id: string;
  author_user_id: string;
  source_kind: string;
  source_id: string;
  created_at: number;
  read_at: number | null;
  card_summary: string;
  card_seq: number | null;
  project_id: string;
  project_code: string | null;
  project_name: string;
  excerpt: string | null;
}

function toMentionDto(r: MentionJoinRow): MentionDto {
  const kind = r.source_kind as MentionSourceKind;
  return {
    id: r.id,
    cardId: r.card_id,
    cardKey: r.project_code && r.card_seq != null ? `${r.project_code}-${r.card_seq}` : null,
    cardSummary: r.card_summary,
    projectId: r.project_id,
    projectCode: r.project_code,
    projectName: r.project_name,
    source: { kind, commentId: kind === 'comment' ? r.source_id : null },
    excerpt: r.excerpt ?? '',
    authorUserId: r.author_user_id,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

/** Count of the caller's unread mentions (the bell badge). */
export async function unreadMentionCount(
  env: Env,
  tenantId: string,
  userId: string,
): Promise<number> {
  const r = await env.db.prepare(
    'SELECT COUNT(*) AS n FROM card_mentions WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL',
  )
    .bind(tenantId, userId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/**
 * The caller's mentions, tenant-wide, unread first then newest first. `excerpt`
 * is derived live from the card field / comment body so it never goes stale.
 */
export async function listMentions(
  env: Env,
  tenantId: string,
  userId: string,
  status: MentionsStatus,
  isAdmin = false,
): Promise<{ mentions: MentionDto[]; unreadCount: number }> {
  const where = ['m.tenant_id = ?', 'm.recipient_user_id = ?'];
  if (status === 'unread') where.push('m.read_at IS NULL');
  else if (status === 'read') where.push('m.read_at IS NOT NULL');
  // RBAC: a member only sees mentions on cards in projects they can access
  // (a mention whose project access was later revoked drops out). Admins: all.
  if (!isAdmin) {
    where.push(
      'EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = p.id AND pa.user_id = m.recipient_user_id)',
    );
  }
  const limit = status === 'unread' ? '' : ' LIMIT 100';

  const rs = await env.db.prepare(
    `SELECT m.id, m.card_id, m.author_user_id, m.source_kind, m.source_id, m.created_at, m.read_at,
            c.summary AS card_summary, c.seq AS card_seq,
            p.id AS project_id, p.code AS project_code, p.name AS project_name,
            CASE m.source_kind
              WHEN 'summary'             THEN c.summary
              WHEN 'description'         THEN c.description
              WHEN 'acceptance_criteria' THEN c.acceptance_criteria
              WHEN 'comment'             THEN (SELECT e.body FROM card_events e WHERE e.id = m.source_id)
            END AS excerpt
       FROM card_mentions m
       JOIN cards c    ON c.id = m.card_id
       JOIN projects p ON p.id = c.project_id
      WHERE ${where.join(' AND ')}
      ORDER BY (m.read_at IS NULL) DESC, m.created_at DESC${limit}`,
  )
    .bind(tenantId, userId)
    .all<MentionJoinRow>();

  return {
    mentions: (rs.results ?? []).map(toMentionDto),
    unreadCount: await unreadMentionCount(env, tenantId, userId),
  };
}

/** Mark the caller's mentions read (specific ids or all). Returns new unread count. */
export async function markMentionsRead(
  env: Env,
  tenantId: string,
  userId: string,
  input: { mentionIds?: string[]; all?: boolean },
): Promise<number> {
  const now = Date.now();
  if (input.all) {
    await env.db.prepare(
      'UPDATE card_mentions SET read_at = ? WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL',
    )
      .bind(now, tenantId, userId)
      .run();
  } else if (input.mentionIds && input.mentionIds.length > 0) {
    const placeholders = input.mentionIds.map(() => '?').join(', ');
    await env.db.prepare(
      `UPDATE card_mentions SET read_at = ?
        WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL AND id IN (${placeholders})`,
    )
      .bind(now, tenantId, userId, ...input.mentionIds)
      .run();
  }
  return unreadMentionCount(env, tenantId, userId);
}
