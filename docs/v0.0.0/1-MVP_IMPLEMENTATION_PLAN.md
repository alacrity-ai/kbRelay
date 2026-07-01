# kbRelay — MVP Implementation Plan (v0.0.0)

**Date:** 2026-06-30
**Companion to:** `0-HIGH_LEVEL_DESIGN.md`
**Goal:** stand up a working, deployed, multi-tenant kanban board — API-first, human-usable — **fast**. No feature bloat. Each phase is independently shippable and has explicit acceptance criteria.

**Global rules**
- Node 24 for everything (`. ~/.nvm/nvm.sh && nvm use 24`).
- Reference repo for every "how do I structure this?" question: `landlord-contracts`. Multi-tenant pattern: `home-app`.
- Nothing tenant-scoped is queried without a `tenant_id` filter. The cross-tenant isolation test (Phase 2) guards this forever.
- Secrets only in the gitignored `DO_NOT_COMMIT.md`; reuse the LaLa Cloudflare account/API token from `landlord-contracts/DO_NOT_COMMIT.md`.

---

## Phase 1 — Scaffold & deploy a heartbeat

**Objective:** an empty-but-real monorepo that runs locally with one command and deploys to Cloudflare, before any business logic exists. De-risks the whole toolchain first.

**Files/folders created**
- Root: `package.json` (workspaces `apps/*`, `packages/*`; `engines.node >=24`), `tsconfig.base.json`, `eslint.config.js`, `.gitignore` (ignore `DO_NOT_COMMIT.md`, `dist`, `node_modules`, `.dev.vars`, `.wrangler`), `Makefile`, `DO_NOT_COMMIT.md` (seed from landlord-contracts creds: CF account id, CF API token; add a `KBRELAY_*` section).
- `apps/api/`: `package.json` (`@kbrelay/api`), `wrangler.toml` (`[env.dev]`+`[env.prod]`, D1 bindings, route `kbrelay.lalalimited.com/api/*`), `src/index.ts` (router with `GET /api/health` → `{ok:true}`), `src/env.ts`, `src/http.ts`.
- `apps/web/`: `package.json` (`@kbrelay/web`), `index.html`, `vite.config.ts`, `src/main.tsx`, `src/app/App.tsx` (renders "kbRelay" + a health ping to `/api/health`).
- `packages/shared/`: `package.json` (`@kbrelay/shared`), `src/index.ts` (empty barrel).
- `Makefile` targets (mirror landlord-contracts): `help, install, dev, dev-web, dev-api, build, typecheck, lint, db-migrate-local/dev/prod, deploy-api-dev/prod, deploy-web-dev/prod, deploy-dev, deploy-prod, clean`.
- **Concierge (Leif):** create the two D1 databases (`wrangler d1 create kbrelay` / `kbrelay-dev`), paste their IDs into `wrangler.toml`; create the `kbrelay` Pages project; confirm the DNS/route for `kbrelay.lalalimited.com` (can be done now or at Phase 5).

**Acceptance criteria**
- `make install && make dev` starts Vite (`:5173`) + `wrangler dev` (`:8787`) together; the web page shows a green health status from the Worker.
- `curl localhost:8787/api/health` → `{"ok":true}`.
- `make deploy-dev` deploys the Worker + Pages to the dev environment with zero app logic (heartbeat only). `make typecheck && make lint` pass clean.

---

## Phase 2 — Data model, auth spine, tenancy isolation

**Objective:** the identity/tenancy foundation, tested. After this, a token authenticates to exactly one tenant/user and can see nothing else.

