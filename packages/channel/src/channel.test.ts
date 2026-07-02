import { describe, it, expect } from 'vitest';
import { verifySignature } from './verify.js';
import { payloadToChannelEvent } from './format.js';
import { diffPoll } from './poll.js';

/** Signature helper mirroring the kbRelay Worker (services/webhooks.ts). */
async function sign(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('verifySignature', () => {
  const secret = 'shhh-super-secret';
  const body = JSON.stringify({ event: 'card.ready', card: { id: 'card_1' } });

  it('accepts a valid sha256= signature', async () => {
    const header = `sha256=${await sign(secret, body)}`;
    expect(await verifySignature(secret, body, header)).toBe(true);
  });
  it('accepts a bare hex digest (no prefix)', async () => {
    expect(await verifySignature(secret, body, await sign(secret, body))).toBe(true);
  });
  it('rejects a tampered body', async () => {
    const header = `sha256=${await sign(secret, body)}`;
    expect(await verifySignature(secret, body + ' ', header)).toBe(false);
  });
  it('rejects the wrong secret and a missing header', async () => {
    expect(await verifySignature('nope', body, `sha256=${await sign(secret, body)}`)).toBe(false);
    expect(await verifySignature(secret, body, null)).toBe(false);
  });
});

describe('payloadToChannelEvent', () => {
  it('maps card.ready with identifier-safe meta', () => {
    const ev = payloadToChannelEvent({
      event: 'card.ready',
      card: { id: 'card_1', key: 'KBR-42', summary: 'Fix it', projectId: 'prj_1' },
    });
    expect(ev.content).toContain('KBR-42 is ready');
    expect(ev.meta).toEqual({ event: 'card.ready', card_key: 'KBR-42', card_id: 'card_1', project_id: 'prj_1', source: 'assign' });
    for (const k of Object.keys(ev.meta)) expect(k).toMatch(/^[a-z0-9_]+$/);
  });
  it('falls back to the card id when there is no key', () => {
    const ev = payloadToChannelEvent({ event: 'card.mention', card: { id: 'card_9', key: null, summary: 's', projectId: 'p' } });
    expect(ev.meta.card_key).toBe('card_9');
    expect(ev.content).toContain('@-mentioned');
  });
});

describe('diffPoll', () => {
  const card = { id: 'card_1', key: 'KBR-1', summary: 'A', projectId: 'p' };
  const mention = { id: 'men_1', cardId: 'card_2', cardKey: 'KBR-2', cardSummary: 'B', projectId: 'p' };

  it('emits new queue cards + mentions once, and remembers them', () => {
    const seen = new Set<string>();
    const first = diffPoll([card], [mention], seen);
    expect(first.events).toHaveLength(2);
    expect(first.newKeys).toEqual(['ready:card_1', 'mention:men_1']);

    for (const k of first.newKeys) seen.add(k);
    const second = diffPoll([card], [mention], seen);
    expect(second.events).toHaveLength(0); // nothing new
  });

  it('emits only the freshly-appeared item', () => {
    const seen = new Set(['ready:card_1']);
    const d = diffPoll([card, { id: 'card_3', key: 'KBR-3', summary: 'C', projectId: 'p' }], [], seen);
    expect(d.newKeys).toEqual(['ready:card_3']);
  });
});
