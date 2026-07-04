import { useEffect, useMemo, useState } from 'react';
import type { ProjectDto, ProjectLabelDto } from '@kbrelay/shared';
import { shouldAutofocusInput } from '../lib/autofocus';

/**
 * Browse Projects modal (KBR-6). A scrollable, filterable list of every project
 * (most-recently-viewed first) with a ticket-count badge per row. Select a row +
 * OK (or double-click) to make it the active board. Admins get a safe delete:
 * a danger panel that requires typing the project's exact name to enable it.
 */
export default function BrowseProjectsModal({
  projects,
  currentId,
  isAdmin,
  onPick,
  onDelete,
  onClose,
}: {
  projects: ProjectDto[];
  currentId: string | null;
  isAdmin: boolean;
  onPick: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [labelSel, setLabelSel] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(currentId);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const allLabels = useMemo(() => {
    const m = new Map<string, ProjectLabelDto>();
    for (const p of projects) for (const l of p.labels ?? []) if (!m.has(l.id)) m.set(l.id, l);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    let list = projects;
    if (n) list = list.filter((p) => p.name.toLowerCase().includes(n) || (p.code ?? '').toLowerCase().includes(n));
    if (labelSel.size) list = list.filter((p) => (p.labels ?? []).some((l) => labelSel.has(l.id)));
    return list;
  }, [projects, q, labelSel]);

  const target = projects.find((p) => p.id === confirmingId) ?? null;

  const confirm = () => { if (sel) { onPick(sel); onClose(); } };

  const beginDelete = (id: string) => { setConfirmingId(id); setConfirmText(''); setError(null); };

  async function doDelete() {
    if (!target || confirmText !== target.name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(target.id);
      if (sel === target.id) setSel(null);
      setConfirmingId(null);
      setConfirmText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog-card wide browse-modal" role="dialog" aria-modal="true" aria-labelledby="browse-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="browse-title">Browse projects</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          <input
            className="browse-search"
            autoFocus={shouldAutofocusInput()}
            value={q}
            placeholder="Filter by name or code…"
            onChange={(e) => setQ(e.target.value)}
          />

          {allLabels.length > 0 && (
            <div className="browse-label-filter filter-labels">
              {allLabels.map((l) => {
                const on = labelSel.has(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`label-chip selectable ${on ? 'active' : ''}`}
                    style={{ background: `${l.color}2b`, color: l.color, borderColor: on ? l.color : `${l.color}66` }}
                    onClick={() => setLabelSel((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="browse-list">
            {filtered.length === 0 ? (
              <div className="muted-note">No matches.</div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className={`browse-row ${p.id === sel ? 'selected' : ''}`}
                  onClick={() => setSel(p.id)}
                  onDoubleClick={() => { onPick(p.id); onClose(); }}
                >
                  <span className="project-dot" style={{ background: p.color ?? 'var(--accent)' }} />
                  {p.code && <span className="project-code">{p.code}</span>}
                  <span className="browse-name">
                    {p.name}
                    {p.id === currentId && <span className="current-tag"> · current</span>}
                  </span>
                  {(p.labels ?? []).length > 0 && (
                    <span className="browse-row-labels filter-labels">
                      {p.labels!.map((l) => (
                        <span key={l.id} className="label-chip" style={{ background: `${l.color}2b`, color: l.color, borderColor: `${l.color}66` }}>
                          {l.name}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="count-badge" title="cards in this project">
                    {p.cardCount ?? 0} {p.cardCount === 1 ? 'card' : 'cards'}
                  </span>
                  {isAdmin && (
                    <button
                      className="ghost sm danger-text browse-del"
                      onClick={(e) => { e.stopPropagation(); beginDelete(p.id); }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {target && (
            <div className="delete-confirm">
              <div className="delete-confirm-head">Delete “{target.name}”?</div>
              <p className="muted-note">
                This permanently removes the project and <strong>all</strong> its columns, cards, and history.
                This cannot be undone. Type <code>{target.name}</code> to confirm.
              </p>
              <input
                autoFocus
                value={confirmText}
                placeholder={target.name}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void doDelete(); }}
              />
              {error && <div className="error-text">{error}</div>}
              <div className="delete-confirm-actions">
                <button className="ghost" onClick={() => setConfirmingId(null)} disabled={busy}>Cancel</button>
                <button className="danger" disabled={confirmText !== target.name || busy} onClick={() => void doDelete()}>
                  {busy ? 'Deleting…' : 'Delete project'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button className="ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="primary" onClick={confirm} disabled={!sel || busy}>OK</button>
        </div>
      </div>
    </div>
  );
}
