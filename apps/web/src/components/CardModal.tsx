import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardDto, ColumnDto, LabelDto, UserDto, MentionSourceKind, AttachmentDto } from '@kbrelay/shared';
import { UNASSIGNED_COLOR, toggleTaskAtLine } from '@kbrelay/shared';
import * as api from '../lib/api';
import type { CardInput } from '../lib/api';
import { attachmentMarkdown, stripAttachmentMarkdown } from '../lib/attachments';
import { dueInputValue, dueAtFromInput, dueClass } from '../lib/due';
import { cardUrl } from '../lib/cardLinks';
import Timeline from './Timeline';
import Markdown from './Markdown';
import MentionTextArea from './MentionTextArea';
import AttachmentToolbar from './AttachmentToolbar';
import AttachmentList from './AttachmentList';
import { useDialog } from './Dialog';

export interface CardScrollTarget {
  kind: MentionSourceKind;
  commentId: string | null;
}

interface Props {
  card?: CardDto; // undefined = create mode
  columns: ColumnDto[];
  users: UserDto[];
  meId: string;
  /** The project's label palette (KBR-62) — empty hides the picker. */
  projectLabels?: LabelDto[];
  createInColumnId?: string;
  /** When opened from a notification: scroll to (and flash) this location. */
  scrollTo?: CardScrollTarget;
  onSave: (input: CardInput) => Promise<CardDto>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function Chain() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function Pencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * Card modal with two explicit modes:
 *  - View (default for an existing card): read-only, spacious, safe to just look.
 *  - Edit: the form. Reached via the Edit button, or immediately when creating.
 * Saving an existing card returns to View; creating closes the modal.
 */
export default function CardModal({ card, columns, users, meId, projectLabels = [], createInColumnId, scrollTo, onSave, onDelete, onClose }: Props) {
  const isNew = !card;
  const [editing, setEditing] = useState(isNew);
  const descRef = useRef<HTMLDivElement>(null);
  const acRef = useRef<HTMLDivElement>(null);
  const dialog = useDialog();

  // Deep-link from a notification: flash the mentioned field. Comment targets are
  // handled inside the Timeline (which owns the comment nodes).
  useEffect(() => {
    if (!scrollTo || editing) return;
    const el = scrollTo.kind === 'acceptance_criteria' ? acRef.current
      : scrollTo.kind === 'comment' ? null
      : descRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    const t = setTimeout(() => el.classList.remove('flash'), 1600);
    return () => clearTimeout(t);
  }, [scrollTo, editing]);

  // Edit-form fields (seeded from the card each time we enter edit mode).
  const [summary, setSummary] = useState(card?.summary ?? '');
  const [description, setDescription] = useState(card?.description ?? '');
  const [acceptance, setAcceptance] = useState(card?.acceptanceCriteria ?? '');
  const [columnId, setColumnId] = useState(card?.columnId ?? createInColumnId ?? columns[0]?.id ?? '');
  const [assignee, setAssignee] = useState(card?.assigneeUserId ?? '');
  const [reviewer, setReviewer] = useState(card?.reviewerUserId ?? '');
  const [due, setDue] = useState(dueInputValue(card?.dueAt ?? null));
  const [labelIds, setLabelIds] = useState<string[]>((card?.labels ?? []).map((l) => l.id));
  const [now] = useState(() => Date.now()); // render-stable clock for due urgency
  const [linkCopied, setLinkCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attachments (v0.16.0). Seeded from the card if present; (re)fetched on open,
  // since the board's card list carries only counts.
  const [attachments, setAttachments] = useState<AttachmentDto[]>(card?.attachments ?? []);
  // A monotonically-increasing token guards against a stale server read
  // clobbering a fresher local mutation. When a brand-new card is adopted
  // (undefined → saved) this effect fires a fetch, but the file the user is
  // attaching hasn't landed on the server yet — without the guard, that empty
  // read would wipe the just-uploaded attachment (KBR-38). Any local add/remove
  // bumps the token so an in-flight fetch is ignored.
  const refreshSeq = useRef(0);
  const refreshAttachments = useCallback(async () => {
    if (!card) return;
    const seq = ++refreshSeq.current;
    try {
      const { card: full } = await api.getCard(card.id);
      if (seq === refreshSeq.current) setAttachments(full.attachments ?? []);
    } catch {
      /* leave the last-known list on a transient error */
    }
  }, [card]);
  useEffect(() => {
    if (card) void refreshAttachments();
  }, [card, refreshAttachments]);

  async function removeAttachment(a: AttachmentDto) {
    const ok = await dialog.confirm({
      title: 'Remove this attachment?',
      message: `“${a.filename}” will be permanently deleted from the card and storage. This can't be undone.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAttachment(a.id);
      refreshSeq.current++; // a local mutation wins over any in-flight fetch
      setAttachments((list) => list.filter((x) => x.id !== a.id));
      // Unwind a description reference so it doesn't dangle. (Note/handoff refs
      // are append-only history; those render "🗑 Attachment removed" on reload.)
      if (a.eventId == null) {
        if (editing) {
          // Mid-edit: strip the in-progress buffer; it persists on Save. (Don't
          // call onSave here — that would clobber the user's unsaved edits.)
          setDescription((d) => stripAttachmentMarkdown(d, a.id));
        } else if (card) {
          const current = card.description ?? '';
          const stripped = stripAttachmentMarkdown(current, a.id);
          if (stripped !== current) {
            setDescription(stripped);
            await onSave({ description: stripped || null });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attachment');
    }
  }

  // A file was uploaded: inject its markdown into the description + track it.
  function onUploaded(a: AttachmentDto) {
    refreshSeq.current++; // beat any in-flight fetch (e.g. a just-adopted new card)
    setDescription((d) => (d ? `${d}\n` : '') + attachmentMarkdown(a));
    setAttachments((list) => (list.some((x) => x.id === a.id) ? list : [...list, a]));
  }

  // Attaching on an unsaved new card: confirm, then save it first (Board adopts
  // the new card into this modal), and return its id so the upload can proceed.
  async function saveNewCardForAttach(): Promise<string | null> {
    if (!summary.trim()) {
      setError('Add a summary before attaching a file.');
      return null;
    }
    const ok = await dialog.confirm({
      title: 'Save this card to attach?',
      message: 'Attaching a file will save this card first, then add the file.',
      confirmLabel: 'Save & attach',
    });
    if (!ok) return null;
    try {
      const saved = await onSave({
        summary: summary.trim(),
        description: description || null,
        acceptanceCriteria: acceptance || null,
        columnId,
        assigneeUserId: assignee || null,
        reviewerUserId: reviewer || null,
        dueAt: dueAtFromInput(due),
        labelIds,
      });
      return saved.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return null;
    }
  }

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? id ?? '—';
  const userKind = (id: string | null) => users.find((u) => u.id === id)?.kind;
  const userColor = (id: string | null) => users.find((u) => u.id === id)?.color ?? UNASSIGNED_COLOR;
  const column = columns.find((c) => c.id === card?.columnId);
  const fmt = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  function startEdit() {
    // Re-seed from the current card so edits always start from the latest state.
    setSummary(card?.summary ?? '');
    setDescription(card?.description ?? '');
    setAcceptance(card?.acceptanceCriteria ?? '');
    setColumnId(card?.columnId ?? columns[0]?.id ?? '');
    setAssignee(card?.assigneeUserId ?? '');
    setReviewer(card?.reviewerUserId ?? '');
    setDue(dueInputValue(card?.dueAt ?? null));
    setLabelIds((card?.labels ?? []).map((l) => l.id));
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    if (isNew) return onClose();
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (!summary.trim()) {
      setError('Summary is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        summary: summary.trim(),
        description: description || null,
        acceptanceCriteria: acceptance || null,
        columnId,
        assigneeUserId: assignee || null,
        reviewerUserId: reviewer || null,
        dueAt: dueAtFromInput(due),
        labelIds,
      });
      // Board adopts the saved card (new or existing) into the modal, so drop to
      // view rather than closing — you see what you just created/edited.
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  // Interactive checklists (v0.17.0, KBR-59): a view-mode checkbox click
  // toggles that source line. Re-fetch first so a toggle can't clobber a
  // fresher edit; if the line no longer holds a task item, silently skip.
  async function toggleTask(field: 'description' | 'acceptanceCriteria', line: number) {
    if (!card || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { card: fresh } = await api.getCard(card.id);
      const src = field === 'description' ? fresh.description : fresh.acceptanceCriteria;
      const next = src ? toggleTaskAtLine(src, line) : null;
      if (next != null) await onSave({ [field]: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update checklist');
    } finally {
      setBusy(false);
    }
  }

  // Copy a shareable link (KBR-71): /c/<KEY> — pasteable into Slack/SMS.
  // Anyone without access to the card's project gets an error, not the card.
  async function copyLink() {
    if (!card?.key) return;
    try {
      await navigator.clipboard.writeText(cardUrl(card.key));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      /* clipboard blocked — nothing sensible to do */
    }
  }

  // Inline due-date change from view mode (KBR-63) — saves immediately.
  async function setDueAt(next: number | null) {
    if (!card || busy || next === card.dueAt) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ dueAt: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update due date');
    } finally {
      setBusy(false);
    }
  }

  async function quickMove(targetColumnId: string) {
    if (!card || targetColumnId === card.columnId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ columnId: targetColumnId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  // Archive (KBR-60): the card leaves the board (history intact), so close the
  // modal after — there's nothing to look at behind it. Restore lives in
  // Project Settings → Archive.
  async function archive() {
    if (!card || busy) return;
    const ok = await dialog.confirm({
      title: `Archive ${card.key ?? 'this card'}?`,
      message: 'It leaves the board but keeps its timeline and attachments. Restore any time from Project Settings → Archive.',
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ archived: true });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed');
      setBusy(false);
    }
  }

  // Accent follows the assignee's color (selected assignee in edit; card's in view).
  const accent = userColor(editing ? (assignee || null) : (card?.assigneeUserId ?? null));

  // Backdrop deliberately does NOT close on click — too easy to lose work by
  // mis-clicking. Close only via the ✕ / Close button.
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <span className="modal-accent" style={{ background: accent }} />
          {editing ? (
            <h2 className="modal-title">{isNew ? 'New card' : `Edit ${card!.key ?? 'card'}`}</h2>
          ) : (
            <div className="modal-title-wrap">
              {card!.key && <span className="view-eyebrow">{card!.key}</span>}
              <h2 className="modal-title">{card!.summary}</h2>
            </div>
          )}
          <div className="modal-header-actions">
            {!editing && card!.key && (
              <button className="subtle" onClick={() => void copyLink()} aria-label="Copy link to this card" title={`Copy ${cardUrl(card!.key)}`}>
                <Chain /> {linkCopied ? 'Copied' : 'Link'}
              </button>
            )}
            {!editing && (
              <button className="subtle" onClick={startEdit} aria-label="Edit card">
                <Pencil /> Edit
              </button>
            )}
            <button className="icon-btn ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          {editing ? (
            <>
              <div className="field">
                <label>Summary{!isNew && card!.key ? ` · ${card!.key}` : ''}</label>
                {/* Only auto-focus when creating — clicking Edit on an existing
                    card shouldn't pop the mobile keyboard (KBR-32). */}
                <input className="modal-title-input" value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus={isNew} />
              </div>
              <div className="field">
                <label>Description</label>
                <MentionTextArea value={description} onChange={setDescription} users={users} rows={5} />
                {/* One toolbar, mounted across the create→adopt transition: for an
                    existing card it attaches directly; for a new card it saves first. */}
                <AttachmentToolbar
                  cardId={card ? card.id : undefined}
                  resolveCardId={card ? undefined : saveNewCardForAttach}
                  onUploaded={onUploaded}
                  hint={card ? undefined : 'attaching will save the card first'}
                />
                {/* Attachments are visible + removable while editing, so a file
                    you just added shows immediately (no need to leave edit). */}
                {attachments.length > 0 && (
                  <div className="attach-view">
                    <span className="attach-view-label">Attachments</span>
                    <AttachmentList items={attachments} onDelete={removeAttachment} />
                  </div>
                )}
              </div>
              <div className="field">
                <label>Acceptance criteria</label>
                <MentionTextArea value={acceptance} onChange={setAcceptance} users={users} rows={4} />
              </div>
              <div className="row">
                <div className="field">
                  <label>Column</label>
                  <select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
                    {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Assignee</label>
                  <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.kind})</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Reviewer</label>
                  <select value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
                    <option value="">No reviewer</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.kind})</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Due date</label>
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
              </div>
              {/* Label picker (KBR-62): toggleable chips from the project palette. */}
              {projectLabels.length > 0 && (
                <div className="field">
                  <label>Labels</label>
                  <div className="filter-labels">
                    {projectLabels.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className={`label-chip selectable ${labelIds.includes(l.id) ? 'active' : ''}`}
                        style={{ background: `${l.color}2b`, color: l.color, borderColor: labelIds.includes(l.id) ? l.color : `${l.color}66` }}
                        onClick={() => setLabelIds((ids) => ids.includes(l.id) ? ids.filter((x) => x !== l.id) : [...ids, l.id])}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="muted-note" style={{ fontSize: '0.8rem' }}>
                The card takes on its assignee's color.
              </p>
            </>
          ) : (
            <>
              <div className="view-row">
                <div className="view-section">
                  <span className="view-label">Column</span>
                  <span className="pill">
                    <span className="column-dot" style={{ background: column?.color ?? '#64748b' }} />
                    {column?.name ?? '—'}
                  </span>
                </div>
                <div className="view-section">
                  <span className="view-label">Assignee</span>
                  <span className="pill">
                    {card!.assigneeUserId ? (
                      <>
                        <span className="dot" style={{ background: userColor(card!.assigneeUserId) }} />
                        {userName(card!.assigneeUserId)}
                        {userKind(card!.assigneeUserId) && (
                          <span className={`kind-badge ${userKind(card!.assigneeUserId)}`}>
                            {userKind(card!.assigneeUserId)}
                          </span>
                        )}
                      </>
                    ) : 'Unassigned'}
                  </span>
                </div>
                {card!.reviewerUserId && (
                  <div className="view-section">
                    <span className="view-label">Reviewer</span>
                    <span className="pill">
                      <span className="dot" style={{ background: userColor(card!.reviewerUserId) }} />
                      {userName(card!.reviewerUserId)}
                      {userKind(card!.reviewerUserId) && (
                        <span className={`kind-badge ${userKind(card!.reviewerUserId)}`}>
                          {userKind(card!.reviewerUserId)}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {/* Inline due-date picker (KBR-63): pick to save immediately;
                    ✕ clears. Urgency tint matches the board chip. */}
                <div className="view-section">
                  <span className="view-label">Due</span>
                  <span className={`pill due-pill ${card!.dueAt != null && column?.role !== 'done' ? dueClass(card!.dueAt, now) : ''}`}>
                    <input
                      type="date"
                      className="due-inline-input"
                      aria-label="Due date"
                      value={dueInputValue(card!.dueAt)}
                      disabled={busy}
                      onChange={(e) => void setDueAt(dueAtFromInput(e.target.value))}
                    />
                    {card!.dueAt != null && (
                      <button
                        className="due-clear"
                        title="Clear due date"
                        aria-label="Clear due date"
                        disabled={busy}
                        onClick={() => void setDueAt(null)}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
                {(card!.labels ?? []).length > 0 && (
                  <div className="view-section">
                    <span className="view-label">Labels</span>
                    <div className="filter-labels">
                      {card!.labels!.map((l) => (
                        <span key={l.id} className="label-chip" style={{ background: `${l.color}2b`, color: l.color, borderColor: `${l.color}66` }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="view-section">
                <span className="view-label">Move to</span>
                <div className="move-control">
                  {columns.map((c) => (
                    <button
                      key={c.id}
                      className={`move-pill ${c.id === card!.columnId ? 'active' : ''}`}
                      disabled={busy}
                      onClick={() => quickMove(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="view-section" ref={descRef}>
                <span className="view-label">Description</span>
                <div className={`view-text ${card!.description ? '' : 'empty'}`}>
                  {card!.description ? (
                    <Markdown users={users} onToggleTask={(line) => void toggleTask('description', line)}>
                      {card!.description}
                    </Markdown>
                  ) : 'No description.'}
                </div>
                {/* View mode is read-only: download/view, but no ✕ (removing is
                    an edit action). */}
                {attachments.length > 0 && (
                  <div className="attach-view">
                    <span className="attach-view-label">Attachments</span>
                    <AttachmentList items={attachments} />
                  </div>
                )}
              </div>

              <div className="view-section" ref={acRef}>
                <span className="view-label">Acceptance criteria</span>
                <div className={`view-text ${card!.acceptanceCriteria ? '' : 'empty'}`}>
                  {card!.acceptanceCriteria ? (
                    <Markdown users={users} onToggleTask={(line) => void toggleTask('acceptanceCriteria', line)}>
                      {card!.acceptanceCriteria}
                    </Markdown>
                  ) : 'None set.'}
                </div>
              </div>

              <div className="provenance">
                Created by <strong>{userName(card!.createdBy)}</strong> · {fmt(card!.createdAt)}<br />
                Last updated by <strong>{userName(card!.updatedBy)}</strong> · {fmt(card!.updatedAt)}
              </div>

              <Timeline
                cardId={card!.id}
                cardUpdatedAt={card!.updatedAt}
                users={users}
                meId={meId}
                scrollToCommentId={scrollTo?.kind === 'comment' ? scrollTo.commentId : null}
              />
            </>
          )}

          {error && <div className="error-text">{error}</div>}
        </div>

        <div className="modal-footer">
          {!isNew && onDelete && (
            <button className="danger" onClick={remove} disabled={busy}>Delete</button>
          )}
          {!isNew && !editing && !card!.archivedAt && (
            <button className="ghost" onClick={() => void archive()} disabled={busy}>Archive</button>
          )}
          <div className="spacer" />
          {editing ? (
            <>
              <button className="ghost" onClick={cancelEdit} disabled={busy}>Cancel</button>
              <button className="primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : isNew ? 'Create' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button className="ghost" onClick={onClose} disabled={busy}>Close</button>
              <button className="primary" onClick={startEdit}><Pencil /> Edit</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
