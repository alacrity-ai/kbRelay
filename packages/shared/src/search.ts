/**
 * Global quick-find (v0.17.0, KBR-68) — GET /v1/search?q=&limit=.
 * Tenant-wide, RBAC-filtered to the caller's accessible projects. v1 scope:
 * ticket-key prefix, card summary substring, and project name/code — NOT
 * descriptions/comments (a later upgrade behind the same endpoint).
 */

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
}

export interface ProjectSearchHit {
  kind: 'project';
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}

export type SearchHit = CardSearchHit | ProjectSearchHit;

export interface SearchResponse {
  hits: SearchHit[];
}

/** Minimum query length the endpoint accepts (400 below it). */
export const SEARCH_MIN_QUERY = 2;
