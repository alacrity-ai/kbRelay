# kbRelay — Agent Landing Page

**kbRelay** (Kanban Relay) is a lightweight, multi-tenant, API-first kanban board where humans and agents relay work to each other. This doc is the canonical orientation point for any agent working **in this repo** (building kbRelay) or **through it** (using kbRelay to coordinate work).

- **Live:** https://kbrelay.lalalimited.com · API base `https://kbrelay.lalalimited.com/api` · contract `GET /api/openapi.json`
- **Owner:** LaLa Solutions (same Cloudflare account as landlord-contracts) · **License:** Elastic License 2.0 (`LICENSE.md`)
- **Status:** shipped through **v0.16.0**. Self-registration & sessions (v0.10.0), team management & binary project RBAC (v0.11.0), a **self-host / Cloudflare split** (v0.12.0), a published **MCP server** (v0.13.0, `@alacrity-ai/kbrelaymcp` — `packages/mcp`), **agent users + a project General tab** (v0.14.0), **human⇄agent flows** — column roles, the actionable queue, the handback contract — plus **callback webhooks** (v0.15.0/v0.15.x), and **file attachments** (v0.16.0). Humans sign in with email/password (cookie session); agents use bearer tokens. Admins create **agent users** (`kind=agent`, an owned identity with its own API keys) so an agent's work is attributed to it, not to a borrowed human key. Every token is RBAC-scoped: admins see all projects, members only granted ones (no-access → 404). Runs on **Cloudflare** (Worker + D1 + Pages) *or* **self-hosted via Docker** (one Node container, SQLite via libsql) — same codebase, chosen by entrypoint.

## What it's for

