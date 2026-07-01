# kbRelay v0.10.0 — Self-Registration & Human Sessions

**Shipped:** 2026-07-01 · **Design:** `1-TENANT_SELF_REGISTER_DESIGN.md`

The first item of the v0.10.x roadmap. kbRelay is no longer locked to server-minted
tenants: a stranger can sign up, get their own workspace, and log in — while agents'
bearer-token auth stays exactly as it was.

## What shipped

- **Self-registration.** `POST /api/v1/auth/register` creates a tenant + owner (admin)
  user + a starter **"Assistant" agent** user in one atomic D1 batch, then logs the
  owner in. The workspace is agent-ready from minute one (mint the agent a key in the
  API-keys panel).
- **Human sessions.** Email + password (PBKDF2-HMAC-SHA-256, 100k iters) → a stateless
  **HS256 JWT in an HttpOnly `kbrelay_session` cookie** (30-day TTL). New endpoints:
  `login`, `logout`, `forgot-password`, `reset-password`, and `GET /auth/me`.
  `forgot-password` always returns `200` (no account enumeration); reset tokens are
  single-use, sha256-stored, 1-hour TTL.
- **Two auth modes, one context.** The dispatcher tries the **bearer token first**
  (agents/MCP — unchanged), then the **session cookie** (humans). Both resolve to the
  same `AuthContext`.
- **Membership model.** `memberships(tenant, user, role)` is now the source of truth for
  tenant access + role (`admin`/`member`). `users` gained `email` (globally unique),
  `password_hash`, `password_algo`, `email_verified_at`. `users.tenant_id` is retained
  (vestigial origin tenant) so nothing broke.
- **Self-service API keys.** `GET/POST/DELETE /api/v1/me/tokens` — a human mints the
  bearer tokens they give to agents / the MCP; the plaintext secret is shown **once**.
  (The old `tools/mint-token.mjs` logic now lives server-side.)
- **Web.** New `/auth/*` experience (register / sign-in / forgot / reset), replacing
  "paste a token" as the default entry (token paste remains as an advanced option). An
  **API keys** panel in the account menu. Sign-out clears both the cookie and any token.
- **Email.** Mailgun HTTP (welcome + password-reset), **graceful no-op when unset** so
  local/self-host needs no inbox.

## Migration `0010_human_auth.sql` (additive-only)

Adds the `email`/`password_*` columns, a unique email index, and the `memberships` +
`password_reset_tokens` tables. Behavior-preserving backfill: a membership for every
existing `t_lala` user (leif/joe → admin, claude → member) and human emails with null
passwords (set via forgot-password, or keep using the existing token).

## Live-tenant safety (verified on prod)

Deploy order: **export backup → migrate → verify invariants → deploy Worker → deploy
Pages → verify.** Confirmed on prod after rollout: the 6 `t_lala` projects and 38 cards
untouched; 3 memberships backfilled; existing tokens still authenticate with role
resolved from membership (Leif → `admin`). Restore point: `kbrelay-pre0010.sql`.

## New prod config

Worker secrets set via `wrangler secret put --env prod`: `JWT_SECRET` (recorded in
`DO_NOT_COMMIT.md`), `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` (`mg.kbrelay.lalalimited.com`).

## Tests

`packages/shared` account-schema unit tests (13); API `password`/`jwt` unit tests (10);
openapi↔router parity extended to the new routes. All green (94 unit tests) plus a
31-assertion local end-to-end smoke and a 13-assertion prod verification.

## Not in this item (later roadmap)

Invites, team-management UI, per-project RBAC (v0.11.0); self-host split (v0.12.0); MCP
(v0.13.0); email-verification enforcement; multi-tenant account switcher.
