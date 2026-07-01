/**
 * User colors — shared by the API (fallback at read time) and the web client
 * (rendering) so the two never disagree on what color a user is.
 *
 * A card's display color is its assignee's color; unassigned cards use
 * UNASSIGNED_COLOR. Users may set their own color via PATCH /api/v1/me; anyone
 * without an explicit color gets a stable, deterministic one from the palette.
 */

/** The pickable palette. First entries match seeded identities' vibe. */
export const USER_PALETTE = [
  '#3b82f6', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
] as const;

/** Neutral gray for cards with no assignee. */
export const UNASSIGNED_COLOR = '#64748b';

/** Deterministic palette color for a user id — stable across API + web. */
export function colorForUser(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return USER_PALETTE[h % USER_PALETTE.length]!;
}
