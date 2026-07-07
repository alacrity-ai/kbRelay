import { useMemo, useState } from 'react';
import type { ProjectDto } from '@kbrelay/shared';

/**
 * The per-member/agent project checklist, shared by Team & access (People) and
 * the Agents modal. Local edit state; "Save" replaces the set. The caller's
 * `projects` prop is already RBAC-scoped (listProjects), so a member only ever
 * sees — and can only toggle — projects they can access; the server enforces
 * the same boundary (KBR-115).
 */
export default function ProjectAccessEditor({
  initialIds,
  projects,
  busy,
  onSave,
}: {
  initialIds: string[];
  projects: ProjectDto[];
  busy: boolean;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  const [q, setQ] = useState('');
  const dirty =
    selected.size !== initialIds.length || initialIds.some((id) => !selected.has(id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  // Filtering is display-only: `selected` holds the full set independent of what's
  // shown, and Save sends [...selected], so hidden-but-checked projects are kept.
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n
      ? projects.filter((p) => p.name.toLowerCase().includes(n) || (p.code ?? '').toLowerCase().includes(n))
      : projects;
  }, [projects, q]);

  return (
    <div className="member-projects">
      {projects.length === 0 ? (
        <span className="muted-note">No projects yet.</span>
      ) : (
        <>
          {projects.length > 8 && (
            <input
              className="project-checks-filter"
              value={q}
              placeholder="Filter by name or code…"
              onChange={(e) => setQ(e.target.value)}
              disabled={busy}
            />
          )}
          <div className="project-checks">
            {filtered.length === 0 ? (
              <span className="muted-note">No matches.</span>
            ) : (
              filtered.map((p) => (
                <label key={p.id} className="project-check">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={busy} />
                  <span className="project-dot" style={{ background: p.color ?? 'var(--accent)' }} />
                  {p.code && <span className="project-code">{p.code}</span>}
                  {p.name}
                </label>
              ))
            )}
          </div>
        </>
      )}
      <div className="member-projects-actions">
        <button className="primary sm" disabled={!dirty || busy} onClick={() => void onSave([...selected])}>
          Save access
        </button>
      </div>
    </div>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2);
  return chars.toUpperCase();
}