**Files/folders created**
- `apps/api/migrations/0001_init.sql` — `tenants`, `users`, `api_tokens`, `projects`, `columns`, `cards` (schema per design §4), with indexes on every `tenant_id`, `project_id`, `column_id`, and `api_tokens.token_hash`.
- `apps/api/migrations/0002_seed_lala.sql` — insert tenant `lala`, users `leif`/`joe` (`human`) and `claude` (`agent`). **No token hashes in the migration** — tokens are minted out-of-band so plaintext never lands in git.
- `apps/api/src/auth/authenticate.ts` — parse `Authorization: Bearer`, `sha256` the token, look up `api_tokens` (not revoked), join `users`, return `AuthContext {tenantId, userId, userKind, role}` or a 401. Timing-safe, updates `last_used_at`.
- `apps/api/src/auth/tenant-scope.ts` — `tenantScope(ctx)` returning `{tenantId, userId}`; throws if called without auth (mirrors home-app).
- `apps/api/src/db/repos/tokens.ts`, `users.ts` — hashed-token creation + user lookups.
- `apps/api/src/routes/me.ts` — `GET /api/v1/me`.
- `packages/shared/src/auth.ts` — `AuthContext`, `UserKind`, `Role` types + zod.
- `Makefile`: `mint-token` target — `make mint-token ENV=dev TENANT=lala USER=claude LABEL=claude-main` generates a 32-byte token, stores its hash via a one-shot `wrangler d1 execute`, prints the **plaintext once**.
- `test/e2e/` bootstrap + `suites/smoke/cross_tenant_isolation.spec.ts` (seed a second tenant `acme`; assert `lala` token can't read/mutate `acme` rows and vice-versa) + an auth smoke (no token → 401, valid token → correct `/me`).

**Acceptance criteria**
- Migrations apply cleanly to local + dev D1.
- `make mint-token …` yields a working token; `GET /api/v1/me` with it returns the right user (`kind`, `role`, `tenant`).
- No/invalid/revoked token → 401.
- **Cross-tenant isolation test passes** — this is the gate; do not proceed to Phase 3 until green.

---

## Phase 3 — Core API + OpenAPI (the agent surface)

**Objective:** full CRUD for projects/columns/cards with provenance stamps and fractional-rank ordering, plus the served OpenAPI spec. This is the surface agents use; it must be complete before the UI (the UI is just a client of it).

**Files/folders created**
- `packages/shared/src/` — zod schemas + types for `Project`, `Column`, `Card` (create/patch/move shapes).
- `apps/api/src/db/repos/` — `projects.ts`, `columns.ts`, `cards.ts` (all queries `tenant_id`-scoped; mutations stamp `created_by`/`updated_by` from `AuthContext`).
- `apps/api/src/routes/` — `projects.ts`, `columns.ts`, `cards.ts`, `users.ts` implementing the design §6 table. Project-create seeds the 4 default columns (`Todo`, `In Progress`, `In Review`, `Done`). Card/column move = `PATCH` with `position` (midpoint insert; per-column reindex helper when precision squeezes).
- `apps/api/src/index.ts` — wire the routes; enforce auth on all `/api/v1/*`.
- `openapi/kbrelay.v1.yaml` + `apps/api/src/routes/openapi.ts` — serve it at `GET /api/openapi.yaml`. A shared test asserts the spec's paths match the implemented routes (parity guard).
- Unit tests (Vitest) per repo + route; e2e `suites/smoke/api_board.spec.ts` walking create-project → add-card → move-card → list.

**Acceptance criteria**
- Every design-§6 endpoint works via `curl` with a minted token; responses match the shared schemas.
- Creating a project auto-creates the 4 default columns in order.
- Moving a card between columns and reordering persists and reads back correctly; two cards never collide on `position`.
- Provenance: a card created with Claude's token shows `created_by = claude`; editing with Leif's token sets `updated_by = leif`.
- `GET /api/openapi.yaml` serves a valid OpenAPI 3.1 doc; the parity test passes.
- List filters work: `?status=`, `?column=`, `?assignee=`, `?q=`.

---

## Phase 4 — Web board (the human surface)

**Objective:** a human can do everything the API can, with drag-and-drop.

**Files/folders created**
- `apps/web/src/lib/auth.ts` — token store (localStorage), `TokenGate` that prompts for a token and calls `/api/v1/me` to validate.
- `apps/web/src/lib/api.ts` — typed client (bearer from the store) over every `/api/v1` endpoint, importing `@kbrelay/shared` types.
- `apps/web/src/pages/` — `TokenGate`, `Projects` (list/create/switch), `Board`.
- `apps/web/src/components/` — `Board`, `Column`, `Card`, `CardModal` (title, description, acceptance criteria, assignee picker from `/users`, color), `ProjectSwitcher`. Drag-and-drop via **`@dnd-kit/core`**; on drop, `PATCH` the card's `column_id`+`position` (optimistic update, reconcile on response).
- Minimal styling; color-coding for cards/columns.

**Acceptance criteria**
- Paste a token → board loads for that tenant; wrong token → gated out.
- Create/rename/recolor/archive projects; add/rename/reorder/recolor columns.
- Create/edit/delete cards; set assignee + acceptance criteria + color.
- **Drag-and-drop** a card within and across columns, and reorder columns, persists via the API and survives refresh.
- A card an **agent** created via the API appears on the board on refresh (and vice-versa) — the relay works end to end.

---

## Phase 5 — Ship to production + close out v0.0.0

**Objective:** live at the real domain, documented, ready for the agent to start using it.

**Tasks**
- **Concierge:** point `kbrelay.lalalimited.com` at the Pages project; confirm the Worker route `kbrelay.lalalimited.com/api/*`; set prod secrets via `wrangler secret put`.
- Apply `0001`/`0002` migrations to **prod** D1; `make deploy-prod`.
- Mint prod tokens for `leif`, `joe`, `claude` under tenant `lala`; deliver Leif + Joe their tokens; store Claude's where the agent runtime reads it.
- Prod smoke: `/api/health`, `/api/v1/me`, create a real project + a couple of cards; load the board at the domain.
- `docs/v0.0.0/RELEASE_NOTES.md` — what shipped, the token-minting runbook, known deferrals.
- **Redraft `.claude/CONTEXT.md`** into the real agent landing page (per the seed doc's instruction): how to authenticate, the API base URL, the OpenAPI location, the primitives, and the "how an agent files/updates a card" quickstart.

**Acceptance criteria**
- `https://kbrelay.lalalimited.com` serves the board; `…/api/v1/me` works with a prod token.
- The agent can, from a token alone, list projects and create/move a card via the API (dogfood: file the first real kbRelay task *in kbRelay*).
- RELEASE_NOTES + the redrafted CONTEXT.md are committed.

---

## Sequencing & estimates

Phases are strictly ordered (each depends on the prior). Realistic agent-driven turnaround:

| Phase | Depends on | Concierge needs |
|---|---|---|
| 1 Scaffold | — | D1 create, Pages project, CF creds |
| 2 Auth/tenancy | 1 | — |
| 3 API + OpenAPI | 2 | — |
| 4 Web board | 3 | — |
| 5 Prod | 4 | DNS/route, prod secrets, token delivery |

Phases 1–3 are the critical path to "agents can use it"; 4 makes it human-usable; 5 makes it real. If we want the agent using kbRelay ASAP, we could ship **1→2→3** and let the agent drive via API while 4 is still in progress.

## Explicitly out of scope for v0.0.0
Login, RBAC enforcement, registration/invites, multi-tenant membership, activity feed, real-time, attachments/checklists/comments, billing. Hooks left in (nullable `role`, hashed token table, single-dimension tenancy) so each is additive later.
