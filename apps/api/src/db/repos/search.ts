import type { Env } from '../../env';
import type { CardMatchField, CardSearchHit, ProjectSearchHit, SearchHit } from '@kbrelay/shared';
import { SNIPPET_MARK } from '@kbrelay/shared';

/**
 * Global quick-find (v0.17.0, KBR-68; deepened KBR-130). Three cheap LIKE
 * probes, merged and ranked in code: exact/prefix ticket key first, then
 * project name/code hits, then card hits — now matching summary, description,
 * AND acceptance criteria, with the matched field + an excerpt returned.
 * Archived cards are excluded unless the caller opts in. RBAC is applied IN
 * the SQL (member ⇒ only `project_access` projects), never by post-filtering,
 * so a capped page can't leak or starve. No FTS — LIKE until it visibly hurts.
 */

interface CardHitRow {
  id: string;
  seq: number | null;
  summary: string;
  description: string | null;
  acceptance_criteria: string | null;
  project_id: string;
  project_code: string | null;
  project_name: string;
  column_name: string;
  archived_at: number | null;
}

/** ~60 chars of context on each side of the match. */
const SNIPPET_PAD = 60;

/**
 * Which field the query hit (precedence key > summary > description > AC) and,
 * for body hits, a whitespace-collapsed excerpt with the matched span wrapped
 * in SNIPPET_MARK. Summary/key hits get a null snippet (summary already shown).
 */
function classifyMatch(
  row: CardHitRow,
  q: string,
  isKeyHit: boolean,
): { matchedField: CardMatchField; snippet: string | null } {
  if (isKeyHit) return { matchedField: 'key', snippet: null };
  const needle = q.toLowerCase();
  if (row.summary.toLowerCase().includes(needle)) {
    return { matchedField: 'summary', snippet: null };
  }
  for (const [field, text] of [
    ['description', row.description],
    ['acceptanceCriteria', row.acceptance_criteria],
  ] as const) {
    if (text && text.toLowerCase().includes(needle)) {
      return { matchedField: field, snippet: buildSnippet(text, q) };
    }
  }
  // Shouldn't happen (the row matched *some* field in SQL), but stay safe.
  return { matchedField: 'summary', snippet: null };
}

/** Windowed excerpt around the first case-insensitive match of `q` in `text`. */
function buildSnippet(text: string, q: string): string {
  const hit = text.toLowerCase().indexOf(q.toLowerCase());
  if (hit < 0) return collapse(text.slice(0, SNIPPET_PAD * 2)).trimEnd();
  const start = Math.max(0, hit - SNIPPET_PAD);
  const end = Math.min(text.length, hit + q.length + SNIPPET_PAD);
  const before = collapse(text.slice(start, hit));
  const match = text.slice(hit, hit + q.length);
  const after = collapse(text.slice(hit + q.length, end));
  return (
    (start > 0 ? '…' : '') +
    before + SNIPPET_MARK + match + SNIPPET_MARK + after +
    (end < text.length ? '…' : '')
  );
}

const collapse = (s: string) => s.replace(/\s+/g, ' ');

