/**
 * Due dates (v0.17.0, KBR-63): one nullable `dueAt` timestamp per card.
 * Deliberately minimal — no reminders, no recurrence, no date ranges. The
 * urgency classification lives here so the API's `?due=` filters, the web's
 * board chips, and the queue ordering all agree on what "soon" means.
 */

/** "Due soon" = within the next 48 hours. */
export const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

export type DueState = 'overdue' | 'soon' | 'normal';

/** Classify a due timestamp relative to `now`. Callers suppress the display
 *  entirely for cards in a `done`-role column — done work is never overdue. */
export function dueState(dueAt: number, now: number): DueState {
  if (dueAt < now) return 'overdue';
  if (dueAt < now + DUE_SOON_WINDOW_MS) return 'soon';
  return 'normal';
}
