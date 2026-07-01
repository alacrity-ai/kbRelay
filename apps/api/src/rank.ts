/**
 * Fractional ranking for drag-and-drop ordering. A card/column's
 * `position` is a REAL; to drop between two neighbors we take their
 * midpoint, so a move rewrites a single row instead of reshuffling a
 * whole column. Ends use ±STEP.
 *
 * Float midpoints give ~50 levels of subdivision before precision runs
 * out — ample for a personal board. If it ever matters, a column can be
 * cheaply re-spaced (out of scope for MVP).
 */
export const RANK_STEP = 1000;

export function rankBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return RANK_STEP;
  if (before == null) return after! - RANK_STEP;
  if (after == null) return before + RANK_STEP;
  return (before + after) / 2;
}
