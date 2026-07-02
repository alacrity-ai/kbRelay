import { useEffect, useState } from 'react';
import type { CardDto, UserDto } from '@kbrelay/shared';

/** A client-side board filter. Empty facets mean "show all". */
export interface BoardFilter {
  assignees: string[]; // show only cards assigned to these users; [] = all
  reviewers: string[]; // show only cards awaiting review by these users (v0.17.0); [] = all
  query: string; // show only cards whose summary/key contains this (case-insensitive); '' = all
}

export const EMPTY_FILTER: BoardFilter = { assignees: [], reviewers: [], query: '' };

export function isFilterActive(f: BoardFilter): boolean {
  return f.assignees.length > 0 || f.reviewers.length > 0 || f.query.trim() !== '';
}

/** How many facets are active — shown as a badge on the filter button. */
export function filterCount(f: BoardFilter): number {
  return f.assignees.length + f.reviewers.length + (f.query.trim() ? 1 : 0);
}

export function cardMatchesFilter(card: CardDto, f: BoardFilter): boolean {
  if (f.assignees.length > 0 && (!card.assigneeUserId || !f.assignees.includes(card.assigneeUserId))) {
    return false;
  }
  if (f.reviewers.length > 0 && (!card.reviewerUserId || !f.reviewers.includes(card.reviewerUserId))) {
    return false;
  }
  const q = f.query.trim().toLowerCase();
  if (q && !card.summary.toLowerCase().includes(q) && !(card.key ?? '').toLowerCase().includes(q)) return false;
  return true;
}

/**
 * Filter picker. Edits a local working copy; every close path (✕, backdrop, Esc,
 * Enter, Apply) commits it via onApply. Clear empties the filter and closes.
 */
export default function FilterModal({
  users,
  meId,
  initial,
  onApply,
  onClear,
}: {
  users: UserDto[];
  meId: string;
  initial: BoardFilter;
  onApply: (f: BoardFilter) => void;
  onClear: () => void;
}) {
  const [assignees, setAssignees] = useState<string[]>(initial.assignees);
  const [reviewers, setReviewers] = useState<string[]>(initial.reviewers);
  const [query, setQuery] = useState(initial.query);

  const apply = () => onApply({ assignees, reviewers, query: query.trim() });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onApply({ assignees, reviewers, query: query.trim() }); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [assignees, reviewers, query, onApply]);

  function toggle(id: string) {
    setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  function toggleReviewer(id: string) {
    setReviewers((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }

  return (
    <div className="dialog-backdrop" onClick={apply}>
      <div className="filter-modal" role="dialog" aria-modal="true" aria-labelledby="filter-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="filter-title">Filter cards</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={apply} aria-label="Apply and close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="view-section">
            <div className="filter-section-head">
              <span className="view-label">Assignee</span>
              <button className="subtle filter-mine" onClick={() => setAssignees([meId])}>My tickets only</button>
            </div>
            <div className="filter-users">
              {users.map((u) => (
                <label className="filter-user-row" key={u.id}>
                  <input type="checkbox" checked={assignees.includes(u.id)} onChange={() => toggle(u.id)} />
                  <span className="dot" style={{ background: u.color }} />
                  <span className="filter-user-name">{u.name}{u.id === meId ? ' (You)' : ''}</span>
                  <span className={`kind-badge ${u.kind}`}>{u.kind}</span>
                </label>
              ))}
            </div>
            <p className="muted-note">No one selected = show all assignees.</p>
          </div>

          <div className="view-section">
            <div className="filter-section-head">
              <span className="view-label">Reviewer</span>
              <button className="subtle filter-mine" onClick={() => setReviewers([meId])}>Awaiting my review</button>
            </div>
            <div className="filter-users">
              {users.map((u) => (
                <label className="filter-user-row" key={u.id}>
                  <input type="checkbox" checked={reviewers.includes(u.id)} onChange={() => toggleReviewer(u.id)} />
                  <span className="dot" style={{ background: u.color }} />
                  <span className="filter-user-name">{u.name}{u.id === meId ? ' (You)' : ''}</span>
                  <span className={`kind-badge ${u.kind}`}>{u.kind}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Summary or key contains</label>
            <input
              value={query}
              placeholder="keyword or OBL-3…"
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="ghost" onClick={onClear}>Clear</button>
          <div className="spacer" />
          <button className="primary" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  );
}
