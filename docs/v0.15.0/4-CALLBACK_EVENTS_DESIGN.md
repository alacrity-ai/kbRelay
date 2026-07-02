# kbRelay v0.15.x — Callback Events: the push transport (KBR-8 build)

**Status:** Design, ready to build. This is the **producer side** the flow feature
was designed to arm — it turns "assign a card into Ready / @-mention an agent"
into a real **push** to a Claude Code channel (or a routine `/fire`), instead of
waiting for the `/loop` poll. Synthesizes and implements the recommendations in
[`0-CALLBACK_RESEARCH.md`](./0-CALLBACK_RESEARCH.md) (transport options) and
[`2-HUMAN_AGENT_FLOWS_DESIGN.md`](./2-HUMAN_AGENT_FLOWS_DESIGN.md) §8 (the trigger
definitions). Grounded in the shipped v0.15.0 code (migrations `0001`–`0013`).

**What's already shipped (v0.15.0):** column roles, the actionable queue
(`GET /me/queue` / `list_my_queue`), and the handback contract. Agents find work
by **polling** (`/loop` + `list_my_queue`, or a cron routine draining
`get_mentions`). That works today with zero push infra.

**What this adds:** an **outbound webhook** that fires the instant a card becomes
actionable, so a running Claude Code session (via a **channel**) or a cloud
**routine** reacts in seconds. Plus the **enable/disable toggles** and a
**channels help tutorial** so a user can actually turn it on.

---

## 1. Scope & the two triggers

kbRelay fires an outbound event on exactly two state changes (the single
definition of "actionable" from the flow design, §8):

1. **Assign-into-ready** — a card **enters a `ready`-role column while assigned
   to an agent**, OR is **assigned to an agent while already in a `ready`
   column**. This is the "go, work it" signal.
2. **Agent @-mention** (this is what blocked **KBR-14**) — a new `card_mentions`
   row is created whose **recipient is an agent** user. Open-ended: the agent
   reads the card/comment and decides what to do (comment, move to done/blocked,
   answer a question).

Everything else (moves between non-ready lanes, human mentions, edits) fires
nothing. Leaving `ready`/reassigning away is a no-op (no "retract" event — the
queue is the source of truth; the event is just a nudge).

---

## 2. The toggles — where on/off lives (decision)

@leif asked: per-project or per-tenant? **Decision: layered — a tenant-level
*subscription* is the master faucet; a per-project boolean is the room valve.**
Neither alone is right; here's why:

- **Tenant-level (the master).** Push needs a **delivery target** — a URL + a
  signing secret + which agent it's for. That's tenant infrastructure, so it
  lives as a **webhook subscription** managed by an admin in **Team & access**
  (right beside API keys and agent users, which are already tenant-level and
  admin-owned). *Nothing fires until an admin deliberately creates + enables a
  subscription* — the deliberate "turn push on at all" act.
- **Per-project (the valve).** The visible switch @leif wants: a
  **`agentEventsEnabled`** boolean on each project, shown in **Project Settings
  → General**, **default ON**. It lets a noisy or experimental board opt *out*
  without tearing down tenant infra. It can't turn push *on* by itself (no
  target), which is why it's a valve, not a gate.

**An event fires iff:** an **enabled tenant subscription** exists for the target
agent **AND** the card's **project has `agentEventsEnabled = 1`** **AND** the
change is one of the two triggers in §1.

> Why default the per-project valve ON (not OFF)? The deliberate act is already
> "set up a subscription" (tenant). Once push is wired, making every board
> participate by default is the least-surprising behavior; muting a specific
> board is the rare case. (If we later find it too broad, flipping the default is
> a one-line change — the column is additive either way.)

---

## 3. Delivery — mirror the email path exactly

kbRelay already does fire-and-forget outbound over `waitUntil` with a graceful
no-op when unconfigured (`services/mailgun.ts`, and `RouteContext.waitUntil` is
already threaded for email). We copy that shape 1:1:

- **Fire from the route handler, not the repo.** Repos stay pure SQL (the
  `check-boundaries` guard). The card/comment repos already compute what changed
  (`patchCard` derives `moved`/`assigned` events; `reconcileMentionStmts` returns
  the added recipients) — we **surface those** to the handler, which decides
  whether a trigger fired and calls `ctx.waitUntil(dispatchWebhooks(...))`. So
  the response never blocks on webhook delivery.
- **`services/webhooks.ts`** (new, mirrors `services/mailgun.ts`): builds the
  payload, signs it, `fetch`es the subscription URL. If no matching enabled
  subscription → **short-circuit no-op** (like mailgun when `MAILGUN_*` unset), so
  local/self-host and un-configured tenants Just Work with zero push.
