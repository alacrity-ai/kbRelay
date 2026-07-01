import { describe, it, expect } from 'vitest';
import { rankBetween, RANK_STEP } from './rank';

describe('rankBetween (fractional ordering)', () => {
  it('empty column → STEP', () => {
    expect(rankBetween(null, null)).toBe(RANK_STEP);
  });

  it('append after last → last + STEP', () => {
    expect(rankBetween(1000, null)).toBe(2000);
  });

  it('prepend before first → first - STEP', () => {
    expect(rankBetween(null, 1000)).toBe(0);
  });

  it('between two neighbors → midpoint', () => {
    expect(rankBetween(1000, 2000)).toBe(1500);
  });

  it('midpoint stays strictly between (no collision) across subdivisions', () => {
    const lo = 1000;
    let hi = 2000;
    for (let i = 0; i < 20; i++) {
      const mid = rankBetween(lo, hi);
      expect(mid).toBeGreaterThan(lo);
      expect(mid).toBeLessThan(hi);
      hi = mid; // keep inserting just after lo
    }
  });
});
