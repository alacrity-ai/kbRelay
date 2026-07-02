import { useCallback, useEffect, useState } from 'react';
import type { CardDto, ColumnDto, ColumnRole, ProjectDto } from '@kbrelay/shared';
import { USER_PALETTE } from '@kbrelay/shared';
import * as api from '../lib/api';
import { ROLE_META, ROLE_ORDER } from '../lib/roles';
import { useDialog } from './Dialog';

const STEP = 1000;
/** A fractional rank between two neighbors (same model as card ordering). */
function rankBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return STEP;
  if (before == null) return after! - STEP;
  if (after == null) return before + STEP;
  return (before + after) / 2;
}

type Tab = 'general' | 'columns' | 'archive';
const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'columns', label: 'Columns' },
  { id: 'archive', label: 'Archive' },
];

/**
 * Project-specific settings, opened from the gear by the project switcher.
 * Tabbed: General (name / description / color) and Columns (lane order, add).
 * Mutations persist immediately; onChanged bumps the board, onProjectChanged
 * re-fetches the project list so the switcher dot + name update at once.
 */
export default function ProjectSettings({
  projectId,
  onClose,
  onChanged,
  onProjectChanged,
}: {
  projectId: string;
  onClose: () => void;
  onChanged: () => void;
  onProjectChanged?: () => void;
}) {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>('general');
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [cols, setCols] = useState<ColumnDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General-tab local edit state.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState(true);
  // Auto-archive knob (KBR-60): '' = off, else days as a string for the input.
  const [autoArchive, setAutoArchive] = useState('');

  const load = useCallback(async () => {
    try {
      const { project: p, columns } = await api.getProject(projectId);
      setProject(p);
      setCols(columns);
      setName(p.name);
      setDescription(p.description ?? '');
      setColor(p.color);
      setAgentEvents(p.agentEventsEnabled);
      setAutoArchive(p.autoArchiveDoneDays != null ? String(p.autoArchiveDoneDays) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const autoArchiveDays = /^\d+$/.test(autoArchive.trim()) ? Number(autoArchive.trim()) : null;

  const dirty =
    !!project &&
    (name.trim() !== project.name ||
      (description.trim() || null) !== (project.description ?? null) ||
      color !== project.color ||
      agentEvents !== project.agentEventsEnabled ||
      autoArchiveDays !== project.autoArchiveDoneDays);

  async function saveGeneral() {
    if (!project || !dirty || busy) return;
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }
    if (autoArchive.trim() !== '' && (autoArchiveDays == null || autoArchiveDays < 1 || autoArchiveDays > 365)) {
      setError('Auto-archive must be a number of days between 1 and 365 (or empty for off).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patchProject(projectId, {
        name: trimmed,
        description: description.trim() || null,
        color,
        agentEventsEnabled: agentEvents,
        autoArchiveDoneDays: autoArchiveDays,
      });
      onProjectChanged?.();
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= cols.length || busy) return;
    setBusy(true);
    setError(null);
    // Optimistically reorder the list, then persist the moved column's new rank.
    const next = [...cols];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setCols(next);
    const before = target > 0 ? next[target - 1]!.position : null;
    const after = target < next.length - 1 ? next[target + 1]!.position : null;
    try {
      await api.patchColumn(moved!.id, { position: rankBetween(before, after) });
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
      await load();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Set (or clear) a column's role. Roles are unique per project, so assigning
   * one the API already holds elsewhere moves it here (the "yank"); reloading
   * reflects the previous holder losing it.
   */
  async function setRole(column: ColumnDto, role: ColumnRole | null) {
    if (busy || column.role === role) return;
    setBusy(true);
    setError(null);
    try {
      await api.patchColumn(column.id, { role });
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set role');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addColumn() {
    const colName = await dialog.prompt({ title: 'New column', label: 'Column name', placeholder: 'e.g. Blocked', confirmLabel: 'Add' });
    if (!colName) return;
    setBusy(true);
    setError(null);
    try {
      await api.createColumn(projectId, { name: colName });
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: color ?? 'var(--accent)' }} />
          <h2 className="modal-title" id="settings-title">Project settings</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="settings-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {error && <div className="error-text">{error}</div>}

          {tab === 'general' && (
            <>
              <div className="field">
                <label htmlFor="proj-name">Project name</label>
                <input
                  id="proj-name"
                  value={name}
                  placeholder="e.g. Orderbase - Launch"
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="proj-desc">Description</label>
                <textarea
                  id="proj-desc"
                  className="proj-desc"
                  value={description}
                  placeholder="What is this project for? Shown to teammates and agents (via the API/MCP)."
                  maxLength={20_000}
                  rows={4}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="muted-note">Agents read this to learn what the project is about.</p>
              </div>

              <div className="field">
                <label>Color</label>
                <div className="color-swatches">
                  <button
                    type="button"
                    className={`color-swatch default-swatch ${color === null ? 'active' : ''}`}
                    aria-label="Default color"
                    title="Default"
                    onClick={() => setColor(null)}
                  />
                  {USER_PALETTE.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`color-swatch ${color?.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                      style={{ background: c }}
                      aria-label={`set color ${c}`}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="field notify-field">
                <label className="notify-toggle">
                  <input
                    type="checkbox"
                    checked={agentEvents}
                    onChange={(e) => setAgentEvents(e.target.checked)}
                  />
                  <span className="notify-toggle-text">Notify agents of activity on this board</span>
                </label>
                <p className="muted-note">
                  When on, assigning a card into a <strong>Ready</strong> lane (or @-mentioning an agent) can
                  push an event to a connected Claude Code channel. Only takes effect once an admin has set up
                  channel events under <em>Team &amp; access</em>.
                </p>
              </div>

              <div className="field">
                <label htmlFor="proj-auto-archive">Auto-archive Done cards after (days)</label>
                <input
                  id="proj-auto-archive"
                  type="number"
                  min={1}
                  max={365}
                  value={autoArchive}
                  placeholder="off"
                  style={{ maxWidth: '8rem' }}
                  onChange={(e) => setAutoArchive(e.target.value)}
                />
                <p className="muted-note">
                  When set, cards that have sat in the <strong>Done</strong> lane for this many days are
                  archived automatically the next time the board loads. Leave empty to keep everything.
                </p>
              </div>

              <div className="member-projects-actions">
                <button className="primary" disabled={!dirty || busy} onClick={saveGeneral}>
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </>
          )}

          {tab === 'archive' && (
            <ArchivePanel projectId={projectId} onChanged={onChanged} />
          )}

          {tab === 'columns' && (
            <>
              <p className="muted-note">Order lanes left→right (top = leftmost). A <strong>role</strong> gives a lane meaning for you and your agents — each role belongs to one lane, so assigning it here moves it off any other lane.</p>
              <div className="col-reorder">
                {cols.map((c, i) => (
                  <div className="col-row" key={c.id}>
                    <span className="col-index">{i + 1}</span>
                    <span className="column-dot" style={{ background: c.color ?? '#64748b' }} />
                    <span className="col-row-name">{c.name}</span>
                    <select
                      className="col-row-role"
                      value={c.role ?? ''}
                      disabled={busy}
                      aria-label={`Role for ${c.name}`}
                      style={c.role ? { color: ROLE_META[c.role].color } : undefined}
                      onChange={(e) => setRole(c, (e.target.value || null) as ColumnRole | null)}
                    >
                      <option value="">No role</option>
                      {ROLE_ORDER.map((r) => (
                        <option key={r} value={r}>{ROLE_META[r].label}</option>
                      ))}
                    </select>
                    <div className="col-row-actions">
                      <button className="icon-btn subtle" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.name} up`}>↑</button>
                      <button className="icon-btn subtle" disabled={busy || i === cols.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.name} down`}>↓</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="subtle add-col-btn" onClick={addColumn} disabled={busy}>+ Add column</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Archived cards (KBR-60): a flat list (not a board) with one-click restore.
 * Restore drops the card back into the column it left — the row keeps its
 * column id, nothing to recompute. Owns its own busy/error state so a restore
 * can't wedge the General tab's save button.
 */
function ArchivePanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [cards, setCards] = useState<CardDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { cards: cs } = await api.listCards(projectId, { archived: true });
      setCards(cs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archive');
    }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function restore(card: CardDto) {
    setBusyId(card.id);
    setError(null);
    try {
      await api.patchCard(card.id, { archived: false });
      await load();
      onChanged(); // the card is back on the board behind this modal
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  }

  const fmt = (ms: number) => new Date(ms).toLocaleDateString([], { dateStyle: 'medium' });

  return (
    <>
      {error && <div className="error-text">{error}</div>}
      {cards === null ? (
        <div className="muted-note">Loading…</div>
      ) : cards.length === 0 ? (
        <p className="muted-note">
          Nothing archived. Archive finished cards from the Done lane's header, a card's
          Archive button, or the auto-archive setting under General.
        </p>
      ) : (
        <div className="archive-list">
          {cards.map((c) => (
            <div className="archive-row" key={c.id}>
              <div className="archive-ident">
                {c.key && <span className="view-eyebrow">{c.key}</span>}
                <span className="archive-summary">{c.summary}</span>
              </div>
              <span className="archive-date" title="Archived on">
                {c.archivedAt != null ? fmt(c.archivedAt) : '—'}
              </span>
              <button className="ghost sm" disabled={busyId === c.id} onClick={() => void restore(c)}>
                {busyId === c.id ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
