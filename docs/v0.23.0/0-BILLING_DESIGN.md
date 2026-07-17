# kbRelay Billing — Implementation Design (KBR-135)

**Status:** approved-for-implementation (authored by Claude, per the monetization spike attached to KBR-135)
**Release:** v0.23.0
**Scope:** per-human-seat subscription billing for kbRelay Cloud (hosted), Square payment rails, 30-day no-card trial, pricing/legal pages. Self-host stays completely free and billing-unaware.

---

## 1. Commercial model (from the monetization spike — settled)

| Offering | Price | Notes |
|---|---|---|
| **Community** | Free | Self-hosted; complete core product; no billing code paths active |
| **Cloud** | **$5 / human / month** or **$50 / human / year** | 30-day full-featured trial, no card required; agents always free |
| **Managed Private** | Custom (target $250–500+/mo) | Manual contact path only in v1 (`mailto:` on pricing page) |

Billing unit = **human seats** (`users.kind='human'` memberships). Agent identities, projects, cards, API and MCP access are never metered.

---

## 2. The load-bearing architecture decision: app-driven recurring billing

We do **not** use Square's Subscriptions API. We use **Customers + Cards-on-file + Payments (+ Refunds) APIs** with our own billing loop on a Cloudflare **Cron Trigger**.

**Why (researched 2026-07-16):**
1. **Square subscriptions do not retry failed cards.** On failure Square emails the buyer an invoice link and the subscription stays `ACTIVE`. Dunning + entitlement enforcement would be app-side *anyway* — Square's scheduler adds a state machine to mirror, not one to outsource.
2. **Per-seat pricing is second-class.** Subscriptions bill a fixed plan-variation price; seat-based pricing means `price_override_money` static overrides with unclear mid-cycle update semantics. Charging `current_seats × unit_price` ourselves at each cycle is exact, transparent, and trivially unit-testable.
3. **No Catalog dependency.** Skipping plan/variation catalog objects removes sandbox+prod setup drift entirely.

What we give up: Square-hosted invoice emails (we send our own receipts via Mailgun) and their scheduler (we own a ~40-line daily sweep). What we gain: one source of truth (D1), deterministic tests, exact seat math, controllable dunning.

**Seat model — "seats are counted, not bought."** Inviting a human simply raises the next renewal's bill; removing one lowers it. No buy-seats flow, no proration, no mid-cycle charges. The upcoming bill (`N seats × $unit`) is always visible in Billing and Team & access. (Mid-cycle seat additions are free until renewal — customer-favorable and abuse-tolerable at $5; revisit if gamed.)

---

## 3. Billing state machine (per tenant)

`billing_state` rows (1:1 with tenants, hosted only):

```
none ──(tenant created, billing enabled)──▶ trialing(30d)
trialing ──subscribe──▶ active          trialing ──trial ends──▶ expired (locked)
active ──renewal charge ok──▶ active    active ──charge fails──▶ past_due
past_due ──retry ok / new card──▶ active
past_due ──14d grace elapses──▶ delinquent (locked)
active ──cancel──▶ canceling (runs to paid_through) ──▶ canceled (locked)
any locked state ──subscribe/pay──▶ active
(t_lala + all tenants existing before migration ──▶ exempt, forever unmetered)
```

**Enforcement (one point):** in `dispatch.ts`, after auth. If tenant is **locked** (`expired|delinquent|canceled`), non-GET `/api/v1/*` routes return **402 `{error:'payment_required'}`** — except auth routes, billing routes, and DELETE on own resources is *not* special-cased (reads stay open so humans and agents can always see and export their data; the SPA shows a paywall banner). `trialing`, `active`, `past_due`, `exempt`, and self-host (`billing disabled`) pass through untouched.

