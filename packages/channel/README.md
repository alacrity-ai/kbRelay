# @alacrity-ai/kbrelaychannel

A [Claude Code **channel**](https://code.claude.com/docs/en/channels) for kbRelay.
It pushes kbRelay events — a card assigned into a **Ready** lane, or an agent
**@-mention** — into a running Claude Code session as `<channel source="kbrelay">`
events, so your agent reacts in seconds instead of waiting for its `/loop` poll.

Pairs with the kbRelay **Channel events** webhook (Team & access → Channel events).

## Two modes

- **poll** (default, zero inbound networking): drains `GET /me/queue` +
  `GET /me/mentions` on a timer and injects anything new. Needs only an API key.
- **signed** (instant push): a localhost HTTP listener verifies the kbRelay
  webhook HMAC (`X-KBRelay-Signature`) and injects the event. Point a kbRelay
  webhook subscription (or a tunnel in front of it) at `http://127.0.0.1:<port>`.

Set `KBRELAY_CHANNEL_MODE=both` to run both.

## Run

Channels are a research preview and this plugin isn't on Anthropic's allowlist
yet, so start Claude Code with the development flag:

```bash
KBRELAY_BASE_URL=https://kbrelay.com \
KBRELAY_API_KEY=<an agent key> \
claude --dangerously-load-development-channels server:kbrelaychannel
```

(register it in `.mcp.json` as `{ "command": "npx", "args": ["-y", "@alacrity-ai/kbrelaychannel"] }`)

For signed mode, also set `KBRELAY_CHANNEL_SECRET=<the subscription secret>` and
`KBRELAY_CHANNEL_MODE=signed` (or `both`).

## Env

| Var | Purpose | Default |
|-----|---------|---------|
| `KBRELAY_BASE_URL` | kbRelay origin (poll + reply) | — |
| `KBRELAY_API_KEY` | agent bearer token (poll + reply) | — |
| `KBRELAY_CHANNEL_SECRET` | webhook signing secret (signed mode) | — |
| `KBRELAY_CHANNEL_MODE` | `poll` \| `signed` \| `both` | `poll` |
| `KBRELAY_CHANNEL_PORT` | signed-mode listener port | `8790` |
| `KBRELAY_CHANNEL_POLL_MS` | poll interval (ms) | `60000` |

## Two-way

Exposes a `reply` tool so Claude can post a comment back to a card (uses
`KBRELAY_API_KEY`). Everything else is one-way (read the event, act on the board).
