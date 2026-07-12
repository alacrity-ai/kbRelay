import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardMatchField, CardSearchHit, ProjectDto, SearchHit } from '@kbrelay/shared';
import { SNIPPET_MARK } from '@kbrelay/shared';
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

/**
 * Global quick-find palette (v0.17.0, KBR-68). Opened via Cmd/Ctrl+K or the
 * topbar search button. Type a ticket key or words; Enter jumps to the card
 * (opens its modal on the right board) or the project. Zero-query state shows
 * recent projects. Search is server-side (`GET /v1/search`), debounced.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);

  useEffect(() => inputRef.current?.focus(), []);

  // Debounced server search; a stale response never clobbers a newer one.
  // Re-runs when the archived toggle flips (it's a search input too).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++seqRef.current;
    const t = setTimeout(() => {
      api.search(query, { archived: includeArchived })
        .then((r) => {
          if (seq !== seqRef.current) return;
          setHits(r.hits);
          setSearching(false);
          setActive(0);
        })
        .catch(() => {
          if (seq === seqRef.current) setSearching(false);
        });
    }, 180);
    return () => clearTimeout(t);
  }, [q, includeArchived]);

  const rows = useMemo<Row[]>(() => {
    if (q.trim().length >= 2) return hits.map((hit) => ({ type: 'hit', hit }));
    return recentProjects.slice(0, 7).map((project) => ({ type: 'recent', project }));
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

  // Group card/project hits for headed sections while keeping one flat index.
  const projectRows = rows.filter((r) => r.type === 'recent' || r.hit.kind === 'project');
  const cardRows = rows.filter((r) => r.type === 'hit' && r.hit.kind === 'card');
  const indexOfRow = (row: Row) => rows.indexOf(row);

  const renderRow = (row: Row) => {
    const i = indexOfRow(row);
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
          {q.trim().length < 2 && projectRows.length > 0 && (
            <div className="qf-section-label">Recent projects</div>
          )}
          {q.trim().length >= 2 && projectRows.length > 0 && (
            <div className="qf-section-label">Projects</div>
          )}
          {projectRows.map(renderRow)}
          {cardRows.length > 0 && <div className="qf-section-label">Cards</div>}
          {cardRows.map(renderRow)}
          {q.trim().length >= 2 && !searching && rows.length === 0 && (
            <div className="qf-empty">No matches for “{q.trim()}”.</div>
          )}
          {searching && rows.length === 0 && <div className="qf-empty">Searching…</div>}
        </div>
        <div className="qf-footer">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
