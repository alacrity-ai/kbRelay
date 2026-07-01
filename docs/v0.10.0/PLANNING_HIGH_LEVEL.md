# kbRelay — v0.10.x Planning: High-Level Orientation (READ ME FIRST)

**Purpose.** This is the **re-entry point** for the v0.10.x initiative. If you're an
agent picking this up cold (e.g. after a context compaction), read this doc first,
then the design docs it points to. It captures the problem, the roadmap, every
decision already made, the hard constraints, and exactly where to resume.

**Date:** 2026-07-01 · **Owner:** Leif (`leif@lalalimited.com`) · **Status:**
Design complete, approved; **implementation not yet started.**

---

## 1. What kbRelay is (today, shipped through v0.9.0)

A multi-tenant, **API-first kanban board where humans and agents relay work** to each
other. Live at `https://kbrelay.lalalimited.com`. See `.claude/CONTEXT.md` (agent
landing page) and `.claude/skills/USING_KBRELAY.md` (how agents use it).

- **Stack:** one Cloudflare **Worker** (`apps/api`, a hand-rolled router — *not*
  Hono), **D1** (SQLite) accessed **directly** in repos
  (`env.DB.prepare(sql).bind(...).first()/all()/run()`, `env.DB.batch([...])`,
  `?`-placeholder SQL), a Vite/React SPA on **Pages** (`apps/web`), shared types/zod in
  `packages/shared`. pnpm workspaces, Node 24.
- **Auth today:** **bearer API tokens only** — `api_tokens` stores a sha256 hash;
  `authenticate.ts` → `AuthContext {tenantId,userId,…}`. No human login, no passwords,
  no sessions. Single `tenant_id` scoping. `tenants → users(human|agent) → api_tokens`.
- **Shipped features (v0.1–v0.9):** UX polish, user colors, the append-only **card
  timeline** (system events + note/handoff comments), native markdown, themed dialogs,
  project-settings modal, mobile drag, board filters, **project codes + ticket keys**
  (OBL-1…), **@-mentions + notifications** (bell + `GET /me/mentions` inbox, live-text
  reconciliation), and **comment redaction** (audit-safe soft-delete tombstones). Each
  version has notes under `docs/vX.Y.Z/`.

## 2. The problem statement (why this initiative exists)

kbRelay works, but it's locked to one operator and one hosting model. Leif wants three
things that together make it a real, shareable product:

1. **Anyone can self-register** — sign up, get their own tenant, invite a team. Today a
   tenant/user/token only exists via a server-side mint script. (Pattern already built
   in **houseops** and **textral**; follow it.)
2. **Self-hostable, not just Cloudflare** — run the whole thing (API + web + DB) locally
   with Docker, no Cloudflare dependency, *and* keep the Cloudflare deployment. Two
   modalities. (Pattern in **textral**; make it simpler.)
3. **MCP server** — publish `@alacrity-ai/kbrelaymcp` to npm so any agent can drive
   kbRelay via `claude mcp add`. (Pattern in **textral** `packages/mcp`.)

A fourth need surfaced during planning: once tenants hold multiple people, you need
**basic RBAC** — an admin controlling **which projects each member can access**. That
became its own item, fused with team management.

## 3. The roadmap (4 items, sequential)

| # | Item | Version | Design doc | Status |
|---|------|---------|-----------|--------|
| 1 | **Self-registration & sessions** (register/login/forgot/reset, JWT cookie, membership+role foundation, self-service API keys) | v0.10.0 | `1-TENANT_SELF_REGISTER_DESIGN.md` | designed |
| 2 | **Team management & project RBAC** (invite/remove/role + per-project **binary** access, in one Tenant Settings modal) | v0.11.0 | `2-TEAM_AND_RBAC_DESIGN.md` | designed |
| 3 | **Self-host / Cloudflare split** (Db port + Node entrypoint + Docker; SQLite via libsql) | v0.12.0 | `3-SELFHOST_OR_HOSTED_SPLIT_DESIGN.md` | designed |
| 4 | **MCP server** `@alacrity-ai/kbrelaymcp` (npm, stdio, RBAC-scoped) | v0.13.0 | `4-MCP_DESIGN.md` | designed |

