import { useCallback, useEffect, useState } from 'react';
import type { MentionDto, QueueCardDto, UserDto } from '@kbrelay/shared';
import * as api from '../lib/api';
import { relTime } from './Timeline';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * "My Work" (v0.17.0, KBR-64) — the human mirror of the agent's queue and the
 * default landing view. Three cross-project lists, all composed from existing
 * endpoints (zero new API): my ready-queue, cards awaiting my review (KBR-61),
 * and my unread mentions (click-through marks read).
 */
export default function MyWork({
  users,
  onOpenCard,
  onMention,
  onMentionCountChange,
}: {
  users: UserDto[];
  /** Jump to a card on its board (opens the modal). */
  onOpenCard: (projectId: string, cardId: string) => void;
  /** Jump to a mention's card (Board flashes the source location). */
  onMention: (m: MentionDto) => void;
  /** Keep the bell badge in sync when a mention is read from here. */
  onMentionCountChange: (n: number) => void;
}) {
  const [work, setWork] = useState<QueueCardDto[] | null>(null);
  const [review, setReview] = useState<QueueCardDto[] | null>(null);
  const [mentions, setMentions] = useState<MentionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const user = (id: string | null) => users.find((u) => u.id === id);

  const load = useCallback(async () => {
    try {
      const [queue, m] = await Promise.all([api.getMyQueue(), api.getMentions('unread')]);
      setWork(queue.work);
      setReview(queue.review);
      setMentions(m.mentions);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your work');
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 20_000);
    window.addEventListener('focus', load);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  async function openMention(m: MentionDto) {
    try {
      const { unreadCount } = await api.markMentionsRead({ mentionIds: [m.id] });
      onMentionCountChange(unreadCount);
      setMentions((list) => (list ?? []).filter((x) => x.id !== m.id));
    } catch {
      /* still navigate; it stays unread for next time */
    }
    onMention(m);
  }

  const loading = work == null || review == null || mentions == null;

  const cardRow = (c: QueueCardDto) => {
    const assignee = user(c.assigneeUserId);
    return (
      <button key={c.id} className="mywork-row" onClick={() => onOpenCard(c.projectId, c.id)}>
        <span className="mywork-project">{c.projectCode ?? c.projectName}</span>
        <span className="qf-code">{c.key ?? '—'}</span>
        <span className="mywork-summary">{c.summary}</span>
        {assignee && (
          <span className="avatar sm" title={assignee.name} style={{ background: assignee.color }}>
            {initials(assignee.name)}
          </span>
        )}
        <span className="tl-time">{relTime(c.updatedAt, now)}</span>
      </button>
    );
  };

  return (
    <div className="mywork-wrap">
      <h1 className="mywork-title">My Work</h1>
      {error && <div className="error-text">{error}</div>}
      {loading && !error ? (
        <div className="loading-wrap"><div className="spinner" /></div>
      ) : (
        <>
          <section className="mywork-section">
            <h2 className="mywork-heading">My queue <span className="mywork-count">{work!.length}</span></h2>
            {work!.length === 0 ? (
              <p className="mywork-empty">Nothing to work — cards assigned to you in a <strong>Ready</strong> column land here.</p>
            ) : (
              work!.map(cardRow)
            )}
          </section>

          <section className="mywork-section">
            <h2 className="mywork-heading">Waiting on my review <span className="mywork-count">{review!.length}</span></h2>
            {review!.length === 0 ? (
              <p className="mywork-empty">Nothing to review — when someone hands work back with you as the <strong>reviewer</strong>, it shows here.</p>
            ) : (
              review!.map(cardRow)
            )}
          </section>

          <section className="mywork-section">
            <h2 className="mywork-heading">Unread mentions <span className="mywork-count">{mentions!.length}</span></h2>
            {mentions!.length === 0 ? (
              <p className="mywork-empty">All caught up — when someone <strong>@{'{you}'}</strong>s a card or comment, it shows here. Opening one marks it read.</p>
            ) : (
              mentions!.map((m) => {
                const author = user(m.authorUserId);
                return (
                  <button key={m.id} className="mywork-row" onClick={() => void openMention(m)}>
                    <span className="mywork-project">{m.projectCode ?? m.projectName}</span>
                    <span className="qf-code">{m.cardKey ?? '—'}</span>
                    <span className="mywork-summary">
                      {m.excerpt || m.cardSummary}
                    </span>
                    {author && (
                      <span className="avatar sm" title={author.name} style={{ background: author.color }}>
                        {initials(author.name)}
                      </span>
                    )}
                    <span className="tl-time">{relTime(m.createdAt, now)}</span>
                  </button>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
