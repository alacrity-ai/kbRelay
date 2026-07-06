import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { CardLinkDto, CardLinkMatch } from '@kbrelay/shared';
import { newId } from '../ids';

/**
 * Card links (external references). A pointer from a card to an external system
 * (Jira/GitHub/…). Data-only — no bytes — so this is a plain JSON CRUD with the
 * same tenant-scoping + prepared-statement pattern as the other repos. All SQL
 * lives here (the inline-SQL guard forbids it elsewhere).
 */

interface CardLinkRow {
  id: string;
  tenant_id: string;
  card_id: string;
  provider: string;
  external_key: string | null;
  url: string;
  title: string | null;
  created_by: string;
  created_at: number;
}

function toDto(r: CardLinkRow): CardLinkDto {
  return {
    id: r.id,
    cardId: r.card_id,
    provider: r.provider,
    externalKey: r.external_key,
    url: r.url,
    title: r.title,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

/** Fresh card-link id. */
export function newCardLinkId(): string {
  return newId('lnk');
}

// ── writes ─────────────────────────────────────────────────────
export interface CardLinkInsert {
  id: string;
  tenantId: string;
  cardId: string;
  provider: string;
  externalKey?: string | null;
  url: string;
  title?: string | null;
  createdBy: string;
}

/** Prepared INSERT (unexecuted) so it can be composed into a batch. */
export function insertCardLinkStmt(env: Env, l: CardLinkInsert): DbStatement {
  return env.db.prepare(
    `INSERT INTO card_links
       (id, tenant_id, card_id, provider, external_key, url, title, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    l.id,
    l.tenantId,
    l.cardId,
    l.provider,
    l.externalKey ?? null,
    l.url,
    l.title ?? null,
    l.createdBy,
    Date.now(),
  );
}

/** Insert a card-link row → DTO. */
export async function createCardLink(env: Env, l: CardLinkInsert): Promise<CardLinkDto> {
  await env.db.batch([insertCardLinkStmt(env, l)]);
  const row = await getCardLinkRow(env, l.tenantId, l.id);
  if (!row) throw new Error('Card link insert did not return row');
  return toDto(row);
}

// ── reads ──────────────────────────────────────────────────────
export async function getCardLinkRow(env: Env, tenantId: string, id: string): Promise<CardLinkRow | null> {
  return env.db.prepare('SELECT * FROM card_links WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<CardLinkRow>();
}

export async function getCardLink(env: Env, tenantId: string, id: string): Promise<CardLinkDto | null> {
  const row = await getCardLinkRow(env, tenantId, id);
  return row ? toDto(row) : null;
}

/** All links for a card, oldest → newest. */
export async function listCardLinks(env: Env, tenantId: string, cardId: string): Promise<CardLinkDto[]> {
  const rs = await env.db.prepare(
    'SELECT * FROM card_links WHERE tenant_id = ? AND card_id = ? ORDER BY created_at ASC, id ASC',
  )
    .bind(tenantId, cardId)
    .all<CardLinkRow>();
  return (rs.results ?? []).map(toDto);
}

/**
 * Link counts for a set of cards, one grouped query — for the board list badge.
 * Cards with no links are simply absent from the map; callers default them to 0.
 */
export async function linkCountsForCards(
  env: Env,
  tenantId: string,
  cardIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!cardIds.length) return out;
  const placeholders = cardIds.map(() => '?').join(', ');
  const rs = await env.db.prepare(
    `SELECT card_id, COUNT(*) AS n
       FROM card_links
      WHERE tenant_id = ? AND card_id IN (${placeholders})
      GROUP BY card_id`,
  )
    .bind(tenantId, ...cardIds)
    .all<{ card_id: string; n: number }>();
  for (const r of rs.results ?? []) out[r.card_id] = Number(r.n);
  return out;
}

/**
 * Find every card in a project carrying a link with the given provider +
 * external key. JOIN card_links → cards (→ projects for the code, so the human
 * ticket key can be derived), scoped to the tenant + project.
 */
export async function findCardLinksInProject(
  env: Env,
  tenantId: string,
  projectId: string,
  provider: string,
  externalKey: string,
): Promise<CardLinkMatch[]> {
  const rs = await env.db.prepare(
    `SELECT l.id, l.tenant_id, l.card_id, l.provider, l.external_key, l.url, l.title,
            l.created_by, l.created_at,
            c.summary AS card_summary, c.seq AS card_seq, p.code AS project_code
       FROM card_links l
       JOIN cards c    ON c.id = l.card_id AND c.tenant_id = l.tenant_id
       JOIN projects p ON p.id = c.project_id AND p.tenant_id = c.tenant_id
      WHERE l.tenant_id = ? AND c.project_id = ? AND l.provider = ? AND l.external_key = ?
      ORDER BY l.created_at ASC, l.id ASC`,
  )
    .bind(tenantId, projectId, provider, externalKey)
    .all<CardLinkRow & { card_summary: string; card_seq: number | null; project_code: string | null }>();
  return (rs.results ?? []).map((r) => ({
    cardId: r.card_id,
    cardKey: r.project_code && r.card_seq != null ? `${r.project_code}-${r.card_seq}` : null,
    cardSummary: r.card_summary,
    link: toDto(r),
  }));
}

// ── deletes + cascade helpers ──────────────────────────────────
export function deleteCardLinkStmt(env: Env, tenantId: string, id: string): DbStatement {
  return env.db.prepare('DELETE FROM card_links WHERE tenant_id = ? AND id = ?').bind(tenantId, id);
}
