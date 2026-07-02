import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardDto, ColumnDto, UserDto, MentionSourceKind, AttachmentDto } from '@kbrelay/shared';
import { UNASSIGNED_COLOR } from '@kbrelay/shared';
import * as api from '../lib/api';
import type { CardInput } from '../lib/api';
import { attachmentMarkdown } from '../lib/attachments';
import Timeline from './Timeline';
import Markdown from './Markdown';
import MentionTextArea from './MentionTextArea';
import AttachmentToolbar from './AttachmentToolbar';
import AttachmentList from './AttachmentList';

export interface CardScrollTarget {
  kind: MentionSourceKind;
  commentId: string | null;
}

interface Props {
  card?: CardDto; // undefined = create mode
  columns: ColumnDto[];
  users: UserDto[];
  meId: string;
  createInColumnId?: string;
  /** When opened from a notification: scroll to (and flash) this location. */
  scrollTo?: CardScrollTarget;
  onSave: (input: CardInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
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
export default function CardModal({ card, columns, users, meId, createInColumnId, scrollTo, onSave, onDelete, onClose }: Props) {
  const isNew = !card;
  const [editing, setEditing] = useState(isNew);
  const descRef = useRef<HTMLDivElement>(null);
  const acRef = useRef<HTMLDivElement>(null);

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attachments (v0.16.0). Seeded from the card if present; (re)fetched on open
  // and after upload/delete, since the board's card list carries only counts.
  const [attachments, setAttachments] = useState<AttachmentDto[]>(card?.attachments ?? []);
  const refreshAttachments = useCallback(async () => {
    if (!card) return;
    try {
      const { card: full } = await api.getCard(card.id);
      setAttachments(full.attachments ?? []);
    } catch {
      /* leave the last-known list on a transient error */
    }
  }, [card]);
  useEffect(() => {
    if (card) void refreshAttachments();
  }, [card, refreshAttachments]);

  async function removeAttachment(a: AttachmentDto) {
    try {
      await api.deleteAttachment(a.id);
      setAttachments((list) => list.filter((x) => x.id !== a.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attachment');
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
      });
      if (isNew) onClose();
      else setEditing(false); // Board refreshed the card; drop back to view.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
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
                <input className="modal-title-input" value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label>Description</label>
                <MentionTextArea value={description} onChange={setDescription} users={users} rows={5} />
                {isNew ? (
                  <p className="attach-hint muted-note" style={{ fontSize: '0.8rem' }}>
                    Save the card to attach files.
                  </p>
                ) : (
                  <AttachmentToolbar
                    cardId={card!.id}
                    onUploaded={(a) => {
                      setDescription((d) => (d ? `${d}\n` : '') + attachmentMarkdown(a));
                      setAttachments((list) => [...list, a]);
                    }}
                  />
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
              </div>
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
                  {card!.description ? <Markdown users={users}>{card!.description}</Markdown> : 'No description.'}
                </div>
                {attachments.length > 0 && (
                  <div className="attach-view">
                    <span className="attach-view-label">Attachments</span>
                    <AttachmentList items={attachments} onDelete={removeAttachment} />
                  </div>
                )}
              </div>

              <div className="view-section" ref={acRef}>
                <span className="view-label">Acceptance criteria</span>
                <div className={`view-text ${card!.acceptanceCriteria ? '' : 'empty'}`}>
                  {card!.acceptanceCriteria ? <Markdown users={users}>{card!.acceptanceCriteria}</Markdown> : 'None set.'}
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