**Seat gates:** none during `trialing`/`active` (reasonable use) — but `inviteMember`/`acceptInvite` are blocked when locked (already covered by the dispatch gate since they're non-GET).

**Dunning:** renewal charge fails → `past_due`, email; retries on day 3 and day 7 (idempotent, from the daily sweep); day 14 → `delinquent` + email. Updating the card from the Billing modal triggers an immediate retry.

**Trial comms:** email at T-7 and T-1 before `trial_ends_at`, and at expiry (all via existing Mailgun template shape, fire-and-forget).

---

## 4. Data model — `apps/api/migrations/0026_billing.sql` (additive-only)

```sql
CREATE TABLE billing_state (
  tenant_id        TEXT PRIMARY KEY REFERENCES tenants(id),
  status           TEXT NOT NULL,             -- trialing|active|past_due|delinquent|expired|canceling|canceled|exempt
  plan             TEXT,                      -- monthly|annual (null until subscribed)
  unit_price_cents INTEGER,                   -- per-seat price for the chosen plan (500 / 5000); per-tenant override = founding price lever
  trial_ends_at    INTEGER,                   -- ms epoch
  paid_through     INTEGER,                   -- ms epoch; renewal anchor
  pending_plan     TEXT,                      -- plan switch applied at next renewal
  square_customer_id TEXT,
  square_card_id   TEXT,
  card_brand       TEXT, card_last4 TEXT, card_exp TEXT,   -- display only
  grace_until      INTEGER,                   -- past_due deadline
  retry_count      INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL,
  created_at       INTEGER NOT NULL
);

CREATE TABLE billing_invoices (
  id            TEXT PRIMARY KEY,             -- inv_* ; ALSO the Square payment idempotency_key (stable across retries)
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  period_start  INTEGER NOT NULL, period_end INTEGER NOT NULL,
  seats         INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL, amount_cents INTEGER NOT NULL,
  status        TEXT NOT NULL,                -- pending|paid|failed|refunded
  square_payment_id TEXT, failure_reason TEXT,
  created_at    INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE (tenant_id, period_start)            -- the double-charge guard
);
```

**Backfill:** every tenant existing at migration time gets `billing_state(status='exempt')` — grandfathers `t_lala` (and self-host installs upgrading through this migration harmlessly carry the schema; feature stays config-gated). New tenants get `trialing` rows created in `registerTenant`/`createTenantForUser` **only when billing is enabled**.

---

## 5. Config & hosted-only gating (mirrors the Mailgun graceful-degrade pattern)

New optional `Env` fields (set only in CF `wrangler.toml`/secrets; `buildNodeBindings` never sets them → self-host structurally billing-free):

| Field | Kind | Notes |
|---|---|---|
| `SQUARE_ACCESS_TOKEN` | secret | ours (LaLa) — **billing is enabled iff this is set** |
| `SQUARE_ENVIRONMENT` | var | `sandbox` \| `production` |
| `SQUARE_LOCATION_ID` | var | fetched once via `GET /v2/locations` |
| `SQUARE_APP_ID` | var | for the Web Payments SDK |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | secret | kbRelay's **own** webhook subscription key (not BML's) |

`billingEnabled(env)` = `!!env.SQUARE_ACCESS_TOKEN`. Every billing surface (trial creation, dispatch gate, cron, routes) short-circuits when disabled; billing routes return 404-style `{error:'billing_disabled'}` so self-host UIs hide cleanly (`GET /billing` reports `{enabled:false}`).

---

## 6. Square service — `apps/api/src/services/square.ts`

Thin raw-`fetch` client (no SDK), lifted from the proven BML/Legends shape: env-switched base URL (`connect.squareup.com` / `connect.squareupsandbox.com`), pinned `Square-Version`, typed error extraction. Used operations:

- `createCustomer(email, name, tenantId ref)` → `POST /v2/customers`
- `createCard(customerId, sourceId /* Web Payments token */)` → `POST /v2/cards` ($0 verification auth)
- `disableCard(cardId)` → on card replacement
- `createPayment({sourceId: cardId, customerId, amountCents, idempotencyKey: invoiceId, note})` → `POST /v2/payments` (autocomplete)
- `verifyWebhookSignature(rawBody, header, notificationUrl, key)` → WebCrypto HMAC-SHA256 over `url+body`, constant-time compare (copied near-verbatim from Legends `square.ts:320-346`)

Webhook endpoint `POST /api/square/webhook` (public, HMAC-verified, outside `/api/v1` → exempt from the OpenAPI parity test): consumes `payment.updated` (sync refunds/disputes → mark invoice `refunded`), `card.automatically_updated` (refresh stored expiry). Fast-ack + `waitUntil`, idempotent by payment id.

**Idempotency rule:** the *invoice id* is the Square `idempotency_key`. Sweep retries and webhook replays can never double-charge (`UNIQUE(tenant_id, period_start)` + stable key).

---

## 7. Billing loop — Worker Cron Trigger (daily)

`wrangler.toml`: `[env.prod.triggers] crons = ["17 6 * * *"]`; `index.ts` exports `scheduled()` alongside `fetch()`. The sweep (all steps idempotent, each tenant isolated in try/catch):

1. **Renewals:** `active|canceling` with `paid_through <= now` → count seats → insert invoice (`INSERT OR IGNORE` on `(tenant, period_start)`) → charge → `paid`: advance `paid_through` (+1 mo/yr, apply `pending_plan`), receipt email; `canceling` → `canceled` instead of charging. Charge failure → `past_due` (`grace_until = now+14d`), email.
2. **Dunning retries:** `past_due` with retry due (day 3/7) → re-charge same invoice; success → `active`; `grace_until` elapsed → `delinquent`, email.
3. **Trials:** `trialing` past `trial_ends_at` → `expired`, email. T-7/T-1 reminder emails (flagged in `billing_invoices`? no — dedupe via `retry_count`-style columns... use dedicated `trial_notice_sent` bitmask column on `billing_state`).
4. Self-host: Node runtime has no `scheduled` — loop never runs.

---

## 8. API surface (all under `/api/v1`, admin-gated except where noted, documented in `openapi.ts`)

| Route | Purpose |
|---|---|
| `GET /billing` | `{enabled, status, plan, seats, unitPriceCents, nextBillCents, trialEndsAt, paidThrough, card{brand,last4,exp}, graceUntil}` |
| `GET /billing/config` | `{appId, locationId, environment}` for the Web Payments SDK (member-visible) |
| `POST /billing/subscribe` | `{plan, sourceId, postalCode?}` → customer+card, **charge first period immediately** (`seats × unit`), → `active` |
| `POST /billing/card` | replace card (+ immediate retry when `past_due`) |
| `POST /billing/plan` | `{plan}` → `pending_plan`, applied at renewal |
| `POST /billing/cancel` · `POST /billing/resume` | → `canceling` / back to `active` (before period end) |
| `GET /billing/invoices` | invoice history |
| `POST /api/square/webhook` | public, HMAC (outside v1) |

Zod schemas in `packages/shared/src/billing.ts`, exported via `index.ts`.

## 9. Web SPA (P2)

- **BillingModal** (`apps/web/src/components/BillingModal.tsx`), opened from the account-menu "Configuration" section (admin-only), following the `TenantSettings`/`ApiKeysModal` pattern. Shows state, seats × price, next bill, card, invoices; hosts the **Web Payments SDK** card form (script `https://{sandbox.}web.squarecdn.com/v1/square.js` loaded lazily from `GET /billing/config`; tokenize → `sourceId` → subscribe/card routes). Never renders when `GET /billing` says `enabled:false` (self-host).
- **Banners** in `BoardApp`: `trialing` (days left + subscribe CTA), `past_due` (fix card), locked (paywall overlay directing admins to Billing, members to their admin; reads still work).
- **Team & access:** seat line — "N human seats · agents are always free · next renewal: $X on DATE".