- **Signature:** `X-KBRelay-Signature: sha256=<HMAC(secret, rawBody)>` +
  `X-KBRelay-Delivery: <uuid>` + `X-KBRelay-Event: card.ready|card.mention`.
  Web Crypto `crypto.subtle` (Workers-native) does the HMAC.
- **At-most-once, best-effort.** One `fetch`, no hard retry in v1 (a couple of
  quick retries on 5xx is a fine follow-up). The **`/loop` / queue poll is the
  durable backstop** — a dropped push is picked up on the next poll, so we don't
  need delivery guarantees. This is the same "timeline/queue is the source of
  truth; the event is a nudge" stance as the flow design.

### Payload (signed JSON)
```jsonc
{
  "event": "card.ready",              // or "card.mention"
  "deliveryId": "whd_…",
  "ts": 1782960000000,
  "tenant": { "id": "t_lala", "slug": "lala" },
  "card": { "id": "card_…", "key": "KBR-42", "summary": "Fix mint-token",
            "projectId": "prj_…", "projectCode": "KBR", "columnRole": "ready",
            "assigneeUserId": "u_claude" },
  "actor": "u_leif",                  // who caused it
  "recipient": "u_claude",            // the agent to nudge
  "source": { "kind": "assign" }      // or { kind:"mention", location:"comment", commentId:"evt_…" }
}
```
The receiver (channel bridge / routine) turns this into a `<channel>` event or a
routine run. kbRelay stays **transport-agnostic**: the subscription `url` may
point at a local channel bridge (via a tunnel), an Anthropic routine `/fire`
endpoint, an OpenClaw Gateway, or anything that speaks HTTP.

---

## 4. Data model (additive migration `0014`)

```sql
-- 0014_webhook_subscriptions.sql (additive; t_lala-safe)
CREATE TABLE webhook_subscriptions (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  url                TEXT NOT NULL,
  secret             TEXT NOT NULL,            -- HMAC signing secret (see §7)
  target_agent_user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = any agent
  enabled            INTEGER NOT NULL DEFAULT 1,
  created_by         TEXT NOT NULL REFERENCES users(id),
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX idx_webhooks_tenant ON webhook_subscriptions(tenant_id);

-- Per-project valve (default ON). Additive column; existing rows read as 1.
ALTER TABLE projects ADD COLUMN agent_events_enabled INTEGER NOT NULL DEFAULT 1;
```

Optional (deferrable) `webhook_deliveries` log for debugging/idempotency — skip
in v1; the delivery id in the header is enough for the receiver to dedupe.

Shared types: `WebhookSubscriptionDto` + zod create/patch inputs; add
`agentEventsEnabled: boolean` to `ProjectDto` and `patchProjectInput`.

---

## 5. API surface

- **`/api/v1/webhooks`** — admin-gated CRUD, mirroring `routes/tokens.ts` /
  `routes/agents.ts` (list / create / patch / delete). Create returns the
  `secret` **once** in plaintext (like a token) so the admin can configure the
  receiver; thereafter it's used server-side to sign and not re-shown.
  - `db/repos/webhooks.ts` (pure SQL) + `routes/webhooks.ts` (admin check like
    agents) + router entries + `openapi.ts` (parity test).
- **Project toggle** rides the existing `PATCH /api/v1/projects/:id` —
  `patchProjectInput`/`patchProject` gain `agentEventsEnabled`. `ProjectDto`
  returns it. (MCP `update_project` can expose it too.)
- **Trigger wiring:** `handlePatchCard` / `handleCreateCard` / `handleAddComment`
  inspect the change-descriptor the repo now returns and, on a §1 trigger, call
  `ctx.waitUntil(dispatchWebhooks(env, …))`.

---

## 6. Web surface

- **Team & access → a "Channel events" (webhooks) panel** (admin): add/edit/
  delete a subscription (label, URL, target agent, enabled), see the secret once
  on create. Sits beside the Agents/API-keys panels; reuse their table/modal
  patterns.