**Why this order:** 1 introduces human auth + the membership/role/keys foundation on a
single runtime (simplest to get right). 2 builds directly on it (same modal, same
Mailgun/token infra) and must land before the split so the split wraps a *complete*
auth+RBAC surface. 3 wraps the finished behavior behind a `Db` port + Node entrypoint
(runtime-agnostic; RBAC is just SQL+checks). 4 is a thin client over the finished,
RBAC-scoped API; needs item 1's keys; runs against CF *or* self-host via
`KBRELAY_BASE_URL`. Full rationale + blast radius: **`0-ROADMAP_PLAN.md`**.

## 4. Decisions already made (the ledger — don't re-litigate)

- **Two auth modes, forever:** bearer tokens (agents/MCP, unchanged) + JWT-in-HttpOnly-
  cookie (humans). Dispatcher tries token first, then cookie.
- **Membership model (item 1):** adopt houseops's shape — users become email-keyed
  identities (globally unique email), **`memberships(tenant,user,role)`** is the source
  of truth for access+role. `users.tenant_id` retained (nullable/vestigial) to avoid
  breaking existing queries. Register creates tenant+user+owner-membership, auto-login,
  atomic via `batch`.
- **Roles:** enforce **`admin` vs `member`** only (4-rank enum may stay in the column).
  `requireRole('admin')` gates team/RBAC/settings.
- **RBAC is BINARY (item 2):** `project_access(tenant,project,user)` — row = full
  read/write access, no row = none. **No per-project read/write levels** (deliberately
  simplified). Admins bypass (see all). Members default-deny. One helper
  `requireProjectAccess(ctx, projectId)` on every project-scoped route; no-access →
  **404** (avoid existence leaks). A coverage test iterates the router so a new
  unguarded route fails CI.
- **Self-host DB = SQLite via `@libsql/client`, NOT Postgres (item 3):** kbRelay's SQL
  is already plain SQLite, so **one dialect, one migration tree, no `?`→`$N`/type
  shims.** The `Db` port mirrors **D1's own shape** (`prepare/bind/first/all/run` +
  `batch`), so repos change by a rename (`env.DB`→`env.db`), not a rewrite. Two
  entrypoints (Worker unchanged; a Node server via `@whatwg-node/server` that also
  serves the SPA). Compose = one `app` service + a SQLite volume (no DB container).
- **MCP (item 4):** package `@alacrity-ai/kbrelaymcp`, `@modelcontextprotocol/sdk`
  stdio, `defineTool`+zod, **inline standalone fetch client** (no workspace dep so
  `npx -y` works), env `KBRELAY_BASE_URL` + `KBRELAY_API_KEY` (Bearer). **Must set
  `publishConfig.access: "public"`** (scoped pkg). Publish manual (`npm publish
  --access public`) for v1; optional tag-driven GH Action with `NPM_TOKEN`.
- **Email:** Mailgun HTTP API, **graceful no-op when unset** (so local/self-host needs
  no inbox). Domain `mg.kbrelay.lalalimited.com` (key in `DO_NOT_COMMIT.md`).
- **Deferred (non-goals):** per-project read/write levels, per-card ACLs, org/billing,
  real-time push, Postgres self-host, OAuth/SSO, multi-tenant account-switcher UI (one
  active tenant per session to start), email-verification enforcement.

## 5. HARD CONSTRAINT — do not destroy the live tenant

The production tenant **`t_lala`** is in **active daily use** with **6 projects that
must survive intact** (baseline captured 2026-07-01):

`OBC` Orderbase - Customers · `MSP` MemeSigns - Planning · `CR` Chrono Resonance ·
`OBL` Orderbase - Launch · `BMS` buildmylease.com Support · `BML` buildmylease.com
(ids in `0-ROADMAP_PLAN.md §3a`).

Rules enforced on every migration: **additive-only** (only `CREATE TABLE`/`ADD COLUMN`
nullable/`CREATE INDEX` — never `DROP`/`RENAME`/`UPDATE`/`DELETE` on
projects/cards/columns/card_events/card_mentions); idempotent explicit-by-id backfills;
**RBAC backfill grants every existing member access to all 6 projects** so the rollout
is behavior-preserving; **`wrangler d1 export` pre-flight backup**; post-migration
verification against the baseline; deploy order for item 2 is **export → migrate +
backfill → verify grants → then deploy the enforcing Worker** (no lock-out window).
Leif is backfilled **admin** (RBAC-bypass) and his existing **token keeps working**
throughout. Full detail: `0-ROADMAP_PLAN.md §3a` and each doc's migration section.

