# kbRelay — v0.10.0 Design: Tenant Self-Registration & Sessions

**Date:** 2026-07-01
**Status:** Design (pre-implementation). Item 1 of `0-ROADMAP_PLAN.md`.
**Grounded in:** houseops (`/home/leif/lets-get-rich/home-app`): `apps/api/src/
routes/auth.ts`, `db/repos/auth.ts`, `lib/{password,jwt,cookies}.ts`,
`services/mailgun.ts`, `email/templates.ts`, `migrations/0008_multitenant_auth.sql`.

---

## 1. Goal & scope

A stranger signs up → gets their own tenant + owner user → is logged in. Plus
login/logout, forgot/reset password, and self-service API-key management. Result: a
working **solo** tenant. Invites, roles-UI, and per-project access are **Item 2** —
this item only lays the membership/role *foundation* and stamps the owner as admin.

**Non-negotiable:** the existing **bearer-token auth for agents is untouched**. This
item *adds* a second, parallel human auth path (cookie/JWT). Both resolve to the same
`AuthContext`.

## 2. The tenancy model (the foundational decision — resolved)

kbRelay today: `users.tenant_id` (one user ⇒ one tenant). Item 2's **invites** require
that one email can belong to more than one tenant, which the current model can't
express. So we adopt houseops's **membership model now**:

- **`users` become tenant-independent identities.** Login is by **globally unique
  email**. A user row: identity + credentials (`email`, `password_hash`,
  `password_algo`, `email_verified_at`), plus existing `name/kind/color/handle`.
- **`memberships(tenant_id, user_id, role)`** is the authoritative record of *which
  tenants a user can access and their role there*. Register creates a membership with
  role **`admin`** (the owner).
- **`users.tenant_id` is retained but demoted to a nullable "origin tenant"** (set to
  the tenant a user was created in) purely to avoid rewriting unrelated code in this
  item; **`memberships` is the source of truth** for access/role. (It can be dropped
  in a later cleanup once all reads go through memberships.)
- **Token auth is unaffected:** `authenticate.ts` already derives `tenantId` from
  `api_tokens.tenant_id` (not `users.tenant_id`), so agents keep working as-is.

Repo reads that currently filter `users WHERE tenant_id = ?` (`listUsers`,
`mentionableUsers`, `userExistsInTenant`) switch to **`users JOIN memberships m ON
m.user_id = users.id WHERE m.tenant_id = ?`** — the set of a tenant's users becomes
its membership set.

## 3. Auth mechanics (copy houseops)

- **Passwords** — `lib/password.ts`: PBKDF2-HMAC-SHA-256 via Web Crypto, 100k
  iterations, 32-byte salt/key, stored as `pbkdf2-sha256$<iters>$<b64salt>$<b64hash>`
  in `users.password_hash` (algo in `password_algo`). Constant-time verify. Copy
  near-verbatim.
- **Sessions** — stateless **HS256 JWT** (`lib/jwt.ts`, Web Crypto) in an **HttpOnly
  cookie `kbrelay_session`** (`lib/cookies.ts`: `HttpOnly; SameSite=Lax; Path=/`,
  `Secure` off `http://`). Claims **`{ uid, tid, iat, exp }`** — `tid` = active tenant
  (the membership in play). TTL 30 days. Signed with **`JWT_SECRET`** (new Worker
  secret). No session table.
- **Dispatcher auth (two modes).** `index.ts` first tries the bearer token
  (`authenticate.ts`, unchanged). If absent, it tries the session cookie: verify JWT →
  confirm a `memberships(tid, uid)` row exists → build `AuthContext` (role from that
  membership). Missing/invalid → 401; missing `JWT_SECRET` → 503. `AuthContext` gains
  nothing structurally (still `{tenantId, userId, userName, userKind, role, …}`);
  `role` now comes from the membership.
- **Reset tokens** — `password_reset_tokens(id, user_id, token_hash, expires_at,
  used_at, created_at)`: store only the **sha256 of a random token**, 1h TTL,
  single-use. Link `${PUBLIC_BASE_URL}/auth/reset/<cleartext>`.
- **Email** — `services/mailgun.ts`: one `sendMailgun(env,msg)` POST to
  `${MAILGUN_BASE_URL}/v3/${MAILGUN_DOMAIN}/messages`, Basic `api:${MAILGUN_API_KEY}`.
  **Graceful no-op when `MAILGUN_API_KEY` unset** → local/self-host needs no inbox.
  Templates (`email/templates.ts`): `welcomeEmail`, `passwordResetEmail` (plain
  template literals + `escapeHtml`, shared shell). Domain: `mg.kbrelay.lalalimited.com`
  (key in `DO_NOT_COMMIT.md`).

## 4. Endpoints (new)