- **Project Settings → General:** an `agentEventsEnabled` toggle ("Notify agents
  of activity on this board"), default on, with a hint that it only matters once
  an admin has set up channel events for the tenant.
- Copy is honest about the research-preview status of channels (see §8).

---

## 7. The receiver — a kbRelay channel plugin (client side)

Per `0-CALLBACK_RESEARCH.md §2`, the recommended receiver is a **kbRelay channel
plugin**: a small Bun MCP server (the ~30-line webhook-receiver from the channels
reference) that:
1. Listens on localhost for the signed POST, **verifies the HMAC** against the
   subscription secret, and **checks a sender allowlist** (channels are a
   prompt-injection vector — gate before emitting).
2. Emits `notifications/claude/channel` with the card context as `<channel
   source="kbrelay" …>` so the running session reacts.
3. (Two-way, optional) exposes a `reply` tool that writes a comment back via the
   kbRelay API.

Packaged like `packages/mcp` (e.g. `packages/channel`), shipped in a kbRelay
marketplace; runs behind `--dangerously-load-development-channels` until
allowlisted. A **poll-mode variant** (the bridge polls `/me/queue` + `/me/mentions`
and injects events, no inbound networking) is the zero-config fallback from
research §2.5 and a good first cut.

Reachability: the Worker can't reach `localhost`, so either the user runs a
tunnel (Cloudflare Tunnel / `hookdeck listen`) in front of the bridge, **or** the
subscription `url` targets a cloud endpoint (routine `/fire`), **or** we ship the
poll-mode bridge and skip inbound networking entirely.

---

## 8. The channels help tutorial

Extend the shipped **`ClaudeCodeGuide`** (KBR-15) rather than a new modal — add a
page (or an "Advanced: instant push with channels" expander on the existing
Step 2 page) that spells out the real prerequisites, since channels are a
**research preview**:
- Requires Claude Code **≥ v2.1.80** and **Anthropic auth** (claude.ai / Console
  key; not Bedrock/Vertex/Foundry).
- **Team/Enterprise orgs must enable `channelsEnabled`** (an Owner, in managed
  settings). Include a "check it's on for you" pointer (the fakechat quickstart).
- Our channel isn't allowlisted yet → run with
  **`--dangerously-load-development-channels`**.
- How to install/run the kbRelay channel bridge, and where to paste the webhook
  URL + secret from the Team & access panel.
Keep copy short; link out for depth. Copyable, origin-aware snippets via the
shared `lib/setupSnippets.ts`.

---

## 9. Security, parity, safety

- **Secret storage.** The signing secret must be readable at send time to HMAC,
  so it's stored in D1 (unlike token *hashes*). Acceptable for webhook secrets
  (industry norm), but call it out: it's a shared secret, rotatable by
  regenerating the subscription; never logged; shown once on create. (A later
  hardening could encrypt it with a Worker secret.)
- **RBAC/tenant.** Subscriptions are tenant-scoped and admin-only (member → 403),
  like agents. Payloads only ever describe the subscription's own tenant.
- **No new inbound attack surface on kbRelay** — this is outbound only. The
  prompt-injection surface is on the *receiver* (the channel bridge), handled by
  HMAC verify + sender allowlist there (§7).
- **Parity:** OpenAPI↔router parity for the new routes; anything the board does
  (manage subscriptions, toggle a project) the API/MCP can do.
- **Additive + `t_lala`-safe:** `0014` only adds a table + a defaulted column;
  no existing behavior changes; unconfigured tenants fire nothing.
- **Boundary guards:** SQL stays in `db/repos/webhooks.ts`; `fetch`/HMAC live in
  `services/webhooks.ts`; orchestration in route handlers.

---

## 10. Non-goals / deferred

- Delivery retries/backoff + a `webhook_deliveries` audit log (v1 is best-effort;
  poll is the backstop). 
- Per-key scopes/expiry, multiple secrets, secret encryption-at-rest.
- User-configurable event types / filtering beyond the two triggers + the
  per-project toggle.
- The unassigned-"pool" trigger (still deferred from the flow design).

---

## 11. Build plan — tickets

| Ticket | Title | Surface | Dep |
|--------|-------|---------|-----|
| **KBR-16** | Callback events: outbound webhooks + subscription CRUD + toggles + assign-into-ready trigger | migration + api + web | v0.15.0 |
| **KBR-14** *(exists, Blocked)* | @-mention-of-agent trigger — rides on KBR-16's dispatcher | api | KBR-16 |
| *(follow-on)* | kbRelay **channel plugin** package (signed receiver + poll-mode) | new package | KBR-16 |
| *(follow-on)* | Channels **help tutorial** page in ClaudeCodeGuide | web | KBR-16 |

KBR-16 is the core producer (the dispatcher + subscription model + toggles +
the assign-into-ready trigger). Once it lands, **KBR-14 unblocks** (its
@-mention trigger is just a second call into the same dispatcher), and the
receiver-plugin + tutorial follow. Cross-cutting acceptance as always: `make
test` + `make check-boundaries` green, OpenAPI↔router parity, additive/`t_lala`-
safe migration, parity.
