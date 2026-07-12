import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardMatchField, CardSearchHit, ProjectDto, SearchHit } from '@kbrelay/shared';
import { SEARCH_PAGE_SIZE, SNIPPET_MARK } from '@kbrelay/shared';
import * as api from '../lib/api';

/** Human label for a body match; summary/key hits show no badge. */
const FIELD_LABEL: Partial<Record<CardMatchField, string>> = {
  description: 'in description',
  acceptanceCriteria: 'in acceptance criteria',
};

/** Render a snippet: split on the sentinel and mark the middle span. */
function Snippet({ text }: { text: string }) {
  const [before, match, after] = text.split(SNIPPET_MARK);
  if (match === undefined) return <span className="qf-snippet">{text}</span>;
  return (
    <span className="qf-snippet">
      {before}
      <mark className="qf-hit">{match}</mark>
      {after}
    </span>
  );
}

/** A row the keyboard can land on — either a live search hit or a recent project. */
type Row =
  | { type: 'hit'; hit: SearchHit }
  | { type: 'recent'; project: ProjectDto };

/** A row paired with its flat keyboard index, computed once per render. */
type IndexedRow = { row: Row; i: number };

/**
 * Global quick-find palette (v0.17.0, KBR-68; paginated KBR-133). Opened via
 * Cmd/Ctrl+K or the topbar search button. Type a ticket key or words; Enter
 * jumps to the card (opens its modal on the right board) or the project.
 * Zero-query state shows recent projects. Search is server-side
 * (`GET /v1/search`), debounced; more pages load as the list is scrolled
 * (IntersectionObserver sentinel).
 *
 * Pagination invariants (KBR-133):
 * - The cursor is the SERVER's `nextOffset` — never derived from rendered row
 *   count (client dedupe makes those diverge when a row moves between pages).
 * - Sections mirror the server's probe stages (ticket key → projects → card
 *   content), so appended pages can only ever extend the list downward.
 * - Page fetches are bound to the query generation (`seqRef`): a stale page
 *   can neither append rows nor clear a newer request's loading state.
 */
