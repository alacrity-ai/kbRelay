import { useCallback, useContext, useEffect, useState } from 'react';
import type { ProjectEventDto, UserDto } from '@kbrelay/shared';
import * as api from '../lib/api';
import { CardLinksContext } from '../lib/cardLinks';
import { relTime, systemPhrase } from './Timeline';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2);
  return chars.toUpperCase();
}

/** One-line verb for a feed row. System events reuse the timeline phrasing. */
function phrase(e: ProjectEventDto, userName: (id: string | null) => string): string {
  if (e.deletedAt != null) return 'comment removed';
  if (e.kind === 'system') return systemPhrase(e, userName);
  return e.kind === 'handoff' ? 'posted a handoff' : 'commented';
}

/** First line of a comment body, trimmed for the feed row. */
function excerpt(e: ProjectEventDto): string | null {
  if (e.kind === 'system' || e.deletedAt != null || !e.body) return null;
  const line = e.body.split('\n').find((l) => l.trim()) ?? '';
  return line.length > 140 ? `${line.slice(0, 140)}…` : line;
}

/**
 * Spam control (KBR-72): collapse a consecutive run of look-alike system
 * events — same card, same author, same type (and same fields for `edited`) —
 * into one row with a ×N badge. The list is newest-first, so the first event
 * of a run is the one kept (freshest timestamp + final checklist counts).
 */
function collapseRuns(events: ProjectEventDto[]): { event: ProjectEventDto; runCount: number }[] {
  const fieldsKey = (e: ProjectEventDto) => {
    const f = e.meta?.fields;
    return Array.isArray(f) ? f.join(',') : '';
  };
  const sameRun = (a: ProjectEventDto, b: ProjectEventDto) =>
    a.kind === 'system' && b.kind === 'system' &&
    a.cardId === b.cardId && a.authorUserId === b.authorUserId &&
    a.eventType === b.eventType &&
    (a.eventType === 'task' || (a.eventType === 'edited' && fieldsKey(a) === fieldsKey(b)));
  const out: { event: ProjectEventDto; runCount: number }[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (last && sameRun(last.event, e)) last.runCount++;
    else out.push({ event: e, runCount: 1 });
  }
  return out;
}

/** Day bucket label for grouping ("Today", "Yesterday", or a date). */
function dayLabel(ms: number, now: number): string {
  const d = new Date(ms);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Project activity feed (v0.17.0, KBR-67): "what happened on this board?" —
 * a newest-first, day-grouped view of every card's timeline. Read-only; card
 * keys jump to the card via the CardLinksContext opener.
 */
export default function ActivityFeed({ projectId, users }: { projectId: string; users: UserDto[] }) {
  const [events, setEvents] = useState<ProjectEventDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const cardLinks = useContext(CardLinksContext);

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? 'someone';
  const user = (id: string | null) => users.find((u) => u.id === id);

  const load = useCallback(async (cur?: string) => {
    try {
      if (cur) setMore(true);
      const page = await api.listProjectEvents(projectId, { limit: 50, cursor: cur });
      setEvents((prev) => (cur ? [...prev, ...page.events] : page.events));
      setCursor(page.nextCursor);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
      setMore(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    setEvents([]);
    setCursor(null);
    void load();
  }, [load]);

  if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
  if (error) return <div className="activity-wrap"><div className="error-text">{error}</div></div>;
  if (events.length === 0) {
    return (
      <div className="activity-wrap">
        <div className="activity-empty">No activity yet — events appear here as cards are created, moved, and discussed.</div>
      </div>
    );
  }

  // Collapse spammy runs first (KBR-72), then group by day (newest-first).
  const groups: { label: string; items: { event: ProjectEventDto; runCount: number }[] }[] = [];
  for (const item of collapseRuns(events)) {
    const label = dayLabel(item.event.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="activity-wrap">
      {groups.map((g) => (
        <section key={g.label} className="activity-day">
          <h3 className="activity-day-label">{g.label}</h3>
          {g.items.map(({ event: e, runCount }) => {
            const author = user(e.authorUserId);
            const ex = excerpt(e);
            const p = phrase(e, userName);
            return (
              <div key={e.id} className={`activity-row ${e.deletedAt != null ? 'redacted' : ''}`}>
                <span className="avatar sm" style={{ background: author?.color ?? '#64748b' }}>
                  {author ? initials(author.name) : '?'}
                </span>
                <div className="activity-main">
                  <span className="activity-line">
                    {/* Null author = policy event (auto-archive): phrase stands alone. */}
                    {e.authorUserId != null ? (
                      <>
                        <strong>{userName(e.authorUserId)}</strong>
                        {author?.kind && <span className={`kind-badge ${author.kind}`}>{author.kind}</span>}
                        {' '}{p}
                      </>
                    ) : (
                      <>{p.charAt(0).toUpperCase() + p.slice(1)}</>
                    )}
                    {runCount > 1 && <span className="tl-run"> ×{runCount}</span>}
                    {' '}
                    {e.cardKey && cardLinks ? (
                      <a
                        href={`#card-${e.cardKey}`}
                        className="card-link"
                        title={`Open ${e.cardKey}`}
                        onClick={(ev) => { ev.preventDefault(); cardLinks.openCard(e.cardKey!); }}
                      >
                        {e.cardKey}
                      </a>
                    ) : (
                      <span className="activity-key">{e.cardKey ?? ''}</span>
                    )}
                    <span className="activity-summary"> · {e.cardSummary}</span>
                  </span>
                  {ex && <div className="activity-excerpt">{ex}</div>}
                </div>
                <span className="tl-time">{relTime(e.createdAt, now)}</span>
              </div>
            );
          })}
        </section>
      ))}
      {cursor && (
        <button className="activity-more" disabled={more} onClick={() => void load(cursor)}>
          {more ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
