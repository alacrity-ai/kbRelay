import { queueCardToChannelEvent, mentionToChannelEvent, type ChannelEvent } from './format.js';

/**
 * Poll-mode diff (KBR-17). Given the current `GET /me/queue` + `GET /me/mentions`
 * responses and the set of ids we've already injected, return the channel events
 * for anything NEW plus the ids to remember. Pure + deterministic so it's unit
 * testable and crash-safe (seen-set persists nothing that wasn't emitted).
 */

export interface QueueCard {
  id: string;
  key: string | null;
  summary: string;
  projectId: string;
}
export interface Mention {
  id: string;
  cardId: string;
  cardKey: string | null;
  cardSummary: string;
  projectId: string;
  source?: { kind: string; commentId?: string | null };
}

export interface PollDiff {
  events: ChannelEvent[];
  /** Keys to add to the seen-set (only after the events are emitted). */
  newKeys: string[];
}

export function diffPoll(queue: QueueCard[], mentions: Mention[], seen: ReadonlySet<string>): PollDiff {
  const events: ChannelEvent[] = [];
  const newKeys: string[] = [];

  for (const c of queue) {
    const k = `ready:${c.id}`;
    if (!seen.has(k)) {
      events.push(queueCardToChannelEvent(c));
      newKeys.push(k);
    }
  }
  for (const m of mentions) {
    const k = `mention:${m.id}`;
    if (!seen.has(k)) {
      events.push(mentionToChannelEvent(m));
      newKeys.push(k);
    }
  }
  return { events, newKeys };
}
