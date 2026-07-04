import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDto, ProjectLabelDto } from '@kbrelay/shared';
import { shouldAutofocusInput } from '../lib/autofocus';

/**
 * The top-bar project switcher (KBR-6). A controlled popover (not the shared
 * auto-closing Dropdown, so the filter input can live inside it): a quick-filter
 * text box + up to 8 projects (most-recently-viewed first) + "Browse projects…"
 * (the full modal) + "New project". Enter picks the top match. `projects` is
 * expected already recency-ordered.
 */
const MAX = 8;

export default function ProjectSwitcher({
  projects,
  currentId,
  onSelect,
  onBrowse,
  onNew,
}: {
  projects: ProjectDto[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onBrowse: () => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [labelSel, setLabelSel] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = projects.find((p) => p.id === currentId);

  useEffect(() => {
    if (!open) { setQ(''); setLabelSel(new Set()); return; }
    // Don't grab focus on touch devices — it pops the keyboard (KBR-32).
    if (shouldAutofocusInput()) inputRef.current?.focus();
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Distinct labels present across the projects (the facet filter options).
  const allLabels = useMemo(() => {
    const m = new Map<string, ProjectLabelDto>();
    for (const p of projects) for (const l of p.labels ?? []) if (!m.has(l.id)) m.set(l.id, l);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = projects;
    if (needle) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(needle) || (p.code ?? '').toLowerCase().includes(needle),
      );
    }
    if (labelSel.size) list = list.filter((p) => (p.labels ?? []).some((l) => labelSel.has(l.id)));
    return list.slice(0, MAX);
  }, [projects, q, labelSel]);

  const pick = (id: string) => { setOpen(false); onSelect(id); };

  // How many projects don't fit in the dropdown — surfaced on the Browse entry
  // so it's clear there are more (KBR-33).
  const moreCount = Math.max(0, projects.length - MAX);

  return (
    <div className="dropdown project-switcher" ref={ref}>
      <button
        className="dropdown-trigger project-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch project"
      >
        <span className="project-dot" style={{ background: current?.color ?? 'var(--accent)' }} />
        {current?.code && <span className="project-code">{current.code}</span>}
        <span className="project-current">{current?.name ?? 'Select project'}</span>
        <span className="chevron">▾</span>
      </button>

      {open && (
        <div className="dropdown-panel">
          <div className="switcher-search">
            <input
              ref={inputRef}
              value={q}
              placeholder="Filter projects…"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]) pick(filtered[0].id); }}
            />
          </div>
          {allLabels.length > 0 && (
            <div className="switcher-labels filter-labels">
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
          <div className="menu-list">
            {filtered.length === 0 ? (
              <div className="muted-note switcher-empty">No matches</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  className={`menu-item ${p.id === currentId ? 'active' : ''}`}
                  onClick={() => pick(p.id)}
                >
                  <span className="project-dot" style={{ background: p.color ?? 'var(--accent)' }} />
                  {p.code && <span className="project-code">{p.code}</span>}
                  <span className="switcher-name">{p.name}</span>
                  {typeof p.cardCount === 'number' && <span className="count-badge" title="cards">{p.cardCount}</span>}
                </button>
              ))
            )}
            <div className="menu-divider" />
            <button className="menu-item" onClick={() => { setOpen(false); onBrowse(); }}>
              {moreCount > 0 ? (
                <><span className="count-badge more-count">{moreCount}</span> More projects…</>
              ) : (
                'Browse projects…'
              )}
            </button>
            <button className="menu-item" onClick={() => { setOpen(false); onNew(); }}>+ New project</button>
          </div>
        </div>
      )}
    </div>
  );
}
