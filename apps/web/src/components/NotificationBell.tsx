import { useEffect, useRef, useState } from 'react';
import type { MentionDto, UserDto } from '@kbrelay/shared';
import * as api from '../lib/api';

function Bell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function relTime(ms: number, now: number): string {
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

const SRC_LABEL: Record<string, string> = {
  summary: 'summary',
  description: 'description',
  acceptance_criteria: 'acceptance criteria',
  comment: 'a comment',
};

/**
 * The notification bell: unread badge + a dropdown of the caller's unread
 * @-mentions, each deep-linking to the exact card + location. Clicking a mention
 * marks it read; "Mark all read" clears the rest.
 */
export default function NotificationBell({
  users,
  count,
  onCountChange,
  onNavigate,
}: {
  users: UserDto[];
  count: number;
  onCountChange: (n: number) => void;
  onNavigate: (m: MentionDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mentions, setMentions] = useState<MentionDto[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  const authorName = (id: string) => users.find((u) => u.id === id)?.name ?? 'Someone';

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setNow(Date.now());
    void api.getMentions('unread').then((r) => {
      if (!alive) return;
      setMentions(r.mentions);
      onCountChange(r.unreadCount);
    });
    return () => { alive = false; };
  }, [open, onCountChange]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function openMention(m: MentionDto) {
    setOpen(false);
    try {
      const { unreadCount } = await api.markMentionsRead({ mentionIds: [m.id] });
      onCountChange(unreadCount);
    } catch { /* navigate anyway */ }
    onNavigate(m);
  }

  async function markAll() {
    try {
      const { unreadCount } = await api.markMentionsRead({ all: true });
      onCountChange(unreadCount);
      setMentions([]);
    } catch { /* ignore */ }
  }

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        className={`icon-btn subtle bell-btn ${count > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell />
        {count > 0 && <span className="notif-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">
            <span>Notifications</span>
            {(mentions?.length ?? 0) > 0 && (
              <button className="notif-markall" onClick={markAll}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {mentions == null ? (
              <div className="notif-empty">Loading…</div>
            ) : mentions.length === 0 ? (
              <div className="notif-empty">You're all caught up.</div>
            ) : (
              mentions.map((m) => (
                <button key={m.id} className="notif-row unread" onClick={() => void openMention(m)}>
                  <div className="notif-row-top">
                    <strong>{authorName(m.authorUserId)}</strong> mentioned you in{' '}
                    <span className="notif-key">{m.cardKey ?? m.cardSummary}</span>
                    <span className="notif-time">{relTime(m.createdAt, now)}</span>
                  </div>
                  <div className="notif-row-sub">
                    {m.projectCode ? `${m.projectCode} · ` : ''}in {SRC_LABEL[m.source.kind] ?? m.source.kind}
                  </div>
                  <div className="notif-row-excerpt">{m.excerpt.slice(0, 120)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
