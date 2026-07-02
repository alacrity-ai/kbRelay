# kbRelay v0.15.0 — SPIKE: Callback / Agent-Notification Research (KBR-8)

**Status:** Research spike. No code shipped. This document is the deliverable.
**Question:** When a human creates/assigns/@-mentions a card in kbRelay, how do we
get a Claude Code agent running on the user's machine to *react* — ideally a
**push** ("Claude, look at this"), with **polling** as an acceptable fallback?
The user prefers a **working Claude Code path** (plugin/native); OpenClaw and
"jenky-but-working" options are in scope only if the native path can't do it.

**Bottom line up front:** Yes — true push is possible today, natively, via
**two** complementary Claude Code features, and a **single kbRelay outbound-
webhook feature feeds both**:
1. **Channels** (research preview, CC ≥ v2.1.80) — an MCP server that **pushes
   events into a *running* session**. Best when you're at your desk working the
   real repo: assign a card → it lands in your session in seconds.
2. **Cloud Routines fired by API/GitHub webhook** — kbRelay POSTs to a routine's
   `/fire` endpoint → a **cloud** run with **no PC on**. Best for unattended,
   self-contained ticket work.

Zero-code fallbacks work **today** with no kbRelay changes — **`/loop`** in a
session, or a **cron Routine / Desktop task** that drains `get_mentions`. Not the
answer: **hooks** (they fire on Claude Code's own lifecycle, not external events)
and **plain MCP** (pull-only). Recommendation and phasing are in §7–§8; the
day-one move is Phase 0 (`/loop`), the durable investment is one outbound webhook
(§7.1).

---

## 1. The core constraint

Claude Code is a local process attached to a terminal (or a headless
`claude -p` run). There is **no public inbound socket** on a running interactive
session that an external web app can POST to directly. So "magically push into
the session" requires *something local* that (a) is reachable by the outside
world and (b) can hand the event to the session. Every viable push design is a
variation on that bridge. The good news: Anthropic built the bridge — it's
called a **channel**.

The mechanisms below are ranked by how well they answer KBR-8's "push" ask.

| Mechanism | Push or poll? | Works while user is away? | Needs kbRelay changes? | Fit |
|---|---|---|---|---|
| **Channels** (MCP → running session) | **True push** | Session must stay open | Outbound webhook + channel plugin | ★★★★★ best *in-session* push (real files, at desk) |
| **Cloud Routine — API/GitHub trigger** | **True push** | **Yes — machine off** | Outbound webhook → Anthropic `/fire` endpoint | ★★★★★ best *unattended* push (self-contained work) |
| **Cloud Routine — cron** | Poll | **Yes — machine off** | None (reads `/me/mentions` via MCP) | ★★★★☆ safety-net sweep |
| **Agent SDK webhook daemon** | **True push** | Yes (wherever deployed) | Outbound webhook → your daemon | ★★★☆☆ max control, most ops |
| **Desktop scheduled tasks** | Poll | Machine on, no session needed | None | ★★★☆☆ |
| **`/loop` / ScheduleWakeup** | Poll | Session must stay open | None | ★★★☆☆ simplest *today* |
| **Plugin background monitor** | Session-scoped stream | Session must stay open | None | ★★☆☆☆ local watch |
| **Remote Control** (phone drives session) | Human-in-loop | You drive it | None | ★★☆☆☆ adjacent |
| **Claude Code on web / Slack** | Spawns *fresh* cloud session | Yes | Would need a bot/integration | ★★☆☆☆ different model |
| **Hooks** | Neither (lifecycle-only) | — | — | ✗ not an inbound path |
| **Standard MCP** | Pull only | — | — | ✗ (kbRelay MCP already exists) |
| **OpenClaw** | True push (its own runtime) | Yes | Webhook | ★★★☆☆ if not using CC |

There are **two co-equal winners**, and they answer different halves of the
ask: **Channels** for instant reaction *in the session you're working in* (your
real files, at your desk), and a **Cloud Routine fired by API/GitHub** for
*unattended* reaction (machine off, self-contained work). Crucially, **one
kbRelay feature — an outbound webhook — feeds both** (and OpenClaw, and a future
Slack bot). Build the webhook once; point it wherever.