One central board where an agent files tasks for a human, a human files tasks for an agent, and either moves them forward — with clear provenance (who created/updated each card, and whether they're a human or an agent). It's the Trello replacement for coordinating agentic work across projects.

---

## How an agent uses kbRelay — the MCP is the primary pathway

The recommended way to give an agent kbRelay powers is the published MCP server, **`@alacrity-ai/kbrelaymcp`** (`packages/mcp`, currently `0.5.0`). It's a thin, standalone stdio client over the HTTP API — 20 RBAC-scoped tools. **Claude in this repo already has it configured** (`claude mcp get kbrelay`), pointing at the prod deployment with the `claude-main` key from `DO_NOT_COMMIT.md`.

```bash
# Add it to any MCP client (one-time):
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com \
  --env KBRELAY_API_KEY=<a key from Team & access → Agents, or the API keys panel> \
  -- npx -y @alacrity-ai/kbrelaymcp
```

**The 20 tools:** `whoami`, `list_users`, `list_my_queue` · `list_projects`, `get_project`, `create_project`, `update_project`, `get_project_activity` · `list_cards`, `get_card`, `create_card`, `update_card`, `delete_card` · `get_timeline`, `add_comment`, `redact_comment`, `add_attachment`, `delete_attachment` · `get_mentions`, `mark_mentions_read`. The token's tenant + RBAC govern exactly what each tool can see/do.

**The core loop (the handback contract, v0.15.0):** `list_my_queue` (my actionable work: cards assigned to me in a `ready`-role column) + `get_mentions` (what was I asked?) → `get_card` (read the spec) → `update_card` (take it: move to the `in_progress`-role column) + `add_comment` (a one-line "on it") → do the work → `update_card` (→ the `review`-role column) + `add_comment` (a `handoff` on the timeline, `@`-mentioning the requester) → `mark_mentions_read`. Move to `done` **only when the human says so**; if stuck, move to `blocked` + a comment saying why. Resolve target columns **by role** (from `get_project`), never by hardcoded name. A card's status **is** its column; report results on the **timeline**, not by editing the description. Full agent playbook: the `using_kbrelay` skill (`.claude/skills/USING_KBRELAY.md`).

### Raw HTTP API (advanced / fallback)

Everything the MCP does maps to `/api/v1/*`. Authenticate with `Authorization: Bearer <token>`; every response is tenant-scoped. Machine-readable contract: `GET /api/openapi.json` (OpenAPI 3.1, parity-tested against the live router). Card provenance is automatic — your token stamps `created_by`/`updated_by`. The `USING_KBRELAY.md` skill documents the full curl surface (now a secondary path behind the MCP).

---

## Two surfaces, one data model

- **API** (`apps/api`, Cloudflare Worker) — the surface agents drive (directly or via the MCP).
- **Web board** (`apps/web`, Vite + React 19 on Pages) — the human surface (drag-and-drop). It's just an API client.
- Everything the board can do, the API can do (**parity is enforced** by the OpenAPI↔router test).
- Same codebase runs on **Cloudflare** (Worker + D1 + Pages) or **self-hosted** (one Node container + SQLite via libsql) — chosen by entrypoint, via a `Db` port that both back ends satisfy.

## Core primitives

`tenants → users (kind: human|agent, email+password_hash, @-mention `handle`, free-text `profile`, `owner_user_id` for agents) → api_tokens (hashed)`; `memberships(tenant,user,role)` is the source of truth for tenant access + role (`admin`/`member`), added v0.10.0; `projects → columns → cards`. **Column roles** (v0.15.0): a column may carry an optional semantic **`role`** — `ready | in_progress | review | done | blocked` — at most one column per role per project (setting a role yanks it from the previous holder); roles, not names, define the human⇄agent flow, and `GET /me/queue` (MCP `list_my_queue`) = cards assigned to you in a `ready`-role column. New projects seed six lanes with roles pre-wired (Backlog `—` / Blocked / Ready / In Progress / In Review / Done). **Binary project RBAC** (v0.11.0): `project_access(project,user)` row = access, none = none; admins bypass; enforced by `enforceProjectAccess` in the dispatcher for every route with a declared `access` scope (a coverage test guards it); `invites` for team onboarding. Single scoping dimension: `tenant_id` on every row. **Two auth modes:** bearer token (agents/MCP) and JWT-in-HttpOnly-cookie (humans) — both resolve to one `AuthContext`. Projects have a **`code`** (e.g. `OBL`) + `description` + `color`; cards carry a per-project **`seq`** and derive a human **`key`** (`OBL-1`); the descriptive field is **`summary`** (renamed from `title` in v0.7.0). Cards also carry `created_by`/`updated_by`/`assignee_user_id`. **@-mentions** (`card_mentions`, v0.8.0) are a live projection of card/comment text: `@handle` → one mention per (recipient, card, location); editing the handle out retracts it. Ordering is a fractional `position` (drag = midpoint between neighbors). **Agent users** (v0.14.0): a `users` row with `kind='agent'` and `owner_user_id` (the managing human); admins create them + mint their keys via `/api/v1/agents*`. **Callback webhooks** (v0.15.x): admin-managed `webhook_subscriptions` (Team & access) push the two "actionable" triggers — a card entering a `ready` column assigned to an agent, or an agent `@`-mention — gated per project by `agentEventsEnabled` (default on). **Attachments** (v0.16.0): `attachments` rows keyed by (tenant, card, event?) behind a **`BlobStore` port** (R2 on Cloudflare, filesystem self-host). Schema: `apps/api/migrations/` (`0001_init` … `0005/0006` codes+keys, `0007/0008` mentions+handles, `0009` redaction, `0010` human auth, `0011` rbac, `0012` agent owner, `0013` column roles, `0014` webhook subscriptions, `0015` user profile, `0016` attachments). Types + zod: `packages/shared/src/`.

## Repo map

```
apps/api/      Cloudflare Worker + Node self-host server (one runtime-neutral core)
  src/index.ts                CF Worker entrypoint
  src/runtime/{shared,cf,node}/  Db + BlobStore ports + runtime-neutral dispatch +
                                 adapters (D1/R2 vs libsql/filesystem;
                                 runtime/node/index.ts = self-host server)
  src/router.ts               route table + declarative RBAC access scopes
  src/auth/                   bearer-token + cookie-session auth + access enforcement
  src/lib/                    password (PBKDF2), jwt (HS256), cookies
  src/routes/                 auth, tokens, team, agents, projects, columns,
                              cards, attachments, mentions, users, me, webhooks
  src/db/repos/               ALL SQL (auth, team, agents, projects, columns,
                              cards, card_events, attachments, mentions, users, webhooks)
  src/services/{mailgun,webhooks}.ts · src/email/   outbound email + webhook push
                              (both fire-and-forget, graceful no-op if unset)
  src/openapi.ts              canonical OpenAPI 3.1 (parity-tested vs the router)
  scripts/ (migrate-libsql, mint-tenant, build-node) · Dockerfile · migrations/ (0001…0016)
apps/web/      Vite + React 19 SPA on Pages — a pure API client
  src/lib/{api,auth,recentProjects}.ts · src/pages/{AuthShell,BoardApp}.tsx
  src/components/  Board (dnd), CardModal, ProjectSwitcher, BrowseProjectsModal,
                  ProjectSettings, TenantSettings, ApiKeysModal, McpGuide,
                  NotificationBell, Timeline, Markdown, …
packages/shared/  Types + zod schemas shared by api + web
                  (auth, accounts, agents, board, team, events, mentions, colors)
packages/mcp/     @alacrity-ai/kbrelaymcp — standalone stdio MCP server (20 tools)
infrastructure/docker/  docker-compose.yml + .env.selfhost.example (self-host stack)
tools/            mint-token.mjs + CI boundary guards (check-no-*.sh)
docs/vX.Y.Z/      Per-version design docs + release notes
```

## Common operations

```bash
nvm use 24                       # required (pnpm workspaces; engines: node >=24)
pnpm install                     # or: make install
make dev                         # web :5173 + api :8787 (local Miniflare D1)
make db-migrate-local            # apply migrations to local D1
make mint-token TARGET=prod TENANT=lala USER=claude LABEL=claude-main
make test                        # unit (shared + api + mcp)
make check-boundaries            # CF/Node + inline-SQL guards
make deploy-prod                 # migrate + deploy worker + deploy pages
make selfhost-up                 # build + run the whole app on Docker (no Cloudflare)
```

Cloudflare creds + D1 IDs + prod tokens live in `DO_NOT_COMMIT.md` (gitignored — **never print, log, or commit it**). Export `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` before any `make deploy-*` / `make cf-*`.

## Infra

- **Worker** `kbrelay-api`, route `kbrelay.lalalimited.com/api/*`. **Pages** project `kbrelay`, custom domain `kbrelay.lalalimited.com`. **D1** `kbrelay` (prod) / `kbrelay-dev` (dev). **R2** `kbrelay-attachments` (prod) / `kbrelay-attachments-dev` via the `BLOB` binding. Secrets: `JWT_SECRET`, `MAILGUN_*`.
- Same-origin: Pages serves the SPA; the Worker route intercepts `/api/*`.
- **Deploy protocol** (destructive-safe): `wrangler d1 export` backup → migrate prod D1 → verify invariants → deploy Worker → deploy Pages → verify prod. The live `t_lala` tenant is in daily use — migrations are **additive-only**.

## What's shipped since MVP

- **v0.1.0** — UX polish, card view/edit split, mobile, drag-crash fix.
- **v0.2.0** — user colors (a card shows in its assignee's color; `PATCH /me`), 20s board auto-refresh + project persistence, navbar redesign.
- **v0.3.0** — the **card timeline**: an append-only `card_events` log (system events + `note`/`handoff` comments) at `GET /cards/:id/timeline` and `POST /cards/:id/comments`. Report what happened on the timeline, not in the description.
- **v0.4.0** — native markdown rendering for card text. **v0.5.x** — themed dialogs, project-settings modal, mobile drag fixes. **v0.6.0** — board filters (assignee + keyword).
- **v0.7.0** — **project codes + ticket keys**: projects get a `code`, cards get an auto `key` (`OBL-1`) via a per-project `seq`; the old `title` is now **`summary`**.
- **v0.8.0** — **@-mentions & notifications**: `@handle` notifies; navbar **bell** + agent-facing **`GET /me/mentions`** inbox (side-effect-free; ack via `POST /me/mentions/read`). Mentions are a live projection of text.
- **v0.9.0** — **comment redaction (soft-delete)**: `DELETE /cards/:id/comments/:commentId` redacts *your own* comment, keeps a **tombstone**, retracts its mentions. Author-only; idempotent.
- **v0.10.0–v0.13.0** — human auth & self-registration (email/password + JWT cookie sessions, self-service API keys), **team management & binary project RBAC**, a **self-host / Cloudflare split** (a `Db` port; one Node container w/ SQLite via libsql), and a published **MCP server** `@alacrity-ai/kbrelaymcp`.
- **v0.14.0** — **agent users + project General tab**. Admins create/manage **agent users** (`kind=agent` + `owner_user_id`) and their keys via `/api/v1/agents*` (admin-only) and web **Team & access → Agents**; an agent's key resolves to the agent, so provenance is correct. A project **General** tab edits `description` (surfaced to agents via API/MCP) + `color`; new MCP tool **`update_project`**. Migration `0012` (additive). Team & access modal made responsive. Follow-ups: a **Browse Projects** modal + a recency-ordered switcher with an inline filter and per-project `cardCount` badges (the list endpoint returns `cardCount`); project **delete is admin-only** (403 otherwise) with a type-the-name confirm; an in-app **MCP setup guide** (the “?” by the agent/API-key blurbs). MCP `@alacrity-ai/kbrelaymcp@0.3.1`. (`docs/v0.14.0/`.)
- **v0.15.0 / v0.15.x** — **human⇄agent flows + callback events**. Columns gain an optional semantic **`role`** (`ready`/`in_progress`/`review`/`done`/`blocked`; one holder per role per project, migration `0013`); new projects seed six lanes with roles pre-wired. The **actionable queue** — `GET /me/queue` / MCP **`list_my_queue`** — is "cards assigned to me in a `ready` column", and the **handback contract** (§2.5 of the skill) canonicalizes pickup → `in_progress` + note → work → `review` + handoff; `done` only when told; `blocked` + why. v0.15.x adds the **push transport**: admin-managed **webhook subscriptions** (Team & access, migration `0014`, HMAC-signed, mirroring the mailgun fire-and-forget shape) fire on **assign-into-ready** and **agent @-mention**, gated per project by **`agentEventsEnabled`** (General tab, default on) — plus a channels tutorial for wiring a Claude Code session. Also: user **`profile`** field + Profile modal (migration `0015`), navbar brand mark, two-row column headers. MCP `@alacrity-ai/kbrelaymcp@0.4.0`. (`docs/v0.15.0/`.)
- **v0.16.0** — **file attachments**. Hang files off a card's **description**, a **note**, or a **handoff**; images render inline, other types are download links, and each card shows a per-kind badge row. A new **`BlobStore` port** mirrors the `Db` port — **R2** on Cloudflare (binding `BLOB` → `kbrelay-attachments`), a **filesystem** store under `/data/attachments` when self-hosted (MinIO/S3 is a future drop-in behind the same port). Upload is multipart + proxied; download is a same-origin streamed proxy (no presigned URLs); 25 MB cap, `nosniff`, inline only for image/pdf. Migration `0016_attachments` (additive). New routes `POST /cards/:id/attachments`, `GET/DELETE /attachments/:id`, `GET /attachments/:id/blob`; card GET returns `attachments[]`, the board list returns `attachmentCounts`; comments accept `attachmentIds`; redacting a comment / deleting a card purges the bytes. `get_card` (MCP) surfaces attachment metadata + URLs. (`docs/v0.16.0/`.)

## What's deferred (don't assume these exist)

Checklists/due-dates, comment **edit** (redaction shipped v0.9.0; editing is deliberately omitted — correct via follow-up), owner/admin moderation of others' comments, per-API-key scopes/expiry/usage, hard-delete of agent users (deactivate-only — the row is kept for provenance), reactions, a card-link graph, real-time board push (SSE/WS — the web board still polls ~20s; the v0.15.x webhooks push only the two agent-actionable triggers), billing. Attachments: an MCP **upload** tool (`get_card` only surfaces metadata/URLs), MinIO/S3 self-host adapter, presigned direct-to-storage, thumbnails, orphan-upload GC. (Human login/passwords, RBAC, registration/invites, multi-tenant membership, agent-user API keys, column roles + queue, webhooks, and attachments have all shipped — v0.10.0–v0.16.0.) See each release's notes under `docs/`.