Public (no auth), mounted before the auth check:
- `POST /api/v1/auth/register` — `{email, password(≥8), name, tenantName}` → create
  tenant + user + owner-membership + first agent user (see §6), auto-login (sets
  cookie), `201 { user, tenant }`. **Atomic** via `env.DB.batch([...])` (houseops does
  sequential inserts and risks partial tenants — we won't).
- `POST /api/v1/auth/login` — `{email, password}` → verify, set cookie, `200 {user,
  tenant}`.
- `POST /api/v1/auth/logout` — clear cookie.
- `POST /api/v1/auth/forgot-password` — `{email}` → always `200 {ok:true}` (no account
  enumeration); if the user exists, issue + email a reset token.
- `POST /api/v1/auth/reset-password` — `{token, password}` → consume token, rehash,
  `200 {ok:true}` or `400`.

Session-required:
- `GET /api/v1/auth/me` — user + active tenant + role. (Distinct from the existing
  token-oriented `GET /v1/me`; may converge later.)

Self-service API keys (session **or** token; a human manages their own keys):
- `GET /api/v1/me/tokens` — list my tokens (id, label, created_at, last_used_at;
  never the secret).
- `POST /api/v1/me/tokens` — `{label}` → mint, return **plaintext once**, store hash
  (reuses the existing `api_tokens` + mint logic from `tools/mint-token.mjs`, moved
  server-side).
- `DELETE /api/v1/me/tokens/:id` — revoke (`revoked_at`).

`openapi.json` + the router↔spec parity test updated for all of the above.

## 5. Web

- New unauthenticated routes/pages: **Register**, **Sign in**, **Forgot**, **Reset**
  (`/auth/*`), replacing "paste a token" as the default entry (token paste stays as an
  advanced/agent option). A minimal auth shell + the existing themed styles.
- **API-keys panel** in the user menu / settings: list, create (shown-once modal),
  revoke — the thing a human uses to configure the MCP (Item 4).
- Auth state via `GET /auth/me`; a route guard redirects unauthenticated users to
  `/auth/sign-in`. The board itself is unchanged.

## 6. Resolved decisions

- **Email verification:** **active-immediately** (KISS). Keep `email_verified_at`
  (set at register for now), no enforcement in v1 — a later item can gate on it.
- **Agent user in a new tenant:** register auto-creates one **agent user** (name
  "Assistant"/"Claude", `kind:'agent'`, member role) so the tenant is agent-ready; its
  first token is mintable from the API-keys panel. (Keeps the human↔agent premise
  intact from minute one.)
- **Existing seeded tenant (`t_lala`) migration:** backfill a **membership** for each
  seeded user (`u_leif`, `u_joe` → `admin`; `u_claude` → `member`); backfill **emails**
  for the humans (`leif@lalalimited.com`, `joe@…`) with **null passwords** (they set
  one via forgot-password, or keep using their token). Claude stays token-only. Every
  existing member is granted access to every existing project by the Item 2 backfill
  (so nothing breaks when RBAC lands).
- **Register atomicity:** single `env.DB.batch`.
- **Email uniqueness:** global. **Handle uniqueness:** stays per-tenant (enforced when
  a membership is created); a global user keeps one handle.
- **One active tenant per session** (JWT `tid`); the multi-tenant account switcher is
  deferred (Item 2 non-goal).

## 7. Migration

`0010_human_auth.sql` — **additive-only** (see `0-ROADMAP_PLAN.md §3a` — the live
`t_lala` tenant and its 6 projects must survive; this migration touches **no**
project/card/column data):
- `users` + `email TEXT`, `password_hash TEXT`, `password_algo TEXT`,
  `email_verified_at INTEGER`; `CREATE UNIQUE INDEX idx_users_email ON users(email)`
  (SQLite treats NULLs as distinct, so the existing null-email agent rows don't
  collide).
- `CREATE TABLE memberships(id, tenant_id, user_id, role, created_at)` +
  `UNIQUE(tenant_id, user_id)` + index on `user_id`.
- `CREATE TABLE password_reset_tokens(...)` (+ unique `token_hash`).
- **`users.tenant_id` is retained** (not dropped) so no existing query breaks.
- Backfill memberships + human emails for `t_lala` (explicit-by-id, idempotent):
  a membership for **every** current `t_lala` user (`u_leif`,`u_joe`→`admin`;
  `u_claude`→`member`) so no user vanishes when reads move to `JOIN memberships`.

**Pre-flight (prod):** `wrangler d1 export kbrelay --remote --output
kbrelay-pre0010.sql`. **Post-migration verify:** membership count == current
`t_lala` user count; the 6 baseline projects untouched (`§3a`); `u_leif`'s token
still authenticates.

## 8. Testing

- **Unit (pure/shared):** password hash+verify round-trip, wrong password fails,
  hash format; JWT sign/verify, expiry, tamper rejection; register/login/reset zod
  inputs; reset-token single-use + expiry (pure token logic).
- **Contract:** router↔openapi parity for the new routes.
- **Local + prod smoke:** register a fresh tenant → cookie set → `/auth/me` → logout →
  login → forgot (Mailgun no-op locally; real email in prod) → reset → login with new
  password; mint an API key → use it as a bearer token; confirm **agents' existing
  tokens still authenticate** unchanged.

## 9. Deploy

Add secrets `JWT_SECRET`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`
(`mg.kbrelay.lalalimited.com`), `PUBLIC_BASE_URL` via `wrangler secret put --env
prod`. Order: **migrate prod (0010) → Worker → Pages.** Verify the two-auth-mode
coexistence in prod before moving to Item 2.

## 10. Out of scope (→ later items)

Invites, roles-management UI, per-project access (Item 2); OAuth/SSO; email
verification enforcement; multi-tenant account switcher; password strength meter /
rate-limiting hardening (note as a follow-up).
