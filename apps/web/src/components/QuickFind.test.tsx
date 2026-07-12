import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { CardSearchHit, SearchHit, SearchResponse } from '@kbrelay/shared';
import { SEARCH_PAGE_SIZE } from '@kbrelay/shared';
import QuickFind from './QuickFind';

vi.mock('../lib/api', () => ({ search: vi.fn() }));
import * as api from '../lib/api';
const searchMock = api.search as unknown as Mock;

/**
 * QuickFind pagination behavior (KBR-133): first page size, stage-aligned
 * section order, sentinel-driven appends with the SERVER's nextOffset,
 * render-only dedupe, single-dispatch gating, stale-page drops, explicit
 * retry, and the truncation terminal row.
 */

const card = (id: string, over: Partial<CardSearchHit> = {}): CardSearchHit => ({
  kind: 'card', id, key: `PAG-${id}`, summary: `Card ${id}`, projectId: 'p1',
  projectCode: 'PAG', projectName: 'Pagination', columnName: 'Backlog',
  matchedField: 'summary', snippet: null, archived: false, ...over,
});
const page = (hits: SearchHit[], over: Partial<SearchResponse> = {}): SearchResponse => ({
  hits, hasMore: false, nextOffset: null, truncated: false, ...over,
});

/** Controllable IntersectionObserver: tests fire intersections by hand. */
class MockIO {
  static instances: MockIO[] = [];
  constructor(private cb: IntersectionObserverCallback) { MockIO.instances.push(this); }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  root = null; rootMargin = ''; thresholds = [];
  static intersectLatest() {
    const io = MockIO.instances[MockIO.instances.length - 1]!;
    io.cb([{ isIntersecting: true } as IntersectionObserverEntry], io as unknown as IntersectionObserver);
  }
}

function mount() {
  return render(
    <QuickFind recentProjects={[]} onPickProject={() => {}} onPickCard={() => {}} onClose={() => {}} />,
  );
}

async function typeAndSettle(value: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  await waitFor(() => expect(searchMock).toHaveBeenCalled());
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIO as unknown as typeof IntersectionObserver);
  MockIO.instances = [];
  searchMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('QuickFind pagination', () => {
  it('requests the first page at SEARCH_PAGE_SIZE and renders stage-aligned sections in server rank', async () => {
    searchMock.mockResolvedValue(page([
      card('k1', { matchedField: 'key' }),
      { kind: 'project', id: 'pr1', name: 'Pagination', code: 'PAG', color: null },
      card('b1', { summary: 'Body hit' }),
    ]));
    mount();
    await typeAndSettle('pag');
    expect(searchMock).toHaveBeenCalledWith('pag', { limit: SEARCH_PAGE_SIZE, archived: false });

    await screen.findByText('Body hit');
    const labels = screen.getAllByText(/Ticket matches|Projects|Card content/).map((el) => el.textContent);
    expect(labels).toEqual(['Ticket matches', 'Projects', 'Card content']);
    // Visual order matches server rank: key card above project above body card.
    const text = document.querySelector('.qf-results')!.textContent!;
    expect(text.indexOf('Card k1')).toBeLessThan(text.indexOf('Pagination'));
    expect(text.indexOf('Pagination')).toBeLessThan(text.indexOf('Body hit'));
  });

  it('appends the next page via the sentinel using the SERVER nextOffset, deduping moved rows', async () => {
    const page1 = page(
      Array.from({ length: 3 }, (_, i) => card(`a${i}`)),
      { hasMore: true, nextOffset: 50 },
    );
    // Page 2 re-serves a3 → a2 (moved row) plus new rows; cursor should still
    // advance by the server's nextOffset (100), not the rendered count.
    const page2 = page([card('a2'), card('n1'), card('n2')], { hasMore: true, nextOffset: 100 });
    searchMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2).mockResolvedValue(page([]));

    mount();
    await typeAndSettle('pag');
    await screen.findByText('Card a0');

    MockIO.intersectLatest();
    await screen.findByText('Card n2');
    expect(searchMock).toHaveBeenNthCalledWith(2, 'pag', { limit: SEARCH_PAGE_SIZE, offset: 50, archived: false });
    // a2 deduped: rendered once even though both pages contained it.
    expect(screen.getAllByText('Card a2')).toHaveLength(1);
    // Append-only: page-1 rows keep their order ahead of page-2 rows.
    const text = document.querySelector('.qf-results')!.textContent!;
    expect(text.indexOf('Card a0')).toBeLessThan(text.indexOf('Card n1'));

    MockIO.intersectLatest();
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(3));
    expect(searchMock).toHaveBeenNthCalledWith(3, 'pag', { limit: SEARCH_PAGE_SIZE, offset: 100, archived: false });
  });

  it('dispatches exactly one page for stacked intersections while a request is in flight', async () => {
    let releasePage2!: (r: SearchResponse) => void;
    searchMock
      .mockResolvedValueOnce(page([card('a1')], { hasMore: true, nextOffset: 50 }))
      .mockImplementationOnce(() => new Promise((res) => { releasePage2 = res; }));

    mount();
    await typeAndSettle('pag');
    await screen.findByText('Card a1');

    MockIO.intersectLatest();
    MockIO.intersectLatest();
    MockIO.intersectLatest();
    expect(searchMock).toHaveBeenCalledTimes(2); // first page + ONE page load

    releasePage2(page([card('a2')]));
    await screen.findByText('Card a2');
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a stale page completion after the query changes', async () => {
    let releaseOldPage!: (r: SearchResponse) => void;
    searchMock
      .mockResolvedValueOnce(page([card('old1')], { hasMore: true, nextOffset: 50 }))
      .mockImplementationOnce(() => new Promise((res) => { releaseOldPage = res; }))
      .mockResolvedValue(page([card('new1')]));

    mount();
    await typeAndSettle('pag');
    await screen.findByText('Card old1');
    MockIO.intersectLatest(); // old page 2 now in flight

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'fresh' } });
    await screen.findByText('Card new1');

    releaseOldPage(page([card('stale1')], { hasMore: true, nextOffset: 100 }));
    await waitFor(() => expect(screen.queryByText('Card stale1')).toBeNull());
    expect(screen.queryByText('Card old1')).toBeNull();
  });

  it('shows an explicit retry on load failure (no auto-retry) and recovers on click', async () => {
    searchMock
      .mockResolvedValueOnce(page([card('a1')], { hasMore: true, nextOffset: 50 }))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page([card('a2')]));

    mount();
    await typeAndSettle('pag');
    await screen.findByText('Card a1');

    MockIO.intersectLatest();
    const retry = await screen.findByText(/retry/i);
    expect(searchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(retry);
    await screen.findByText('Card a2');
    expect(searchMock).toHaveBeenCalledTimes(3);
  });

  it('renders the truncation terminal row distinctly from exhaustion', async () => {
    searchMock.mockResolvedValue(page([card('a1')], { truncated: true }));
    mount();
    await typeAndSettle('pag');
    await screen.findByText(/first 1,000 results/);
    expect(document.querySelector('[data-testid="qf-sentinel"]')).toBeNull();
  });
});
