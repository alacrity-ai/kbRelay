import { useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CardEventDto, UserDto, AttachmentDto } from '@kbrelay/shared';
import * as api from '../lib/api';
import { attachmentMarkdown } from '../lib/attachments';
import { CardLinksContext, TICKET_KEY_RE, cardHref } from '../lib/cardLinks';
import Markdown from './Markdown';
import MentionTextArea from './MentionTextArea';
import AttachmentToolbar from './AttachmentToolbar';
import { useDialog } from './Dialog';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2);
  return chars.toUpperCase();
}

/** "3m ago" / "2h ago" / a date for older entries. (Shared with ActivityFeed.) */
export function relTime(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** The append-only card timeline: system events + comments, with a composer. */
export default function Timeline({
  cardId,
  cardUpdatedAt,
  users,
  meId,
  scrollToCommentId,
}: {
  cardId: string;
  cardUpdatedAt: number;
  users: UserDto[];
  meId: string;
  /** When deep-linked from a notification: scroll to + flash this comment. */
  scrollToCommentId?: string | null;
}) {
  const [events, setEvents] = useState<CardEventDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dialog = useDialog();

  const [body, setBody] = useState('');
  const [type, setType] = useState<'note' | 'handoff'>('note');
  const [summary, setSummary] = useState('');
  const [posting, setPosting] = useState(false);
  // Attachments uploaded for the comment being composed (v0.16.0); linked to the
  // event on post via attachmentIds.
  const [pending, setPending] = useState<AttachmentDto[]>([]);

  const user = (id: string | null) => users.find((u) => u.id === id);
  const userName = (id: string | null) => user(id)?.name ?? 'someone';

  async function redact(id: string) {
    const ok = await dialog.confirm({
      title: 'Remove this comment?',
      message: 'Its content will be permanently removed, leaving only a “removed” tombstone. This can’t be undone.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.redactComment(cardId, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove comment');
    }
  }

  const load = useCallback(async () => {
    try {
      const { events: es } = await api.getTimeline(cardId);
      setEvents(es);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    }
  }, [cardId]);

  // Reload on open, and whenever the card changes (a save emits system events).
  useEffect(() => { void load(); }, [load, cardUpdatedAt]);

  // Once the timeline is loaded, deep-link to the mentioned comment.
  useEffect(() => {
    if (!scrollToCommentId || events == null) return;
    const el = document.getElementById(`tl-${scrollToCommentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    const t = setTimeout(() => el.classList.remove('flash'), 1600);
    return () => clearTimeout(t);
  }, [scrollToCommentId, events]);

  async function post() {
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      await api.addComment(cardId, {
        type,
        body: body.trim(),
        ...(type === 'handoff' && summary.trim() ? { meta: { summary: summary.trim() } } : {}),
        ...(pending.length ? { attachmentIds: pending.map((a) => a.id) } : {}),
      });
      setBody('');
      setSummary('');
      setType('note');
      setPending([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="view-section">
      <span className="view-label">Timeline</span>

      <div className="timeline">
        {events == null ? (
          <div className="timeline-empty">Loading…</div>
        ) : events.length === 0 ? (
          <div className="timeline-empty">No activity yet.</div>
        ) : (
          events.map((e) => (
            <TimelineEntry key={e.id} event={e} users={users} now={now} userName={userName} meId={meId} onRedact={redact} />
          ))
        )}
      </div>

      <div className="composer">
        <div className="composer-tabs">
          <button className={`tab ${type === 'note' ? 'active' : ''}`} onClick={() => setType('note')}>Note</button>
          <button className={`tab ${type === 'handoff' ? 'active' : ''}`} onClick={() => setType('handoff')}>Handoff</button>
        </div>
        {type === 'handoff' && (
          <input
            placeholder="One-line summary (optional)"
            value={summary}
            onChange={(ev) => setSummary(ev.target.value)}
          />
        )}
        <MentionTextArea
          placeholder={type === 'handoff' ? 'What shipped, how it was verified… @mention to notify' : 'Add a note… @mention to notify'}
          value={body}
          onChange={setBody}
          users={users}
          rows={4}
        />
        <AttachmentToolbar
          cardId={cardId}
          onUploaded={(a) => {
            setBody((b) => (b ? `${b}\n` : '') + attachmentMarkdown(a));
            setPending((p) => [...p, a]);
          }}
        />
        {error && <div className="error-text">{error}</div>}
        <div className="composer-actions">
          <button className="primary" onClick={post} disabled={posting || !body.trim()}>
            {posting ? 'Posting…' : type === 'handoff' ? 'Post handoff' : 'Post note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({
  event,
  users,
  now,
  userName,
  meId,
  onRedact,
}: {
  event: CardEventDto;
  users: UserDto[];
  now: number;
  userName: (id: string | null) => string;
  meId: string;
  onRedact: (id: string) => void;
}) {
  const author = users.find((u) => u.id === event.authorUserId);
  const when = relTime(event.createdAt, now);

  // Redacted comment → tombstone in place (no content, no slots).
  if (event.deletedAt != null) {
    return (
      <div id={`tl-${event.id}`} className="tl-comment redacted">
        <span className="tl-redacted">🗑 Comment removed by {userName(event.deletedBy)} · {relTime(event.deletedAt, now)}</span>
      </div>
    );
  }

  if (event.kind === 'system') {
    return (
      <div className="tl-system">
        <span className="tl-dot" />
        <span className="tl-sys-text">
          <strong>{userName(event.authorUserId)}</strong> {systemPhrase(event, userName)}
        </span>
        <span className="tl-time">{when}</span>
      </div>
    );
  }

  const isHandoff = event.kind === 'handoff';
  const meta = event.meta ?? {};
  const summary = typeof meta.summary === 'string' ? meta.summary : '';
  const evidence = asStrings(meta.evidence);
  const verify = asStrings(meta.verify);
  const spunOff = asStrings(meta.spunOff);

  return (
    <div id={`tl-${event.id}`} className={`tl-comment ${isHandoff ? 'handoff' : ''}`}>
      <div className="tl-comment-head">
        <span className="avatar sm" style={{ background: author?.color ?? '#64748b' }}>
          {author ? initials(author.name) : '?'}
        </span>
        <span className="tl-author">
          {isHandoff && '✅ Handoff from '}{author?.name ?? 'someone'}
          {author?.kind && <span className={`kind-badge ${author.kind}`}>{author.kind}</span>}
        </span>
        <span className="tl-time">{when}</span>
        {event.authorUserId === meId && (
          <button className="tl-redact-btn" onClick={() => onRedact(event.id)} title="Remove this comment" aria-label="Remove this comment">
            Remove
          </button>
        )}
      </div>
      {isHandoff && summary && <div className="tl-summary">{summary}</div>}
      {event.body && <div className="tl-body"><Markdown users={users}>{event.body}</Markdown></div>}
      {isHandoff && (evidence.length > 0 || verify.length > 0 || spunOff.length > 0) && (
        <div className="tl-slots">
          {evidence.length > 0 && <SlotList label="Evidence" items={evidence} />}
          {verify.length > 0 && <SlotList label="Verify" items={verify} />}
          {spunOff.length > 0 && <SlotList label="Spun off" items={spunOff} />}
        </div>
      )}
    </div>
  );
}

function SlotList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="tl-slot">
      <span className="tl-slot-label">{label}</span>
      <ul>{items.map((it, i) => <li key={i}><SlotText text={it} /></li>)}</ul>
    </div>
  );
}

/** Handoff slots are plain text in the data; render-only linkify any accessible
 *  ticket keys they contain (KBR-65) — e.g. a `spunOff` entry of "KBR-59". */
function SlotText({ text }: { text: string }) {
  const cardLinks = useContext(CardLinksContext);
  if (!cardLinks || cardLinks.codes.size === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  const re = new RegExp(TICKET_KEY_RE.source, 'g');
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const [key, code] = [m[0], m[1]!];
    if (!cardLinks.codes.has(code)) continue;
    parts.push(text.slice(last, m.index));
    parts.push(
      <a
        key={m.index}
        href={cardHref(key)}
        className="card-link"
        title={`Open ${key}`}
        onClick={(e) => { e.preventDefault(); cardLinks.openCard(key); }}
      >
        {key}
      </a>,
    );
    last = m.index + key.length;
  }
  if (last === 0) return <>{text}</>;
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Human phrase for a system event ("moved this Ready → In Progress").
 *  (Shared with ActivityFeed.) */
export function systemPhrase(e: CardEventDto, userName: (id: string | null) => string): string {
  const meta = e.meta ?? {};
  switch (e.eventType) {
    case 'created':
      return 'created this card';
    case 'moved': {
      const from = (meta.from as { name?: string } | undefined)?.name;
      const to = (meta.to as { name?: string } | undefined)?.name;
      return to ? `moved this ${from ? `${from} → ` : 'to '}${to}` : 'moved this card';
    }
    case 'assigned': {
      const to = (meta.to as string | null | undefined) ?? null;
      return to ? `assigned this to ${userName(to)}` : 'unassigned this card';
    }
    case 'reviewer': {
      const to = (meta.to as string | null | undefined) ?? null;
      return to ? `requested review from ${userName(to)}` : 'cleared the reviewer';
    }
    case 'edited': {
      const fields = asStrings(meta.fields);
      return fields.length ? `edited the ${fields.join(', ')}` : 'edited this card';
    }
    default:
      return 'updated this card';
  }
}