export default function QuickFind({
  recentProjects,
  onPickProject,
  onPickCard,
  onClose,
}: {
  /** Recency-ordered accessible projects (zero-query state shows the top few). */
  recentProjects: ProjectDto[];
  onPickProject: (projectId: string) => void;
  onPickCard: (hit: { projectId: string; cardId: string }) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);
  // Refs, not state: the observer callback and in-flight completions must see
  // current values without waiting for a render.
  const nextOffsetRef = useRef<number | null>(null);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Debounced first page; a stale response never clobbers a newer one.
  // Re-runs when the archived toggle flips (it's a search input too).
  useEffect(() => {
    const query = q.trim();
    const seq = ++seqRef.current; // invalidates any in-flight page loads too
    nextOffsetRef.current = null;
    loadingMoreRef.current = false;
    setHasMore(false);
    setTruncated(false);
    setLoadingMore(false);
    setLoadError(false);
    if (query.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api.search(query, { limit: SEARCH_PAGE_SIZE, archived: includeArchived })
        .then((r) => {
          if (seq !== seqRef.current) return;
          setHits(r.hits);
          nextOffsetRef.current = r.nextOffset;
          setHasMore(r.hasMore);
          setTruncated(r.truncated);
          setSearching(false);
          setActive(0);
        })
        .catch(() => {
          if (seq === seqRef.current) setSearching(false);
        });
    }, 180);
    return () => clearTimeout(t);
  }, [q, includeArchived]);

  // Load the next page. Gated by a ref so stacked observer callbacks can't
  // double-dispatch; completion handling is scoped to the query generation.
  const loadMore = useCallback(() => {
    const query = q.trim();
    const offset = nextOffsetRef.current;
    if (loadingMoreRef.current || offset == null || query.length < 2) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadError(false);
    const seq = seqRef.current;
    api.search(query, { limit: SEARCH_PAGE_SIZE, offset, archived: includeArchived })
      .then((r) => {
        if (seq !== seqRef.current) return; // stale page: drop entirely
        // Dedupe affects RENDERING only — the cursor advances by the server's
        // nextOffset regardless of how many rows survive.
        setHits((prev) => {
          const seen = new Set(prev.map((h) => `${h.kind}:${h.id}`));
          return [...prev, ...r.hits.filter((h) => !seen.has(`${h.kind}:${h.id}`))];
        });
        nextOffsetRef.current = r.nextOffset;
        setHasMore(r.hasMore);
        setTruncated(r.truncated);
      })
      .catch(() => {
        if (seq === seqRef.current) setLoadError(true);
      })
      .finally(() => {
        if (seq === seqRef.current) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      });
  }, [q, includeArchived]);

  // Sentinel: when the bottom row scrolls into view, fetch the next page.
  // On load failure the sentinel is replaced by an explicit retry button —
  // never an auto-retrying intersection loop.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadError, loadMore]);

  // Flat keyboard list in SERVER RANK order — sections mirror the probe
  // stages so pages append without reshuffling anything above them.
  const rows = useMemo<Row[]>(() => {
    if (q.trim().length < 2) {
      return recentProjects.slice(0, 7).map((project) => ({ type: 'recent', project }));
    }
    const cards = hits.filter((h): h is CardSearchHit => h.kind === 'card');
    return [
      ...cards.filter((h) => h.matchedField === 'key'),
      ...hits.filter((h) => h.kind === 'project'),
      ...cards.filter((h) => h.matchedField !== 'key'),
    ].map((hit) => ({ type: 'hit' as const, hit }));
  }, [q, hits, recentProjects]);

  function pick(row: Row) {
    if (row.type === 'recent') onPickProject(row.project.id);
    else if (row.hit.kind === 'project') onPickProject(row.hit.id);
    else onPickCard({ projectId: row.hit.projectId, cardId: row.hit.id });
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && rows[active]) {
      e.preventDefault();
      pick(rows[active]!);
    }
  }

  // Section slices with the flat index computed once (no per-row indexOf).
  const indexed: IndexedRow[] = rows.map((row, i) => ({ row, i }));
  const isCardRow = (r: Row, field: 'key' | 'body'): boolean =>
    r.type === 'hit' && r.hit.kind === 'card' &&
    (field === 'key' ? r.hit.matchedField === 'key' : r.hit.matchedField !== 'key');
  const ticketRows = indexed.filter(({ row }) => isCardRow(row, 'key'));
  const projectRows = indexed.filter(
    ({ row }) => row.type === 'recent' || (row.type === 'hit' && row.hit.kind === 'project'),
  );
  const bodyRows = indexed.filter(({ row }) => isCardRow(row, 'body'));

  const renderRow = ({ row, i }: IndexedRow) => {
    const cls = `qf-row ${i === active ? 'active' : ''}`;
    if (row.type === 'recent' || row.hit.kind === 'project') {
      const p = row.type === 'recent'
        ? { id: row.project.id, name: row.project.name, code: row.project.code, color: row.project.color }
        : (row.hit as { id: string; name: string; code: string | null; color: string | null });
      return (
        <button key={`p-${p.id}`} className={cls} onMouseEnter={() => setActive(i)} onClick={() => pick(row)}>
          <span className="qf-code" style={{ color: p.color ?? undefined }}>{p.code ?? '□'}</span>
          <span className="qf-text"><span className="qf-text-main">{p.name}</span></span>
          <span className="qf-hint">board</span>
        </button>
      );
    }
    const h = row.hit as CardSearchHit;
    const fieldLabel = FIELD_LABEL[h.matchedField];
    return (
      <button key={`c-${h.id}`} className={cls} onMouseEnter={() => setActive(i)} onClick={() => pick(row)}>
        <span className="qf-code">{h.key ?? '—'}</span>
        <span className="qf-text">
          <span className="qf-text-main">
            {h.summary}
            {h.archived && <span className="qf-tag qf-tag-archived">archived</span>}
            {fieldLabel && <span className="qf-tag qf-tag-field">{fieldLabel}</span>}
          </span>
          {h.snippet && <Snippet text={h.snippet} />}
        </span>
        <span className="qf-hint">{h.projectCode ?? h.projectName} · {h.columnName}</span>
      </button>
    );
  };

  const hasQuery = q.trim().length >= 2;
  return (
    <div className="dialog-backdrop qf-backdrop" onClick={onClose}>
      <div className="qf-palette" role="dialog" aria-modal="true" aria-label="Quick find" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="qf-input"
          placeholder="Jump to a card or project…  (KBR-12, “attachments”, project name)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <label className="qf-archived">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived
        </label>
        <div className="qf-results">
          {!hasQuery && projectRows.length > 0 && (
            <div className="qf-section-label">Recent projects</div>
          )}
          {hasQuery && ticketRows.length > 0 && <div className="qf-section-label">Ticket matches</div>}
          {ticketRows.map(renderRow)}
          {hasQuery && projectRows.length > 0 && <div className="qf-section-label">Projects</div>}
          {projectRows.map(renderRow)}
          {bodyRows.length > 0 && <div className="qf-section-label">Card content</div>}
          {bodyRows.map(renderRow)}
          {hasQuery && !searching && rows.length === 0 && (
            <div className="qf-empty">No matches for “{q.trim()}”.</div>
          )}
          {searching && rows.length === 0 && <div className="qf-empty">Searching…</div>}
          {hasQuery && loadError && (
            <button className="qf-load-retry" onClick={loadMore}>
              Couldn’t load more — retry
            </button>
          )}
          {hasQuery && hasMore && !loadError && (
            <div ref={sentinelRef} className="qf-load-more" data-testid="qf-sentinel">
              {loadingMore ? 'Loading more…' : ''}
            </div>
          )}
          {hasQuery && truncated && (
            <div className="qf-truncated">
              Showing the first 1,000 results — refine your search to see the rest.
            </div>
          )}
        </div>
        <div className="qf-footer">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
