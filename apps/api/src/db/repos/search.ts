import type { Env } from '../../env';
import type { CardSearchHit, ProjectSearchHit, SearchHit } from '@kbrelay/shared';

/**
 * Global quick-find (v0.17.0, KBR-68). Three cheap LIKE probes, merged and
 * ranked in code: exact/prefix ticket key first, then project name/code hits,
 * then card-summary substring hits. RBAC is applied IN the SQL (member ⇒ only
 * `project_access` projects), never by post-filtering, so a capped page can't
 * leak or starve. No FTS — LIKE until it visibly hurts.
 */

interface CardHitRow {
  id: string;
  seq: number | null;
  summary: string;
  project_id: string;
  project_code: string | null;
  project_name: string;
  column_name: string;
}

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

function cardHit(r: CardHitRow): CardSearchHit {
  return {
    kind: 'card',
    id: r.id,
    key: r.project_code && r.seq != null ? `${r.project_code}-${r.seq}` : null,
    summary: r.summary,
    projectId: r.project_id,
    projectCode: r.project_code,
    projectName: r.project_name,
    columnName: r.column_name,
  };
}

export async function searchTenant(
  env: Env,
  tenantId: string,
  q: string,
  access: { userId: string; isAdmin: boolean },
  limitArg?: number,
): Promise<SearchHit[]> {
  const limit = Math.min(Math.max(Math.trunc(limitArg ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  // RBAC in-query: members only see granted projects; admins see the tenant.
  const accessClause = access.isAdmin
    ? ''
    : ' AND EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = p.id AND pa.user_id = ?)';
  const accessBinds = access.isAdmin ? [] : [access.userId];

  const hits: SearchHit[] = [];
  const seenCards = new Set<string>();

  // 1) Ticket-key probe — "KBR-3" ranks KBR-3 (exact) above KBR-30 (prefix).
  const keyMatch = KEYISH.exec(q.trim());
  if (keyMatch) {
    const code = keyMatch[1]!.toUpperCase();
    const seqPrefix = keyMatch[2]!;
    const rs = await env.db.prepare(
      `SELECT c.id, c.seq, c.summary, c.project_id, p.code AS project_code,
              p.name AS project_name, col.name AS column_name
         FROM cards c
         JOIN projects p ON p.id = c.project_id AND p.tenant_id = c.tenant_id
         JOIN columns col ON col.id = c.column_id AND col.tenant_id = c.tenant_id
        WHERE c.tenant_id = ? AND p.code = ?
          AND CAST(c.seq AS TEXT) LIKE ?${accessClause}
        ORDER BY (CAST(c.seq AS TEXT) = ?) DESC, c.seq ASC
        LIMIT ?`,
    )
      .bind(tenantId, code, `${seqPrefix}%`, ...accessBinds, seqPrefix, limit)
      .all<CardHitRow>();
    for (const r of rs.results ?? []) {
      hits.push(cardHit(r));
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
        ORDER BY p.name ASC
        LIMIT ?`,
    )
      .bind(tenantId, like, codePrefix, ...accessBinds, limit - hits.length)
      .all<ProjectHitRow>();
    for (const r of rs.results ?? []) {
      hits.push({ kind: 'project', id: r.id, name: r.name, code: r.code, color: r.color } satisfies ProjectSearchHit);
    }
  }

  // 3) Card-summary substring probe (newest-touched first).
  if (hits.length < limit) {
    const rs = await env.db.prepare(
      `SELECT c.id, c.seq, c.summary, c.project_id, p.code AS project_code,
              p.name AS project_name, col.name AS column_name
         FROM cards c
         JOIN projects p ON p.id = c.project_id AND p.tenant_id = c.tenant_id
         JOIN columns col ON col.id = c.column_id AND col.tenant_id = c.tenant_id
        WHERE c.tenant_id = ? AND c.summary LIKE ? ESCAPE '\\'${accessClause}
        ORDER BY c.updated_at DESC
        LIMIT ?`,
    )
      .bind(tenantId, like, ...accessBinds, limit - hits.length + seenCards.size)
      .all<CardHitRow>();
    for (const r of rs.results ?? []) {
      if (seenCards.has(r.id)) continue;
      if (hits.length >= limit) break;
      hits.push(cardHit(r));
    }
  }

  return hits;
}