## 6. Grounded references (read the real code when implementing)

- **houseops** `/home/leif/lets-get-rich/home-app` — self-register/login/forgot/reset,
  invites, roles, `property_access`, Mailgun, PBKDF2, JWT cookie. Key files:
  `apps/api/src/routes/{auth,users}.ts`, `db/repos/auth.ts`,
  `lib/{password,jwt,cookies}.ts`, `services/mailgun.ts`, `email/templates.ts`,
  `middleware/{auth,authz}.ts`, `migrations/0008_multitenant_auth.sql`.
- **textral** `/home/leif/textral/TEXTRAL_REFACTOR_WIP` — the CF/self-host split and
  the MCP package. Key files: `apps/api/src/runtime/shared/interfaces.ts`,
  `runtime/{cf,node}/*`, `src/index.ts`, `src/runtime/node/index.ts`,
  `apps/api/Dockerfile`, `infrastructure/docker/docker-compose.yml`,
  `scripts/migrate-postgres.ts`, `tools/check-no-*.sh`; and `packages/mcp/*`
  (`package.json`, `bin/`, `src/{server,transport-stdio}.ts`, `src/tools/*`).

## 7. Document index (what to read for what)

- `PLANNING_HIGH_LEVEL.md` — **this doc** (orientation / re-entry).
- `0-ROADMAP_PLAN.md` — the full roadmap: all 4 items, sequencing, blast radius,
  **§3a live-tenant preservation**, non-goals.
- `1-TENANT_SELF_REGISTER_DESIGN.md` — item 1 detail (auth, sessions, membership,
  API keys, migration `0010`).
- `2-TEAM_AND_RBAC_DESIGN.md` — item 2 detail (invites, roles, binary project access,
  enforcement layer, migration `0011`).
- `3-SELFHOST_OR_HOSTED_SPLIT_DESIGN.md` — item 3 detail (Db port, Node entrypoint,
  Docker/compose, libsql migration runner).
- `4-MCP_DESIGN.md` — item 4 detail (package, tools, publish).
- Repo orientation: `.claude/CONTEXT.md`, `.claude/skills/USING_KBRELAY.md`.
- Prior art / history: `docs/v0.1.0` … `docs/v0.9.0` (per-version design + release
  notes).

## 8. How to resume (next action)

**Start Item 1** (`1-TENANT_SELF_REGISTER_DESIGN.md`). Working method used throughout
this project (keep it):
1. Implement in this order: `packages/shared` (types/zod) → migration → `apps/api`
   repos/routes → `openapi.ts` (+ parity test) → `apps/web` → docs
   (`USING_KBRELAY.md`, `CONTEXT.md`, a `docs/v0.10.0/RELEASE_NOTES.md`).
2. **Quality gates before deploy:** `pnpm -r typecheck`, `npx eslint .`,
   `pnpm -r test`, `pnpm -r build` — all green.
3. **Local smoke** against a dev Worker (`make db-reset-local`, `make mint-token
   TARGET=local …`, `wrangler dev --env dev`) before touching prod.
4. **Deploy order:** `wrangler d1 export` backup → **migrate prod D1** → deploy Worker
   → deploy Pages. Verify on prod (and, for item 3, in a local self-host stack).
5. Land each item fully (verified in prod) before starting the next.

**Operational facts:** secrets/creds live in `DO_NOT_COMMIT.md` (gitignored): Mailgun
sending key, NPM CI token, Cloudflare creds (`export CLOUDFLARE_API_TOKEN=… ACCOUNT_ID=…`
before any `make deploy-*`), D1 ids, minted tokens. **Never print/commit tokens.**
Deploy targets in the `Makefile` (`db-migrate-prod`, `deploy-api-prod`,
`deploy-web-prod`). Repo is a git repo on branch `develop` with **no commits yet** —
don't commit unless asked.

**Do NOT** begin coding until Leif confirms — he is reviewing the design docs.