## 10. Pricing + legal pages (P3)

- `landing.html`: pricing section with the spike's exact three-tier copy ($5/person/mo, $50/yr, self-host free, Managed Private → `mailto:leif@lalalimited.com`), CTA → `/app` signup. "Source-available (ELv2), free to self-host" phrasing — never "open source".
- New static pages `apps/web/terms.html` + `apps/web/privacy.html` (served via `_redirects` at `/terms`, `/privacy`), adapted from BML's proven structures for **LaLa Solutions LLC** (DE), SaaS-ified: Square processes payments (we never see card numbers), **refunds: full refund of the most recent charge within 14 days on request; trial requires no card**; data ownership/export ("your data is yours"), retention (locked-tenant data retained ≥60 days for export, then deletable), ELv2 licensing note, liability cap, DE governing law. Footer links from landing + SPA auth screen.

## 11. Testing (P1/P4)

- **Unit/route tests** on the in-memory libsql harness (`multi-workspace.route.test.ts` pattern): state machine transitions, seat counting (agents excluded), double-charge guard, dispatch 402 gate matrix, trial creation, webhook signature verify (Legends test vectors pattern), sweep idempotency (run twice → one invoice). Square client stubbed at `fetch` boundary.
- **Sandbox E2E (local):** `wrangler dev --env dev` + Square **sandbox**: register → trial → subscribe with test card `4111 1111 1111 1111` (Web Payments sandbox SDK) → verify $0 card auth + first charge in sandbox dashboard-API → force `paid_through` back → run sweep → renewal charge → fail-card path (sandbox decline card) → dunning → cancel. Webhook HMAC tested against the route host per the wrangler-dev signing gotcha.
- **Prod smoke:** deploy, verify `GET /billing` on a fresh test tenant (trialing), Square prod webhook subscription created **via the Webhook Subscriptions API**, config endpoint serves prod app id. First real charge = Leif dogfoods a $5 subscription (self-refundable) — listed as a manual verify item, not automated.

## 12. Rollout order & phases (spinoff tickets)

1. **P1 — Backend core** (migration, service, routes, cron, gates, emails, tests)
2. **P2 — SPA billing UI**
3. **P3 — Pricing + legal pages**
4. **P4 — Sandbox E2E, prod deploy, webhook registration, smoke**
5. **P5 — SOPs** (`claude_ops/docs/sops/squareup-billing.md` + SOPS.md link) **+ backlog spinoffs**

Deploying P1–P3 together is safe: with no `SQUARE_ACCESS_TOKEN` in prod, everything stays dormant; the launch moment is setting the secrets + registering the webhook (P4).

**Deferred to backlog spinoffs (created with this epic):** API rate limiting / abuse controls (the spike's "usage & cost controls" — recommended before *marketing* push, not required for rails), usage/conversion telemetry, inactive-trial data deletion automation, founding-customer pricing page copy (the `unit_price_cents` lever already supports it), data-export bundle endpoint.

## 13. Explicit decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | App-driven billing loop, not Square Subscriptions API | §2 — no dunning, weak seat math, catalog overhead |
| D2 | Seats counted not bought; mid-cycle additions free until renewal | Simplest honest model; matches spike's "expansion should be natural" |
| D3 | Trial = 30d, no card, full-featured | Spike, verbatim |
| D4 | Locked = writes 402, reads open | Data portability promise ("your data is yours") with one dispatch-level gate |
| D5 | `t_lala` + pre-migration tenants → `exempt` | Grandfathering; internal tenant never bills |
| D6 | Founding price = per-tenant `unit_price_cents` override | No coupon engine in v1 |
| D7 | Refund policy: 14-day on request, manual via Square dashboard (SOP) | Matches BML posture; no self-serve refunds v1 |
| D8 | Billing enabled iff `SQUARE_ACCESS_TOKEN` set | House graceful-degrade convention; self-host structurally free |
