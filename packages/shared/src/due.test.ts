import { describe, it, expect } from 'vitest';
import { dueState, DUE_SOON_WINDOW_MS } from './due';

/** Boundary contract for due-date urgency (KBR-63): the API's ?due= filters,
 *  the board chips, and the queue ordering all classify through this one fn. */
describe('dueState', () => {
  const now = 1_800_000_000_000;

  it('is overdue strictly before now', () => {
    expect(dueState(now - 1, now)).toBe('overdue');
    expect(dueState(now - 7 * 24 * 3600 * 1000, now)).toBe('overdue');
  });

  it('a due date of exactly now is soon, not overdue', () => {
    expect(dueState(now, now)).toBe('soon');
  });

  it('is soon inside the 48h window, normal at and past its edge', () => {
    expect(dueState(now + DUE_SOON_WINDOW_MS - 1, now)).toBe('soon');
    expect(dueState(now + DUE_SOON_WINDOW_MS, now)).toBe('normal');
    expect(dueState(now + 30 * 24 * 3600 * 1000, now)).toBe('normal');
  });
});
