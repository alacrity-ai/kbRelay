/**
 * Global quick-find (v0.17.0, KBR-68) — GET /v1/search?q=&limit=&archived=.
 * Tenant-wide, RBAC-filtered to the caller's accessible projects. Matches
 * ticket keys, project name/code, and card summary/description/acceptance
 * criteria (KBR-130 widened this from summary-only). Comments stay out.
 * `archived=1` includes archived cards (default excludes them).
 */

/** Which card field the query matched (KBR-130). Ranked in this order. */
export type CardMatchField = 'key' | 'summary' | 'description' | 'acceptanceCriteria';

/**
 * Snippet sentinel (KBR-130): the matched span in `snippet` is wrapped in
 * U+0001 … U+0001 — a control char that cannot occur in card text — so the
 * client does `snippet.split(SNIPPET_MARK)` → [before, match, after] with no
 * HTML in the wire layer and no escaping.
 */
export const SNIPPET_MARK = '\u0001';

export interface CardSearchHit {
  kind: 'card';
  id: string;
  /** Human ticket key ("KBR-12"); null if the project pre-dates codes. */
  key: string | null;
  summary: string;
  projectId: string;
  projectCode: string | null;
  projectName: string;
  /** Where the card currently sits — status at a glance. */
  columnName: string;
  /** Which field the query hit (KBR-130). */
  matchedField: CardMatchField;
  /** Excerpt around the match with the term wrapped in {@link SNIPPET_MARK};
   *  null for key/summary hits (the summary is already shown). */
  snippet: string | null;
  /** True if the card is archived (KBR-130) — only present when the caller
   *  opted into archived results. */
  archived: boolean;
}

export interface ProjectSearchHit {
  kind: 'project';
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}

export type SearchHit = CardSearchHit | ProjectSearchHit;

/**
 * One page of results (KBR-133). `nextOffset` is server-issued — clients must
 * pass it back verbatim and never derive the next offset from how many rows
 * they rendered (client-side dedupe makes those diverge when a row moves
 * between pages). Invariant: `hasMore === (nextOffset !== null)`. `truncated`
 * is distinct from exhaustion: matches exist past SEARCH_MAX_RESULTS, but the
 * window is closed — refine the query.
 */
export interface SearchResponse {
  hits: SearchHit[];
  hasMore: boolean;
  nextOffset: number | null;
  truncated: boolean;
}

/** Minimum query length the endpoint accepts (400 below it). */
export const SEARCH_MIN_QUERY = 2;

/** Page size the QuickFind modal requests (server default stays 20). */
export const SEARCH_PAGE_SIZE = 50;

/**
 * The result window (KBR-133): pagination may walk at most this many merged
 * hits. Offsets >= this are rejected with 400 (never clamped — a silently
 * clamped offset returns a valid-looking but wrong page).
 */
export const SEARCH_MAX_RESULTS = 1000;
