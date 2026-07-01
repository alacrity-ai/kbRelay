# kbRelay — High-Level Design (v0.0.0)

**Kanban Relay** — a lightweight, API-first, multi-tenant kanban board where humans and agents relay work to each other.

**Date:** 2026-06-30
**Status:** design (v0.0.0, pre-MVP)
**Home:** `kbrelay.lalalimited.com` (Cloudflare, same LaLa Solutions account as landlord-contracts)
**Reference architecture:** `landlord-contracts` (stack, Makefile, deploy model) + `home-app` (multi-tenant scoping pattern)

---

## 1. Why this exists

Leif runs a lot of agentic work across repos. He needs one central board where **an agent can file a task for a human, a human can file a task for an agent, and either can move it forward** — with clear provenance (who created it, who's it assigned to, was it a human or Claude). Trello would do this, but Trello's API is now paywalled. kbRelay is the self-hosted, agent-native replacement.

The product is deliberately **two surfaces over one data model**:
- an **API** that agents drive (list projects, read/create/move cards) — this is the primary surface;
- a **web board** that humans drive (drag-and-drop, card editing) — a client of the same API.

Everything the web UI can do, the API can do. That parity is a hard requirement.

---

## 2. What it does (MVP scope)

- **Tenants** — hard data-isolation boundary. One tenant (`lala`) at launch; the model supports many so we can add collaborators (or monetize) later without a migration.
- **Users within a tenant** — named actors with a `kind` of `human` or `agent` (Leif, Joe = human; Claude = agent). Every action is stamped with its actor.
- **API tokens** — hashed bearer credentials; each belongs to a user. A user may hold several. This is how both agents and the web UI authenticate.
- **Projects** — a board. A tenant has many.
- **Columns** — the board's lanes (default: `Todo → In Progress → In Review → Done`), renameable, reorderable, addable, color-codable.
- **Cards** — simple tickets: title, description, acceptance criteria, a color/label, an assignee, and a position within a column. Stamped with `created_by` / `updated_by`.
- **Drag-and-drop** — move a card within/between columns; reorder columns. Persisted through the API.
- **OpenAPI spec** — a first-class, served artifact so agents have a real contract.

## 3. What it does NOT do (explicitly deferred)

Kept out to ship fast — none of these require a data migration to add later (hooks are left in §5):

- ❌ Human login (password / magic-link). MVP humans authenticate by **pasting their token** into the web UI. Proper login is the first post-MVP auth upgrade.
- ❌ RBAC enforcement. A nullable `users.role` column exists (`read | runner | owner | admin`, borrowed from home-app) but nothing enforces it yet.
- ❌ Self-service registration / invites / email.
- ❌ A user belonging to multiple tenants (home-app's "switch account"). `users.tenant_id` is single-valued for now; a membership join table is a later add.
- ❌ Rich Trello features: checklists, attachments, comments threads, due dates, labels-as-taxonomy, activity feed, webhooks, automations. (A card **activity log** is the most likely first extension, but `created_by`/`updated_by` cover MVP provenance.)
- ❌ Real-time sync / websockets. The board refetches; polling is fine at this scale.
- ❌ Billing.

---

## 4. Core primitives (data model)

Single scoping dimension: **`tenant_id`** on every row (home-app uses two — `account_id` + `property_id` — because a home has many properties; kbRelay has only one boundary, so it's strictly simpler). Cards/columns also carry `tenant_id` denormalized so every query can filter on it directly and cheaply.

```
tenants
  id            TEXT PK            -- uuid
  name          TEXT               -- "LaLa Solutions"
  slug          TEXT UNIQUE        -- "lala"
  created_at    INTEGER

users
  id            TEXT PK
  tenant_id     TEXT FK -> tenants(id)
  name          TEXT               -- "Leif", "Joe", "Claude"
  kind          TEXT               -- 'human' | 'agent'      ← "was it Claude?"
  role          TEXT NULL          -- 'read'|'runner'|'owner'|'admin'  (unenforced hook)
  created_at    INTEGER
  UNIQUE(tenant_id, name)

api_tokens
  id            TEXT PK
  tenant_id     TEXT FK -> tenants(id)   -- denormalized for fast auth lookup
  user_id       TEXT FK -> users(id)
  token_hash    TEXT UNIQUE        -- sha256 hex of the plaintext token (never store plaintext)
  label         TEXT               -- "leif-laptop", "claude-session"
  created_at    INTEGER
  last_used_at  INTEGER NULL
  revoked_at    INTEGER NULL

projects
  id            TEXT PK
  tenant_id     TEXT FK -> tenants(id)
  name          TEXT
  description   TEXT NULL
  color         TEXT NULL          -- hex or token name
  status        TEXT               -- 'active' | 'archived'
  created_by    TEXT FK -> users(id)
  created_at    INTEGER
  updated_at    INTEGER

columns                             -- board lanes (a.k.a. lists/statuses)
  id            TEXT PK
  tenant_id     TEXT FK -> tenants(id)
  project_id    TEXT FK -> projects(id)
  name          TEXT               -- "Todo", "In Progress", ...
  color         TEXT NULL
  position      REAL               -- fractional rank for ordering
  created_at    INTEGER

cards
  id                   TEXT PK
  tenant_id            TEXT FK -> tenants(id)
  project_id           TEXT FK -> projects(id)
  column_id            TEXT FK -> columns(id)
  title                TEXT
  description          TEXT NULL
  acceptance_criteria  TEXT NULL
  color                TEXT NULL
  position             REAL         -- fractional rank within the column
  assignee_user_id     TEXT NULL FK -> users(id)
  created_by           TEXT FK -> users(id)
  updated_by           TEXT FK -> users(id)
  created_at           INTEGER
  updated_at           INTEGER
```

**Provenance falls out of auth:** a request's token → `user_id` → the actor. Every create stamps `created_by`; every mutation stamps `updated_by`; assignment references a user. The board can always show "Claude created this, assigned to Leif; Joe moved it to In Review."

**Ordering (drag-and-drop):** `position` is a `REAL` fractional rank. Inserting between two cards = midpoint of their positions; a rare precision squeeze triggers a cheap per-column reindex. Simpler than integer shuffles, good enough at our scale.

**Cascade:** deleting a project deletes its columns and cards; deleting a column requires it be empty (or moves cards to a sibling) — decided in the impl plan. Tenancy FKs are `ON DELETE CASCADE`.

---

## 5. Auth & tenancy model

**One auth path for humans and agents:** `Authorization: Bearer <token>` → look up `sha256(token)` in `api_tokens` → resolve `user_id` + `tenant_id` → attach an `AuthContext { tenantId, userId, userKind, role }` to the request. The web UI is just a client holding a human's token in `localStorage`.

- **Token minting (MVP):** by hand via a Makefile target / seed migration (not self-service). `make mint-token TENANT=lala USER=claude LABEL=claude-main` prints a plaintext token once and stores only its hash.
- **Every route handler** starts by reading the `AuthContext` and **filters every query by `tenant_id`** — enforced through a `tenantScope(c)` helper mirroring home-app's, so it's structurally hard to forget.
- **Cross-tenant isolation is a tested invariant** (home-app has `cross_tenant_isolation.spec.ts`; we copy the idea): a token for tenant A must never read or mutate tenant B's rows. This test is a Phase-2 acceptance gate.

**Forward-compat hooks (cost nothing now):** `users.role` (unenforced), token table (not env secret) so new users/tenants are inserts not rewrites, and `users.tenant_id` isolated enough that a future `memberships` join table is additive.

---

## 6. API surface (v1, agent-facing)

Versioned under `/api/v1`. All tenant-scoped; all require a bearer token. Full parity with the UI.

| Method & path | Purpose |
|---|---|
| `GET /api/v1/me` | Whoami: the token's user, kind, tenant, role. |
| `GET /api/v1/projects` | List projects in the tenant (`?status=active`). |
| `POST /api/v1/projects` | Create a project (auto-seeds the 4 default columns). |
| `GET /api/v1/projects/:id` | Project + its columns. |
| `PATCH /api/v1/projects/:id` | Rename / recolor / archive. |
| `DELETE /api/v1/projects/:id` | Delete (cascade). |
| `GET /api/v1/projects/:id/columns` | List columns (ordered). |
| `POST /api/v1/projects/:id/columns` | Add a column. |
| `PATCH /api/v1/columns/:id` | Rename / recolor / **reorder** (`position`). |
| `DELETE /api/v1/columns/:id` | Remove a column. |
| `GET /api/v1/projects/:id/cards` | List cards (`?column=&assignee=&q=`). |
| `POST /api/v1/projects/:id/cards` | Create a card. |
| `GET /api/v1/cards/:id` | Read a card. |
| `PATCH /api/v1/cards/:id` | Edit fields **and/or move** (`column_id` + `position`). |
| `DELETE /api/v1/cards/:id` | Delete a card. |
| `GET /api/v1/users` | List tenant users (for assignee pickers). |
| `GET /api/openapi.yaml` | The served OpenAPI 3.1 spec. |
| `GET /api/health` | Liveness. |

**Admin (owner-only, minimal for MVP):** `POST /api/v1/users`, `POST /api/v1/tokens` may exist but token *plaintext* is returned once and never stored — for MVP these can be Makefile-only if we prefer. Decided in the impl plan.

**OpenAPI is the contract of record.** Request/response shapes come from shared Zod schemas (`packages/shared`); the spec is kept in lockstep and served at `/api/openapi.yaml` so an agent can introspect the API at runtime.

---

## 7. Stack

**Monorepo, npm workspaces** (`apps/*`, `packages/*`), Node 24 (`nvm use 24`) — identical to landlord-contracts.

- **Frontend** (`apps/web`): Vite + React 19 + TypeScript, deployed to **Cloudflare Pages**. Drag-and-drop via **`@dnd-kit/core`** (React-19-compatible; `react-beautiful-dnd` is dead — do not use). Auth = bearer token in `localStorage`.
- **Backend** (`apps/api`): **Cloudflare Worker**, stateless, TypeScript. Routing kept light (a small switch/router like landlord-contracts, or Hono like home-app — decided in impl plan; default: match landlord-contracts' minimal router to reduce deps). Zod validation at the boundary.
- **Data** (`packages/shared`): shared TS types + Zod schemas consumed by both api and web (and used to generate/verify the OpenAPI spec).
- **Persistence**: **Cloudflare D1** (SQLite). DB names `kbrelay` (prod) / `kbrelay-dev`. No KV/R2/Browser needed at MVP.
- **Tooling**: Makefile-driven (mirror landlord-contracts targets), Vitest unit tests, Playwright e2e (`test/e2e`) for API + board smoke + the cross-tenant isolation test. ESLint, husky gate.

---

## 8. Deployment

Mirror landlord-contracts' same-origin model:

- **Pages** project `kbrelay` serves the SPA at `https://kbrelay.lalalimited.com`.
- **Worker** `kbrelay-api` bound to the route `kbrelay.lalalimited.com/api/*` (same origin → no CORS in prod; CORS allowed for local dev).
- **Two environments** in `wrangler.toml`: `[env.dev]` (`kbrelay-dev` D1, dev route) and `[env.prod]` (`kbrelay` D1, prod route). Bare `wrangler deploy` is not viable — always `--env`.
- **Secrets** live in a gitignored `DO_NOT_COMMIT.md` + set via `wrangler secret put`. Reuse the LaLa Cloudflare account/token from landlord-contracts' `DO_NOT_COMMIT.md`.
- **Deploy** via Makefile: `make deploy-dev` / `make deploy-prod` (each = migrate + deploy worker + deploy pages), exactly like the reference repo.

---

## 9. Proposed file/folder structure

```
kbrelay/
├── .claude/
│   ├── CONTEXT.md                     # seed (redrafted post-MVP into the real agent landing page)
│   └── skills/                        # future: skills/<name>/SKILL.md
├── docs/
│   └── v0.0.0/
│       ├── 0-HIGH_LEVEL_DESIGN.md     # this doc
│       ├── 1-MVP_IMPLEMENTATION_PLAN.md
│       └── RELEASE_NOTES.md
├── openapi/
│   └── kbrelay.v1.yaml                # served at /api/openapi.yaml
├── apps/
│   ├── api/
│   │   ├── wrangler.toml              # [env.dev] + [env.prod], D1 bindings, route
│   │   ├── package.json              # @kbrelay/api
│   │   ├── migrations/
│   │   │   ├── 0001_init.sql          # tenants, users, api_tokens, projects, columns, cards
│   │   │   └── 0002_seed_lala.sql     # tenant lala + users leif/joe/claude (tokens minted via Make)
│   │   └── src/
│   │       ├── index.ts               # router + CORS + health
│   │       ├── env.ts                 # Env bindings type
│   │       ├── http.ts                # json/error helpers
│   │       ├── auth/
│   │       │   ├── authenticate.ts     # bearer -> token_hash -> user/tenant
│   │       │   └── tenant-scope.ts     # tenantScope(c) helper
│   │       ├── db/
│   │       │   └── repos/              # projects, columns, cards, users, tokens
│   │       └── routes/
│   │           ├── me.ts  projects.ts  columns.ts  cards.ts  users.ts  openapi.ts
│   └── web/
│       ├── index.html
│       ├── package.json              # @kbrelay/web
│       └── src/
│           ├── main.tsx
│           ├── app/App.tsx
│           ├── pages/                 # TokenGate, Projects, Board
│           ├── components/            # Board, Column, Card, CardModal, ProjectSwitcher
│           └── lib/                   # api.ts (typed client), auth.ts (token store)
├── packages/
│   └── shared/
│       ├── package.json              # @kbrelay/shared
│       └── src/                       # types + zod schemas (cards, columns, projects, auth)
├── test/
│   └── e2e/                           # playwright: api parity, board smoke, cross-tenant isolation
├── Makefile                           # dev / build / migrate / deploy / mint-token / test
├── package.json                       # workspaces: apps/*, packages/*; engines node>=24
├── tsconfig.base.json
├── eslint.config.js
├── .gitignore                         # ignores DO_NOT_COMMIT.md, dist, node_modules, .dev.vars
└── DO_NOT_COMMIT.md                   # secrets (gitignored) — reuse LaLa CF creds
```

---

## 10. Key design decisions (locked)

1. **Multi-tenant from row zero** — retrofitting is the expensive path (home-app's `0009`/`0010` migrations are the cautionary tale). One `tenant_id` dimension only.
2. **Users are first-class actors** with `human`/`agent` kind — provenance is the product's reason to exist, not a feature.
3. **Unified bearer-token auth** for humans and agents; the web UI is just a token-holding API client. No password system at MVP.
4. **Tokens live in a hashed table, not an env secret** — so "mint a token for Joe / a friend / a new tenant" is an insert, never a rewrite.
5. **API/UI parity + served OpenAPI** — agents are a first-class consumer, not an afterthought.
6. **Ship-fast discipline** — defer login, RBAC, registration, activity feed, real-time; leave only zero-cost hooks.

Proceed to `1-MVP_IMPLEMENTATION_PLAN.md`.
