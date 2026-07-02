import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createServer as createHttpServer } from 'node:http';
import { verifySignature } from './verify.js';
import { payloadToChannelEvent, type KbRelayWebhookPayload, type ChannelEvent } from './format.js';
import { diffPoll, type QueueCard, type Mention } from './poll.js';

/**
 * The kbRelay channel server (KBR-17). An MCP server Claude Code spawns over
 * stdio; it pushes `notifications/claude/channel` events so a running session
 * reacts to kbRelay activity. Two modes (either or both):
 *  - signed: a local HTTP listener verifies the kbRelay webhook HMAC and injects it.
 *  - poll:   drains GET /me/queue + /me/mentions on a timer — no inbound networking.
 * Optional `reply` tool posts a comment back to the card.
 */

export interface ChannelConfig {
  baseUrl?: string;
  apiKey?: string;
  /** HMAC secret from the kbRelay webhook subscription (signed mode). */
  secret?: string;
  port: number;
  mode: 'signed' | 'poll' | 'both';
  pollMs: number;
}

const INSTRUCTIONS =
  'Events arrive as <channel source="kbrelay" event="card.ready|card.mention" card_key="...">. ' +
  'For card.ready: take the card — move it to your in_progress lane + a note, do the work, then move to review with a handoff. ' +
  'For card.mention: read the card/comment and act. Reply with the `reply` tool (pass card_id) to post a comment back.';

async function postComment(cfg: ChannelConfig, cardId: string, body: string): Promise<void> {
  if (!cfg.baseUrl || !cfg.apiKey) throw new Error('reply needs KBRELAY_BASE_URL + KBRELAY_API_KEY');
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/v1/cards/${encodeURIComponent(cardId)}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ type: 'note', body }),
  });
  if (!res.ok) throw new Error(`reply failed: ${res.status}`);
}

async function getJson<T>(cfg: ChannelConfig, path: string): Promise<T> {
  const res = await fetch(`${cfg.baseUrl!.replace(/\/$/, '')}${path}`, {
    headers: { authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function startChannel(cfg: ChannelConfig): Promise<void> {
  const mcp = new Server(
    { name: 'kbrelay', version: '0.1.0' },
    { capabilities: { experimental: { 'claude/channel': {} }, tools: {} }, instructions: INSTRUCTIONS },
  );

  // Two-way: a `reply` tool that posts a comment back to a card.
  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'reply',
        description: 'Post a comment back to a kbRelay card (pass the card_id from the channel event).',
        inputSchema: {
          type: 'object',
          properties: {
            card_id: { type: 'string', description: 'The card to comment on' },
            text: { type: 'string', description: 'Markdown comment body' },
          },
          required: ['card_id', 'text'],
        },
      },
    ],
  }));
  mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === 'reply') {
      const { card_id, text } = req.params.arguments as { card_id: string; text: string };
      await postComment(cfg, card_id, text);
      return { content: [{ type: 'text', text: 'sent' }] };
    }
    throw new Error(`unknown tool: ${req.params.name}`);
  });

  await mcp.connect(new StdioServerTransport());

  const emit = (e: ChannelEvent): Promise<void> =>
    // Custom channel notification method — not in the standard schema, so cast.
    mcp.notification({ method: 'notifications/claude/channel', params: { content: e.content, meta: e.meta } } as never);

  if (cfg.mode !== 'poll') startSignedListener(cfg, emit);
  if (cfg.mode !== 'signed') startPollLoop(cfg, emit);
}

/** Local HTTP listener: verify the kbRelay HMAC, then inject the event. */
function startSignedListener(cfg: ChannelConfig, emit: (e: ChannelEvent) => Promise<void>): void {
  if (!cfg.secret) {
    process.stderr.write('[kbrelay-channel] signed mode needs KBRELAY_CHANNEL_SECRET — skipping HTTP listener\n');
    return;
  }
  const server = createHttpServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      void (async () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const sig = req.headers['x-kbrelay-signature'];
        // The valid HMAC IS the sender gate — only kbRelay holds the secret.
        const ok = await verifySignature(cfg.secret!, raw, Array.isArray(sig) ? sig[0] : sig);
        if (!ok) { res.writeHead(401).end('bad signature'); return; }
        try {
          await emit(payloadToChannelEvent(JSON.parse(raw) as KbRelayWebhookPayload));
          res.writeHead(200).end('ok');
        } catch {
          res.writeHead(400).end('bad payload');
        }
      })();
    });
  });
  server.listen(cfg.port, '127.0.0.1', () => {
    process.stderr.write(`[kbrelay-channel] signed listener on http://127.0.0.1:${cfg.port}\n`);
  });
}

/** Poll mode: drain the queue + mentions on a timer, inject anything new. */
function startPollLoop(cfg: ChannelConfig, emit: (e: ChannelEvent) => Promise<void>): void {
  if (!cfg.baseUrl || !cfg.apiKey) {
    process.stderr.write('[kbrelay-channel] poll mode needs KBRELAY_BASE_URL + KBRELAY_API_KEY — skipping poll\n');
    return;
  }
  const seen = new Set<string>();
  const tick = async () => {
    try {
      const [{ cards }, { mentions }] = await Promise.all([
        getJson<{ cards: QueueCard[] }>(cfg, '/api/v1/me/queue'),
        getJson<{ mentions: Mention[] }>(cfg, '/api/v1/me/mentions?status=unread'),
      ]);
      const { events, newKeys } = diffPoll(cards ?? [], mentions ?? [], seen);
      for (const e of events) await emit(e);
      for (const k of newKeys) seen.add(k);
    } catch (err) {
      process.stderr.write(`[kbrelay-channel] poll error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  };
  void tick();
  setInterval(() => void tick(), cfg.pollMs);
  process.stderr.write(`[kbrelay-channel] polling every ${Math.round(cfg.pollMs / 1000)}s\n`);
}
