import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ColumnDto } from '@kbrelay/shared';
import BoardMinimap, { miniColumns, scrubToScrollLeft, MINI_CARD_CAP } from './BoardMinimap';

afterEach(cleanup);

function col(id: string, color: string | null, name = id): ColumnDto {
  return { id, projectId: 'p', name, color, position: 0, role: null, createdAt: 0 };
}

/** A detached scroll container with the metrics the minimap reads. */
function fakeScroll(scrollWidth: number, clientWidth: number, scrollLeft = 0) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  el.scrollLeft = scrollLeft;
  return { current: el };
}

describe('miniColumns', () => {
  it('caps card rectangles, keeps the true total, and falls back to neutral', () => {
    const out = miniColumns([col('a', '#ff0000'), col('b', null)], { a: 50, b: 2 }, 7);
    expect(out[0]).toMatchObject({ id: 'a', color: '#ff0000', shown: 7, total: 50 });
    expect(out[1]).toMatchObject({ id: 'b', color: '#64748b', shown: 2, total: 2 });
  });
  it('treats a missing count as zero and defaults the cap to MINI_CARD_CAP', () => {
    const out = miniColumns([col('a', null), col('z', null)], { a: 999 });
    expect(out[0]!.shown).toBe(MINI_CARD_CAP);
    expect(out[1]).toMatchObject({ shown: 0, total: 0 });
  });
});

describe('scrubToScrollLeft', () => {
  it('centers the viewport on the cursor and clamps to the scroll range', () => {
    // scrollWidth 1000, client 400 → max scroll 600; fraction .5 → 500 - 200 = 300.
    expect(scrubToScrollLeft(0.5, 1000, 400)).toBe(300);
    expect(scrubToScrollLeft(0, 1000, 400)).toBe(0); // clamps at the low end
    expect(scrubToScrollLeft(1, 1000, 400)).toBe(600); // clamps at the high end
  });
});

describe('<BoardMinimap>', () => {
  it('draws a faithful mini-render when the board overflows', () => {
    const ref = fakeScroll(1200, 400);
    const cols = [col('a', '#ff0000'), col('b', '#00ff00'), col('c', null)];
    const { container } = render(<BoardMinimap scrollRef={ref} columns={cols} counts={{ a: 2, b: 0, c: 20 }} />);
    expect(container.querySelectorAll('.bmini-col').length).toBe(3);
    expect(container.querySelectorAll('.bmini-head').length).toBe(3); // one header per column
    expect(container.querySelectorAll('.bmini-card').length).toBe(2 + 0 + MINI_CARD_CAP); // c capped
    expect(container.querySelector('.bmini-view')).toBeTruthy(); // viewport indicator
    expect(container.querySelector('[role="scrollbar"]')).toBeTruthy();
  });

  it('renders nothing when the board fits (no horizontal overflow)', () => {
    const ref = fakeScroll(400, 400);
    const { container } = render(<BoardMinimap scrollRef={ref} columns={[col('a', null)]} counts={{ a: 1 }} />);
    expect(container.querySelector('.bmini')).toBeNull();
  });
});
