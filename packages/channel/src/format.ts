/**
 * Map kbRelay events → Claude Code channel events (KBR-17). A channel event is
 * `{ content, meta }`: `content` becomes the body of the `<channel>` tag Claude
 * sees, `meta` becomes tag attributes (keys must be identifier-safe: letters,
 * digits, underscores). Used by both the signed-webhook and poll modes.
 */

export interface KbRelayWebhookPayload {
  event: 'card.ready' | 'card.mention';
  deliveryId?: string;
  card: {
    id: string;
    key: string | null;
    summary: string;
    projectId: string;
    columnId?: string;
    assigneeUserId?: string | null;
  };
  actor?: string;
  recipient?: string;
  source?: { kind: string; location?: string; commentId?: string | null };
}

export interface ChannelEvent {
  content: string;
  meta: Record<string, string>;
}

/** A webhook payload → a channel event. */
export function payloadToChannelEvent(p: KbRelayWebhookPayload): ChannelEvent {
  const key = p.card.key ?? p.card.id;
  const content =
    p.event === 'card.ready'
      ? `${key} is ready for you: "${p.card.summary}". Take it — move to your in_progress lane and comment, do the work, then move to review with a handoff.`
      : `You were @-mentioned on ${key}: "${p.card.summary}". Read the card/comment and act (reply, move, or answer).`;
  return {
    content,
    meta: {
      event: p.event,
      card_key: key,
      card_id: p.card.id,
      project_id: p.card.projectId,
      source: p.source?.kind ?? (p.event === 'card.ready' ? 'assign' : 'mention'),
    },
  };
}

/** A queue card (from GET /me/queue) → a `card.ready` channel event. */
export function queueCardToChannelEvent(c: {
  id: string;
  key: string | null;
  summary: string;
  projectId: string;
}): ChannelEvent {
  return payloadToChannelEvent({ event: 'card.ready', card: c });
}

/** A mention (from GET /me/mentions) → a `card.mention` channel event. */
export function mentionToChannelEvent(m: {
  cardId: string;
  cardKey: string | null;
  cardSummary: string;
  projectId: string;
  source?: { kind: string; commentId?: string | null };
}): ChannelEvent {
  return payloadToChannelEvent({
    event: 'card.mention',
    card: { id: m.cardId, key: m.cardKey, summary: m.cardSummary, projectId: m.projectId },
    source: { kind: 'mention', commentId: m.source?.commentId ?? null },
  });
}