---

## 2. The recommended path — Channels (native push)

> Docs: [Channels](https://code.claude.com/docs/en/channels) ·
> [Channels reference](https://code.claude.com/docs/en/channels-reference)

### 2.1 What a channel is

A **channel is an MCP server that pushes events into a running Claude Code
session** so Claude can react to things that happen outside the terminal. Claude
Code spawns it as a stdio subprocess (like any MCP server), but it declares one
extra capability — `experimental['claude/channel']` — which makes Claude Code
register a listener for `notifications/claude/channel` events the server emits.
The event lands in Claude's context wrapped in a `<channel source="...">` tag,
mid-session, on the next turn.

Two shapes:
- **One-way** (alert forwarder): server emits events, Claude acts. This is all
  KBR-8 strictly needs.
- **Two-way** (chat bridge): server also exposes a **`reply` tool** so Claude can
  send a message back out through the channel. For kbRelay this maps to *posting
  a comment / handoff back onto the card*.

Requirements & guardrails (important, this is a **research preview**):
- **Claude Code ≥ v2.1.80** (permission relay needs ≥ v2.1.81).
- **Anthropic auth** (claude.ai or Console API key). **Not** available on Bedrock
  / Vertex / Foundry.
- Runtime with the `@modelcontextprotocol/sdk` package — Bun/Node/Deno all work
  (official channel plugins use **Bun**).
- Opt-in **per session** with `claude --channels plugin:<name>@<marketplace>`.
- During the preview, only channels on Anthropic's **allowlist** register.
  A channel you build/ship yourself runs with
  `--dangerously-load-development-channels server:<name>` (or
  `plugin:<name>@<marketplace>`) until it's allowlisted.
- **Team/Enterprise** orgs must set `channelsEnabled: true` in managed settings
  (Pro/Max users skip this). kbRelay's own dev is under `t_lala` — check the
  org's Claude Code admin settings before relying on this.
- **The session must be open.** Events only arrive while Claude Code is running;
  for always-on, run it in a persistent terminal / background session.
- **Delivery is fire-and-forget.** `notifications/claude/channel` is not acked;
  if no session is listening, the event is **dropped silently**. (So we still
  want the timeline as the durable record — see §6.)

### 2.2 How the event actually gets pushed (the protocol)

The whole one-way server is ~30 lines. The load-bearing parts:

```ts
// declare the channel capability → Claude Code registers the listener
const mcp = new Server(
  { name: 'kbrelay', version: '0.1.0' },
  {
    capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions:
      'Events arrive as <channel source="kbrelay" card_key="..." event="...">. ' +
      'Read the card via the kbrelay MCP (get_card), do the work, move the card, ' +
      'and report on the timeline with add_comment. Reply with the reply tool to ' +
      'post a comment back onto the card.',
  },
)
await mcp.connect(new StdioServerTransport())

// ...on an inbound kbRelay webhook (see §2.3), after verifying the sender:
await mcp.notification({
  method: 'notifications/claude/channel',
  params: {
    content: 'You were assigned KBR-42: "Fix the mint-token script". Take it.',
    meta: { card_key: 'KBR-42', card_id: 'card_...', event: 'assigned', project: 'KBR' },
  },
})
```

That surfaces to Claude as:

```
<channel source="kbrelay" card_key="KBR-42" card_id="card_..." event="assigned" project="KBR">
You were assigned KBR-42: "Fix the mint-token script". Take it.
</channel>
```

`meta` keys must be identifier-safe (letters/digits/underscore; hyphens are
dropped). `source` is set automatically from the server name.

### 2.3 Proposed kbRelay architecture

Two pieces — one server-side (kbRelay), one client-side (the channel bridge):

```
  kbRelay Worker                     user's machine
 ┌────────────────┐   webhook POST  ┌───────────────────────────┐
 │ card assigned/ │ ───────────────▶│ kbrelay-channel (Bun MCP) │
 │ @-mentioned    │  (HMAC-signed)  │  • local HTTP :PORT        │
 │  → fire hook   │                 │  • verifies signature      │
 └────────────────┘                 │  • checks sender allowlist │
                                     │  • mcp.notification(...)   │──┐ stdio
                                     └───────────────────────────┘  │
                                                                     ▼
                                                        ┌───────────────────────┐
                                                        │ claude --channels ...  │
                                                        │  reads <channel> tag,  │
                                                        │  uses kbrelay MCP tools│
                                                        │  (get_card/update_card/│
                                                        │   add_comment), then   │
                                                        │  reply → POST comment  │
                                                        └───────────────────────┘
```

**A. kbRelay server side — a new outbound-webhook feature (the real product
work).** Today kbRelay has no way to notify anything; `@-mentions` are a
side-effect-free projection you *pull* via `GET /me/mentions`. We add an
**outbound** path:
- A per-tenant (or per-agent-user) **webhook endpoint URL + signing secret**,
  managed in Team & access alongside API keys.
- Fire on the events that already exist as triggers: **card assigned to an agent
  user**, and **`@handle` mention of an agent user** (reuse the `card_mentions`
  projection that already computes recipients). Optionally a card "notify agent"
  affordance as the user mused, but *assignment + mention already are the
  signal* — no new card field strictly required.
- Payload: `{ event, card: {id,key,summary,projectCode}, actor, recipient,
  columnId, ts }`, signed with **HMAC-SHA256** over the body
  (`X-KBRelay-Signature`), plus delivery id for idempotency.
- Cloudflare-native: fire it from the Worker via `waitUntil(...)` (the router
  already threads `waitUntil`, used for email) so it never blocks the response.

**B. Client side — a `kbrelay` channel plugin.** A thin Bun MCP server (the §2.2
skeleton) that listens on localhost, **verifies the HMAC signature and a sender
allowlist** (channels are a prompt-injection vector — the docs are emphatic:
gate on sender identity before emitting), then pushes the `<channel>` event.
Because the local listener needs to be reachable from the Worker, the user
either runs it behind a tunnel (Cloudflare Tunnel / `hookdeck listen` — the
Hookdeck integration is a documented pattern for exactly this) or we invert it
(see §2.5). Package it as a plugin in a kbRelay marketplace so install is
`/plugin install kbrelay@...` then `--channels`.

**Two-way (recommended):** add a `reply` tool whose handler calls the kbRelay API
to `add_comment` on the card — so "Claude replies" becomes "Claude posts a
handoff to the timeline," keeping provenance intact. In practice Claude can also
just call the existing `add_comment` MCP tool directly; the `reply` tool is only
needed if we want the channel itself to own the write-back.

### 2.4 Permission relay (nice-to-have)

If a session is truly unattended and Claude hits a permission prompt, it stalls.
Options: (a) run with `--dangerously-skip-permissions` in a trusted sandbox, or
(b) implement the channel's **permission-relay** capability
(`claude/channel/permission`, CC ≥ v2.1.81) to forward approve/deny prompts to a
phone via a chat channel. For a first cut, an assigned-work agent doing ticketed
tasks in a trusted repo can run with skip-permissions; relay is a later polish.

### 2.5 Simplification worth considering

Rather than exposing a local port to the internet (tunnels, signatures, sender
gating), the channel plugin can **poll `GET /me/mentions` itself** on a short
interval and emit a `notifications/claude/channel` event for each new mention.
This keeps the "push into the session" UX (Claude reacts without you typing)
while avoiding all inbound-networking/security surface — kbRelay needs **zero**
changes, and it degrades gracefully. It's technically polling under the hood but
delivers the *feel* of push. Strong candidate for the MVP (see §8, Phase 1.5).

---

## 3. The other winner — Cloud Routines (machine-off push *and* poll)

> Docs: [Routines](https://code.claude.com/docs/en/routines) ·
> [Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)

Routines run a Claude Code prompt **on Anthropic-managed cloud infrastructure**
— **no local machine, no open session required.** They come in three trigger
flavors, and two of them are *push*:

- **API trigger (webhook) — this is the clean unattended push.** Each routine
  has a fire endpoint; kbRelay's outbound webhook POSTs to it directly, with the
  card context as `text`. Per the routines docs this looks like:

  ```bash
  curl -X POST https://api.anthropic.com/v1/claude_code/routines/{routine_id}/fire \
    -H "Authorization: Bearer <routine token>" \
    -H "anthropic-beta: <routines preview header>" \
    -d '{"text": "KBR-42 assigned to you: fix mint-token. Work it."}'
  ```

  It returns a session URL you can watch. **No local bridge, no tunnel, no open
  terminal** — kbRelay's webhook just calls Anthropic. The routine (kbRelay MCP
  configured as a connector) then does `get_card` → work → `update_card` +
  `add_comment` → `mark_mentions_read`.
- **GitHub trigger** — fires on `pull_request` / `release` with author/label/
  branch filters. Not directly kbRelay, but relevant if ticket work is
  PR-shaped.
- **Cron trigger (poll)** — runs on a schedule; **min interval 1 hour**. Zero
  kbRelay changes: a routine that periodically drains `get_mentions` is a
  robust *safety-net sweep* for anything a push missed.

Trade-offs (all three): runs **autonomously** (no permission prompts, so scope
it carefully), on a **fresh clone with no access to your local files**, subject
to a **daily routine-run cap** during preview. So Routines suit **self-contained
tickets** ("write the migration," "fix the script," "draft the doc"), not "edit
the working tree I have open." Exact endpoint path / beta header are
preview-versioned — confirm against the live routines docs before wiring.

**How it pairs with Channels:** Channels = instant reaction *in* the session
you're actively working (real files, at your desk). Routine-fire = reaction when
you're *away* (cloud, machine off). kbRelay's single outbound-webhook feature
(§7.1) can target *either* per subscription — a local channel bridge, or the
routine `/fire` endpoint. That's the whole reason the webhook is the real
investment.

## 3a. Agent SDK webhook daemon (max control, most ops)

If we ever need **sub-hour latency, custom pre-processing, or a self-hosted
agent** (not Anthropic-managed), the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
(or plain headless `claude -p`) is the escape hatch: stand up a small service
(Lambda/Vercel/Docker/bare metal) that receives the kbRelay webhook and spawns a
headless Claude run per event, resuming sessions by id as needed. It's the most
flexible and the most operational overhead — a Phase-3 option, not a starting
point. Again, it consumes the *same* outbound webhook.

## 3b. Plugin background monitor (local, session-scoped)

A Claude Code **plugin can ship a background monitor** — a long-lived command
(e.g. `tail -F`) whose stdout lines are surfaced into the session as they
appear. A kbRelay plugin could ship a monitor that long-polls `/me/mentions` and
prints new ones, giving a push-*feel* with no MCP-channel machinery — but it's
**session-scoped** (only while a session is open) and is essentially the poll
loop of §2.5 in a different wrapper. Noted for completeness; the channel-in-
poll-mode approach (§2.5) is the better version of this idea because the event
lands as a first-class `<channel>` tag Claude is instructed how to handle.

---

## 4. Fallback B — Desktop scheduled tasks & `/loop`

- **Desktop scheduled tasks** — run locally on your machine on a schedule
  (**1-minute** minimum), **no open session required**, with access to local
  files and your configured MCP servers. Good middle ground: near-real-time,
  local-file access, survives restarts. Needs the machine on.
- **`/loop` (+ `ScheduleWakeup`)** — the zero-setup answer available **right
  now**. In any live session: `/loop 5m check my kbRelay mentions and work any
  assigned to me`. Runs the prompt on an interval (or a Claude-chosen dynamic
  interval). Caveats: the **session must stay open**, it's **session-scoped**
  (cleared on a fresh conversation; restored on `--resume` within **7 days**),
  and leaving it polling for days burns tokens each iteration. Fine as the
  interim workflow and the thing to demo the concept with today.

The scheduling matrix, from the docs:

| | Cloud Routine | Desktop task | `/loop` |
|---|---|---|---|
| Runs on | Anthropic cloud | Your machine | Your machine |
| Machine on? | **No** | Yes | Yes |
| Open session? | No | No | **Yes** |
| Local files? | No (fresh clone) | Yes | Yes |
| Min interval | 1 hour | 1 min | 1 min |

---

## 5. Adjacent / rejected mechanisms

- **Hooks** — Claude Code hooks (`SessionStart`, `UserPromptSubmit`, `Stop`,
  `Notification`, `PreToolUse`/`PostToolUse`, `PermissionRequest`, …) fire on
  Claude Code's *own lifecycle*, not on external events. They're great for
  **outbound** notifications (e.g. push a desktop/ntfy/phone alert when Claude
  finishes or needs input — see the ntfy.sh and push-notification community
  recipes), but they are **not an inbound trigger**. So hooks solve "notify *me*
  about Claude," not "notify *Claude* about kbRelay." Not our path.
- **Standard MCP** — strictly client-initiated request/response; the server
  can't push work into the session. kbRelay already ships an MCP
  (`@alacrity-ai/kbrelaymcp`); that's the *pull* surface. Channels are the push
  extension of the same protocol.
- **Remote Control** — lets you drive your *local* session from claude.ai or the
  Claude mobile app. It's human-in-the-loop steering, not an automated kbRelay
  trigger, but it pairs nicely: get a phone alert (via a hook), open Remote
  Control, tell the session to work the ticket.
- **Claude Code on the web / Claude in Slack** — both **spawn a fresh cloud
  session** (web: from a GitHub clone; Slack: from an `@Claude` mention). A
  different execution model from "react in the session I already have open." A
  Slack integration could be a future channel-like front door, but it's not the
  local-session push KBR-8 describes.
- **WhatsApp / messaging** — there is no first-party "WhatsApp → trigger Claude
  Code" integration. The *channels* feature ships **Telegram, Discord, and
  iMessage** bridges today, which is the real, supported version of the
  "messaging pushes into my session" idea the ticket gestured at. WhatsApp isn't
  in the preview set; Telegram is the closest turn-key analog.

---

## 6. OpenClaw (the non-Claude-Code alternative)

OpenClaw is built around exactly this pattern: it exposes a **Gateway webhook**
(`/hooks/wake` for a lightweight nudge, `/hooks/agent` for a full agent run
protected by a shared secret) that turns an inbound event into an agent run and
routes the result back to a channel. If we ever wanted an **always-on, server-
side agent** decoupled from a developer's terminal, OpenClaw's webhook-native
model is a clean fit and arguably less fiddly than tunneling into a local
session. **But** the user's stated preference is Claude Code, and Channels now
give Claude Code the same event-driven capability natively — so OpenClaw is the
**fallback if we later want a headless, server-hosted agent**, not the primary
recommendation. (If we go there, the kbRelay outbound-webhook work from §2.3 is
100% reusable — point it at the OpenClaw Gateway instead of a local channel.)

---

## 7. What kbRelay would actually build

The *client* side (channel plugin, `/loop`, routines) is mostly Claude Code
configuration and a small bridge script — little-to-no kbRelay code. The durable
product investment is **one server-side feature**, reusable across every push
option (Channels, OpenClaw, future Slack):

1. **Outbound webhooks (Worker) — the one durable investment.** Per-subscription
   endpoint URL + secret, managed in Team & access. Fire (via `waitUntil`) on
   **assign-to-agent** and **@-mention-of-agent**, reusing the existing
   `card_mentions` recipient computation. Signed (HMAC), idempotent payload. New
   migration (additive) for a `webhooks` table; new `/api/v1/webhooks*` routes
   (admin-gated, mirroring `tokens`/`agents`). Keep the timeline as the source of
   truth — the webhook is a *notification*, not the record. **The target is
   pluggable**: a local channel bridge (§2.3), an Anthropic **routine `/fire`
   endpoint** (§3 — the auth header/body just needs to match Anthropic's format),
   an OpenClaw Gateway (§6), or a future Slack bot. Build it once.
2. **A `kbrelay` channel plugin** (separate package, like `packages/mcp`): the
   Bun MCP server from §2.2 with signature check + sender allowlist + a `reply`
   tool that writes a comment back. Ship it in a kbRelay marketplace.
3. **Docs**: a "wire kbRelay into Claude Code" guide (mirrors the existing
   in-app MCP setup guide) covering `--channels`, the dev flag during preview,
   and the tunnel/poll options.

*Explicitly optional:* a per-card "notify agent" checkbox. It's a nice UX
affordance, but **assignment and @-mention are already the triggers** — start
without it.

---

## 8. Recommendation & phasing

**Phase 0 — today, zero code.** Use **`/loop`** in a running session
(`/loop 10m check my kbRelay mentions and work anything assigned to @claude`).
Proves the loop end-to-end and is usable immediately. Pair with a **Stop/
Notification hook → ntfy/desktop** so *you* get pinged when Claude finishes.

**Phase 1 — unattended sweep, still ~zero kbRelay code.** Stand up a **Cloud
Routine** (hourly cron) or **Desktop scheduled task** (1-min) that drains
`get_mentions` and works self-contained tickets. This is the "make tickets while
Claude's machine is off, come back to done work" story — and it validates the
routine → kbRelay-MCP loop we'll push to in Phase 2b.

**Phase 1.5 — push-feel without inbound networking.** Ship the **channel plugin
in poll mode** (§2.5): it polls `/me/mentions` and injects each new mention as a
`<channel>` event into the running session. Delivers the "Claude reacts on its
own" UX with **no kbRelay server changes** and no tunnel/security surface. Best
effort-to-payoff ratio for the "special sauce."

**Phase 2 — true push (build the outbound webhook once, §7.1).** Then light up
*both* targets:
- **2a — in-session push:** the signed, event-driven **channel plugin** (§7.2).
  Assigning a card in the UI lands an event in your open session within seconds,
  against your real working tree. Add **permission relay** if unattended
  approval matters.
- **2b — machine-off push:** point the same webhook at a **routine `/fire`
  endpoint** (§3). Assigning a card spawns a cloud run with no PC on. Ideal for
  self-contained tickets.

**Later — if we outgrow the terminal.** Repoint the same webhook at **OpenClaw**
(§6) or an **Agent SDK daemon** (§3a) for a fully self-hosted, always-on agent,
or a **Slack** front door.

This staging **delivers value on day one** (Phase 0/1 need nothing new); the
single reusable server-side webhook (Phase 2) then unlocks genuine push in *both*
the at-desk and machine-off directions, plus every future integration, from one
piece of code.

---

## Sources

- [Push events into a running session with channels — Claude Code Docs](https://code.claude.com/docs/en/channels)
- [Channels reference (build a webhook receiver, protocol, permission relay) — Claude Code Docs](https://code.claude.com/docs/en/channels-reference)
- [Run prompts on a schedule / Scheduled tasks (`/loop`, cron, cloud vs desktop) — Claude Code Docs](https://code.claude.com/docs/en/scheduled-tasks)
- [Routines (cloud agents: cron, API `/fire`, and GitHub triggers) — Claude Code Docs](https://code.claude.com/docs/en/routines)
- [Headless mode & Agent SDK — Claude Code Docs](https://code.claude.com/docs/en/headless)
- [Claude Agent SDK overview — platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Hooks guide (lifecycle events; not an inbound trigger) — Claude Code Docs](https://code.claude.com/docs/en/hooks-guide)
- [Remote Control (drive a local session from phone/web) — Claude Code Docs](https://code.claude.com/docs/en/remote-control)
- [Connecting External Webhooks to Claude Code via Channels (Hookdeck)](https://hookdeck.com/webhooks/platforms/claude-code-channels-webhooks-hookdeck)
- [Feature: External event sources to trigger messages in active conversation — anthropics/claude-code #24983](https://github.com/anthropics/claude-code/issues/24983)
- [Push Notifications for Claude Code (hooks → ntfy.sh) — gianlucanieri.com](https://gianlucanieri.com/2026/03/13/push-notifications-for-claude-code-never-miss-a-prompt-again/)
- [Claude Code Notification Hooks — alexop.dev](https://alexop.dev/posts/claude-code-notification-hooks/)
- [Webhooks plugin — OpenClaw docs](https://docs.openclaw.ai/plugins/webhooks)
- [OpenClaw Webhook Integration: Real-Time Event-Driven Automation — SFAI Labs](https://sfailabs.com/guides/openclaw-webhook-integration)
</content>
</invoke>
