import type { Env } from '../env';
import type { CardDto, WebhookTrigger } from '@kbrelay/shared';
import { activeSubscriptionsForAgent, agentEventsEnabled } from '../db/repos/webhooks';

/**
 * Outbound callback dispatcher (KBR-16). Mirrors services/mailgun.ts: called via
 * `ctx.waitUntil(...)` so the response never blocks, and a **no-op** when there's
 * nothing to deliver (project muted or no matching subscription) — so an
 * un-configured tenant fires nothing. Best-effort, at-most-once: a dropped POST
 * is picked up by the agent's next /loop queue poll (the durable backstop).
 *
 * SQL stays in db/repos/webhooks.ts; this module only reads via those helpers
 * and does the fetch + HMAC (Web Crypto — runtime-neutral).
 */

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deliver all triggers collected for a single card mutation. `card` is the
 * post-mutation DTO; `actorUserId` is who caused it. Each trigger targets one
 * agent (the assignee for card.ready, the mentioned agent for card.mention).
 */
export async function dispatchTriggers(
  env: Env,
  tenantId: string,
  card: CardDto,
  actorUserId: string,
  triggers: WebhookTrigger[],
): Promise<void> {
  if (!triggers.length) return;
  // Per-project mute valve — checked once for the card.
  if (!(await agentEventsEnabled(env, tenantId, card.projectId))) return;

  for (const t of triggers) {
    const subs = await activeSubscriptionsForAgent(env, tenantId, t.recipientUserId);
    if (!subs.length) continue;
    for (const sub of subs) {
      const deliveryId = crypto.randomUUID();
      const body = JSON.stringify({
        event: t.event,
        deliveryId,
        ts: Date.now(),
        tenant: { id: tenantId },
        card: {
          id: card.id,
          key: card.key,
          summary: card.summary,
          projectId: card.projectId,
          columnId: card.columnId,
          assigneeUserId: card.assigneeUserId,
        },
        actor: actorUserId,
        recipient: t.recipientUserId,
        source: t.source,
      });
      const sig = await hmacHex(sub.secret, body);
      try {
        await fetch(sub.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-KBRelay-Event': t.event,
            'X-KBRelay-Delivery': deliveryId,
            'X-KBRelay-Signature': `sha256=${sig}`,
          },
          body,
        });
      } catch {
        /* best-effort; the /loop queue poll is the durable backstop */
      }
    }
  }
}