interface ProjectHitRow {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Escape LIKE wildcards in user input; we add our own %…%. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** A query that looks like a ticket key (or its prefix): "KBR-3", "kbr-3". */
const KEYISH = /^([A-Za-z0-9]{2,6})-(\d{1,7})$/;

function cardHit(r: CardHitRow, q: string, isKeyHit: boolean): CardSearchHit {
  const { matchedField, snippet } = classifyMatch(r, q, isKeyHit);
  return {
    kind: 'card',
    id: r.id,
    key: r.project_code && r.seq != null ? `${r.project_code}-${r.seq}` : null,
    summary: r.summary,
    projectId: r.project_id,
    projectCode: r.project_code,
    projectName: r.project_name,
    columnName: r.column_name,
    matchedField,
    snippet,
    archived: r.archived_at != null,
  };
}

/** Card columns every probe selects (kept in sync so classifyMatch has its inputs). */
const CARD_COLS = `c.id, c.seq, c.summary, c.description, c.acceptance_criteria,
              c.project_id, p.code AS project_code, p.name AS project_name,
              col.name AS column_name, c.archived_at`;

export async function searchTenant(
  env: Env,
  tenantId: string,
  q: string,
  access: { userId: string; isAdmin: boolean; includeArchived?: boolean },
  limitArg?: number,
): Promise<SearchHit[]> {
  const limit = Math.min(Math.max(Math.trunc(limitArg ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  // RBAC in-query: members only see granted projects; admins see the tenant.
  const accessClause = access.isAdmin
    ? ''
    : ' AND EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = p.id AND pa.user_id = ?)';
  const accessBinds = access.isAdmin ? [] : [access.userId];
  // Archived cards are excluded unless opted in (KBR-130) — this also closes a
  // latent leak: the old summary probe had no archived filter at all.
  const archivedClause = access.includeArchived ? '' : ' AND c.archived_at IS NULL';

  const hits: SearchHit[] = [];
  const seenCards = new Set<string>();

  // 1) Ticket-key probe — "KBR-3" ranks KBR-3 (exact) above KBR-30 (prefix).
  const keyMatch = KEYISH.exec(q.trim());
  if (keyMatch) {
    const code = keyMatch[1]!.toUpperCase();
    const seqPrefix = keyMatch[2]!;
    const rs = await env.db.prepare(
      `SELECT ${CARD_COLS}
         FROM cards c
         JOIN projects p ON p.id = c.project_id AND p.tenant_id = c.tenant_id
         JOIN columns col ON col.id = c.column_id AND col.tenant_id = c.tenant_id
        WHERE c.tenant_id = ? AND p.code = ?
          AND CAST(c.seq AS TEXT) LIKE ?${archivedClause}${accessClause}
        ORDER BY (CAST(c.seq AS TEXT) = ?) DESC, c.seq ASC, c.id ASC
        LIMIT ?`,
    )
      .bind(tenantId, code, `${seqPrefix}%`, ...accessBinds, seqPrefix, limit)
      .all<CardHitRow>();
    for (const r of rs.results ?? []) {
      hits.push(cardHit(r, q, true));
      seenCards.add(r.id);
    }
  }

  // 2) Project probe — name substring or code prefix (board jumps).
  const like = `%${likeEscape(q.trim())}%`;
  const codePrefix = `${likeEscape(q.trim().toUpperCase())}%`;
  if (hits.length < limit) {
    const rs = await env.db.prepare(
      `SELECT p.id, p.name, p.code, p.color
         FROM projects p
        WHERE p.tenant_id = ? AND (p.name LIKE ? ESCAPE '\\' OR p.code LIKE ? ESCAPE '\\')${accessClause}
        ORDER BY p.name ASC, p.id ASC
        LIMIT ?`,
    )
      .bind(tenantId, like, codePrefix, ...accessBinds, limit - hits.length)
      .all<ProjectHitRow>();
    for (const r of rs.results ?? []) {
      hits.push({ kind: 'project', id: r.id, name: r.name, code: r.code, color: r.color } satisfies ProjectSearchHit);
    }
  }

  // 3) Card body probe — summary / description / acceptance criteria (KBR-130).
  //    Live cards rank above archived; newest-touched first within each.
  if (hits.length < limit) {
    const rs = await env.db.prepare(
      `SELECT ${CARD_COLS}
         FROM cards c
         JOIN projects p ON p.id = c.project_id AND p.tenant_id = c.tenant_id
         JOIN columns col ON col.id = c.column_id AND col.tenant_id = c.tenant_id
        WHERE c.tenant_id = ?
          AND (c.summary LIKE ? ESCAPE '\\'
               OR c.description LIKE ? ESCAPE '\\'
               OR c.acceptance_criteria LIKE ? ESCAPE '\\')${archivedClause}${accessClause}
        ORDER BY (c.archived_at IS NOT NULL) ASC, c.updated_at DESC, c.id ASC
        LIMIT ?`,
    )
      .bind(tenantId, like, like, like, ...accessBinds, limit - hits.length + seenCards.size)
      .all<CardHitRow>();
    for (const r of rs.results ?? []) {
      if (seenCards.has(r.id)) continue;
      if (hits.length >= limit) break;
      hits.push(cardHit(r, q, false));
    }
  }

  return hits;
}
