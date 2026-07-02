import { dueState, type DueState } from '@kbrelay/shared';

/**
 * Due-date display helpers (v0.17.0, KBR-63). Dates are stored as epoch ms but
 * picked day-granular: a chosen date maps to the END of that local day, so a
 * card due "today" doesn't read as overdue until the day is actually over.
 */

/** "Jul 4", with the year appended only when it isn't the current one. */
export function formatDue(dueAt: number, now: number): string {
  const d = new Date(dueAt);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Chip modifier class for a due timestamp ('' | 'soon' | 'overdue'). */
export function dueClass(dueAt: number, now: number): '' | DueState {
  const s = dueState(dueAt, now);
  return s === 'normal' ? '' : s;
}

/** `<input type="date">` value (YYYY-MM-DD, local) for a stored timestamp. */
export function dueInputValue(dueAt: number | null): string {
  if (dueAt == null) return '';
  const d = new Date(dueAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Stored timestamp for a picked YYYY-MM-DD: end of that local day. '' → null. */
export function dueAtFromInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, 23, 59, 59, 999).getTime();
}
