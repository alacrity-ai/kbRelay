import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardDto, ColumnDto, LabelDto, UserDto, MentionSourceKind, AttachmentDto, CardLinkDto } from '@kbrelay/shared';
import { UNASSIGNED_COLOR, toggleTaskAtLine } from '@kbrelay/shared';
import * as api from '../lib/api';
import type { CardInput } from '../lib/api';
import { attachmentMarkdown, stripAttachmentMarkdown } from '../lib/attachments';
import { dueInputValue, dueAtFromInput, dueClass } from '../lib/due';
import { cardUrl } from '../lib/cardLinks';
import Timeline from './Timeline';
import Dropdown from './Dropdown';
import Markdown from './Markdown';
import MentionTextArea from './MentionTextArea';
import AttachmentToolbar from './AttachmentToolbar';
import AttachmentList from './AttachmentList';
import LinkComposer from './LinkComposer';
import LinkList from './LinkList';
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
  /** Workspace slug for shareable links (KBR-71): keys are only unique per
   *  workspace, so minted URLs carry it. */
  tenantSlug?: string;
  /** The project's label palette (KBR-62) — empty hides the picker. */
  projectLabels?: LabelDto[];
  createInColumnId?: string;
  /** When opened from a notification: scroll to (and flash) this location. */
  scrollTo?: CardScrollTarget;
  onSave: (input: CardInput) => Promise<CardDto>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  /** False for member roles (KBR-101): hides Archive and locks the spec of
   *  cards the viewer didn't create. */
  isAdmin?: boolean;
  /** Called after a review verdict lands (KBR-110) so the board reconciles the
   *  card's new column; the modal closes itself right after. */
  onReviewed?: () => void | Promise<void>;
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
export default function CardModal({ card, columns, users, meId, tenantSlug, projectLabels = [], createInColumnId, scrollTo, onSave, onDelete, onClose, isAdmin = true, onReviewed }: Props) {
  const isNew = !card;
  const [editing, setEditing] = useState(isNew);
  const descRef = useRef<HTMLDivElement>(null);
  const acRef = useRef<HTMLDivElement>(null);
  const dialog = useDialog();
  // A card's CONTENT (summary/description/AC/labels/due) belongs to its
  // creator or an admin (KBR-101). Workflow fields (column/assignee/reviewer)
  // stay editable for members — that's how work is relayed.
  const canEditSpec = isAdmin || !card || card.createdBy === meId;

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
  // External links (KBR-88/91) — same lifecycle as attachments: seeded from the
  // card, refetched on open (the board list carries only `linkCount`).
  const [links, setLinks] = useState<CardLinkDto[]>(card?.links ?? []);
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
      if (seq === refreshSeq.current) {
        setAttachments(full.attachments ?? []);
        setLinks(full.links ?? []);
      }
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
    // Spec locked (KBR-101): the file still attaches, but we can't embed its
    // markdown into a description we're not allowed to change.
    if (canEditSpec) setDescription((d) => (d ? `${d}\n` : '') + attachmentMarkdown(a));
    setAttachments((list) => (list.some((x) => x.id === a.id) ? list : [...list, a]));
  }

  // A link was added via the composer: track it (unlike attachments, links don't
  // ride in the description — they're a first-class list).
  function onLinkAdded(l: CardLinkDto) {
    refreshSeq.current++; // beat any in-flight fetch (e.g. a just-adopted new card)
    setLinks((list) => (list.some((x) => x.id === l.id) ? list : [...list, l]));
  }

  async function removeLink(l: CardLinkDto) {
    const ok = await dialog.confirm({
      title: 'Remove this link?',
      message: `“${l.title ?? l.url}” will be removed from the card.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteCardLink(l.id);
      refreshSeq.current++; // a local mutation wins over any in-flight fetch
      setLinks((list) => list.filter((x) => x.id !== l.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove link');
    }
  }

  // Attaching/linking on an unsaved new card: confirm, then save it first (Board
  // adopts the new card into this modal), and return its id so the follow-up
  // (upload or link) can proceed. `noun` tailors the copy per action.
  async function saveNewCardFor(noun: 'file' | 'link'): Promise<string | null> {
    const verb = noun === 'file' ? 'attach' : 'link';
    if (!summary.trim()) {
      setError(`Add a summary before ${noun === 'file' ? 'attaching a file' : 'adding a link'}.`);
      return null;
    }
    const ok = await dialog.confirm({
      title: `Save this card to ${verb}?`,
      message: `Adding a ${noun} will save this card first, then add the ${noun}.`,
      confirmLabel: `Save & ${verb}`,
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
      const input: CardInput = {
        columnId,
        assigneeUserId: assignee || null,
        reviewerUserId: reviewer || null,
      };
      // Send content fields only when they changed (KBR-101): the server
      // rejects content edits from non-creators, so untouched fields must not
      // ride along with a workflow-only save.
      if (summary.trim() !== (card?.summary ?? '')) input.summary = summary.trim();
      if ((description || null) !== (card?.description ?? null)) input.description = description || null;
      if ((acceptance || null) !== (card?.acceptanceCriteria ?? null)) input.acceptanceCriteria = acceptance || null;
      const nextDue = dueAtFromInput(due);
      if (nextDue !== (card?.dueAt ?? null)) input.dueAt = nextDue;
      const origLabels = (card?.labels ?? []).map((l) => l.id).sort().join(',');
      if ([...labelIds].sort().join(',') !== origLabels) input.labelIds = labelIds;
      await onSave(input);
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

  // Reviewer verdict (KBR-110). The buttons render only for the card's
  // assigned reviewer while it sits in a `review`-role column; the server
  // enforces the same rules (403/400), so the gate here is purely UX.
  const canReview =
    !isNew &&
    !editing &&
    !card!.archivedAt &&
    card!.reviewerUserId === meId &&
    columns.find((c) => c.id === card!.columnId)?.role === 'review';
  const [reviewing, setReviewing] = useState<'approve' | 'reject' | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  async function submitReview() {
    if (!card || !reviewing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.reviewCard(card.id, {
        decision: reviewing,
        ...(reviewComment.trim() ? { body: reviewComment.trim() } : {}),
      });
      setReviewing(null);
      await onReviewed?.(); // board reconciles the move…
      onClose();            // …then the modal closes on the fresh board
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  }

  // Copy a shareable link (KBR-71): /c/<KEY> — pasteable into Slack/SMS.
  // Anyone without access to the card's project gets an error, not the card.
  async function copyLink() {
    if (!card?.key) return;
    try {
      await navigator.clipboard.writeText(cardUrl(card.key, tenantSlug));
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
    const sure = await dialog.confirm({
      title: `Delete ${card?.key ?? 'this card'}?`,
      message: 'This permanently deletes the card, its timeline, and its attachments. It cannot be undone — archive it instead if you might need it later.',
      confirmLabel: 'Delete card',
      danger: true,
    });
    if (!sure) return;
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
              <button className="subtle" onClick={() => void copyLink()} aria-label="Copy link to this card" title={`Copy ${cardUrl(card!.key, tenantSlug)}`}>
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
                <label>Summary{!isNew && card!.key ? ` · ${card!.key}` : ''}{!canEditSpec && ' · locked'}</label>
                {/* Only auto-focus when creating — clicking Edit on an existing
                    card shouldn't pop the mobile keyboard (KBR-32). */}
                <input className="modal-title-input" value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus={isNew} disabled={!canEditSpec} title={canEditSpec ? undefined : "Only the card's creator or an admin can edit this"} />
              </div>
              <div className="field">
                <label>Description{!canEditSpec && ' · locked'}</label>
                {canEditSpec ? (
                  <MentionTextArea value={description} onChange={setDescription} users={users} rows={5} />
                ) : (
                  <div className="spec-locked" title="Only the card's creator or an admin can edit this">
                    <Markdown users={users}>{description || '_None set._'}</Markdown>
                  </div>
                )}
                {/* One toolbar, mounted across the create→adopt transition: for an
                    existing card it attaches directly; for a new card it saves first. */}
                <AttachmentToolbar
                  cardId={card ? card.id : undefined}
                  resolveCardId={card ? undefined : () => saveNewCardFor('file')}
                  onUploaded={onUploaded}
                  hint={card ? undefined : 'attaching will save the card first'}
                />
                {/* Attachments are visible + removable while editing, so a file
                    you just added shows immediately (no need to leave edit). */}
                {attachments.length > 0 && (
                  <div className="attach-view">
                    <span className="attach-view-label">Attachments</span>
                    <AttachmentList items={attachments} onDelete={removeAttachment} canDelete={(a) => isAdmin || a.createdBy === meId} />
                  </div>
                )}
              </div>
              <div className="field">
                <label>Links</label>
                <LinkComposer
                  cardId={card ? card.id : undefined}
                  resolveCardId={card ? undefined : () => saveNewCardFor('link')}
                  onAdded={onLinkAdded}
                />
                {links.length > 0 && (
                  <div className="attach-view">
                    <LinkList items={links} onDelete={removeLink} canDelete={(l) => isAdmin || l.createdBy === meId} />
                  </div>
                )}
              </div>
              <div className="field">
                <label>Acceptance criteria{!canEditSpec && ' · locked'}</label>
                {canEditSpec ? (
                  <MentionTextArea value={acceptance} onChange={setAcceptance} users={users} rows={4} />
                ) : (
                  <div className="spec-locked" title="Only the card's creator or an admin can edit this">
                    <Markdown users={users}>{acceptance || '_None set._'}</Markdown>
                  </div>
                )}
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
                  <label>Due date{!canEditSpec && ' · locked'}</label>
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={!canEditSpec} title={canEditSpec ? undefined : "Only the card's creator or an admin can edit this"} />
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
                        disabled={!canEditSpec}
                        title={canEditSpec ? undefined : "Only the card's creator or an admin can change labels"}
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
                    <Markdown users={users} onToggleTask={canEditSpec ? (line) => void toggleTask('description', line) : undefined}>
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
                {links.length > 0 && (
                  <div className="attach-view">
                    <span className="attach-view-label">Links</span>
                    <LinkList items={links} />
                  </div>
                )}
              </div>

              <div className="view-section" ref={acRef}>
                <span className="view-label">Acceptance criteria</span>
                <div className={`view-text ${card!.acceptanceCriteria ? '' : 'empty'}`}>
                  {card!.acceptanceCriteria ? (
                    <Markdown users={users} onToggleTask={canEditSpec ? (line) => void toggleTask('acceptanceCriteria', line) : undefined}>
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
          {!isNew && !editing && !card!.archivedAt && isAdmin && (
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
              {/* When review verdicts are present the footer overflows small
                  screens, so Approve/Reject/Edit condense into one "Action"
                  popover on mobile (KBR-117) — the inline trio hides via the
                  review-inline media rule while Close stays put. */}
              <button className="ghost" onClick={onClose} disabled={busy}>Close</button>
              <button className={`primary${canReview ? ' review-inline' : ''}`} onClick={startEdit}><Pencil /> Edit</button>
              {canReview && (
                <>
                  <button
                    className="success review-inline"
                    onClick={() => { setReviewComment(''); setReviewing('approve'); }}
                    disabled={busy}
                    data-testid="review-approve"
                  >
                    ✓ Approve
                  </button>
                  <button
                    className="danger review-inline"
                    onClick={() => { setReviewComment(''); setReviewing('reject'); }}
                    disabled={busy}
                    data-testid="review-reject"
                  >
                    Reject
                  </button>
                  <Dropdown
                    className="review-action-menu"
                    align="right"
                    label="Review actions"
                    trigger={<>Action <span className="chevron">▴</span></>}
                  >
                    <div className="menu-list">
                      <button
                        className="menu-item action-approve"
                        onClick={() => { setReviewComment(''); setReviewing('approve'); }}
                        data-testid="action-approve"
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="menu-item action-reject"
                        onClick={() => { setReviewComment(''); setReviewing('reject'); }}
                        data-testid="action-reject"
                      >
                        Reject
                      </button>
                      <button className="menu-item" onClick={startEdit} data-testid="action-edit"><Pencil /> Edit</button>
                    </div>
                  </Dropdown>
                </>
              )}
            </>
          )}
        </div>

        {/* Review dialog (KBR-110): comment + submit. Approve completes the AC
            checklist and moves to Done; Reject sends the card back to In
            Progress. Both post a purple `review` event on the timeline. */}
        {reviewing && (
          <div className="dialog-backdrop" onClick={() => !busy && setReviewing(null)}>
            <div
              className="dialog-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="review-dlg-title"
              onClick={(e) => e.stopPropagation()}
              data-testid="review-dialog"
            >
              <div className="modal-header">
                <span className="modal-accent" style={{ background: reviewing === 'approve' ? 'var(--ok)' : 'var(--danger)' }} />
                <h2 className="modal-title" id="review-dlg-title">
                  {reviewing === 'approve' ? `Approve ${card!.key ?? 'card'}` : `Request changes on ${card!.key ?? 'card'}`}
                </h2>
              </div>
              <div className="modal-body">
                <p className="muted-note">
                  {reviewing === 'approve'
                    ? 'Approving checks off the remaining acceptance criteria and moves the card to Done.'
                    : 'Rejecting moves the card back to In Progress for another pass.'}
                </p>
                <div className="field">
                  <label htmlFor="review-comment">Review comment</label>
                  <textarea
                    id="review-comment"
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={reviewing === 'approve' ? 'What was verified, anything worth noting… (optional)' : 'What needs to change before this can be approved…'}
                    data-testid="review-comment"
                    autoFocus
                  />
                </div>
                {error && <div className="error-text">{error}</div>}
              </div>
              <div className="modal-footer">
                <div className="spacer" />
                <button className="ghost" onClick={() => setReviewing(null)} disabled={busy}>Cancel</button>
                <button
                  className={reviewing === 'approve' ? 'success' : 'danger'}
                  onClick={() => void submitReview()}
                  disabled={busy}
                  data-testid="review-submit"
                >
                  {busy ? 'Submitting…' : reviewing === 'approve' ? 'Submit & approve' : 'Submit & reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
