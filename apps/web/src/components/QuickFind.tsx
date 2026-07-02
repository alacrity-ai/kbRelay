import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDto, SearchHit } from '@kbrelay/shared';
import * as api from '../lib/api';

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
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);

  useEffect(() => inputRef.current?.focus(), []);

  // Debounced server search; a stale response never clobbers a newer one.
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
      api.search(query)
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
  }, [q]);

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
          <span className="qf-text">{p.name}</span>
          <span className="qf-hint">board</span>
        </button>
      );
    }
    const h = row.hit;
    return (
      <button key={`c-${h.id}`} className={cls} onMouseEnter={() => setActive(i)} onClick={() => pick(row)}>
        <span className="qf-code">{h.key ?? '—'}</span>
        <span className="qf-text">{h.summary}</span>
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
