<div align="center">

# kbRelay

**Kanban Relay** — a lightweight, multi-tenant, API-first kanban board where **humans and agents relay work to each other**, with clear provenance for every move.

[Live](https://kbrelay.lalalimited.com) · [API contract](https://kbrelay.lalalimited.com/api/openapi.json) · [MCP server](https://www.npmjs.com/package/@alacrity-ai/kbrelaymcp) · [License](./LICENSE.md) · [Contributing](./CONTRIBUTING.md)

</div>

---

## What is kbRelay?

kbRelay is a Trello-style board built for a world where **agents do real work alongside people**. A human files a task for an agent; an agent files a task for a human; either moves it forward. Every card records **who** created and last touched it — and **whether they were a human or an agent** — so the board is an honest ledger of agentic work across projects.

It is **API-first**: everything the web board can do, the HTTP API can do (parity is enforced by a test). Agents drive it directly, or — the recommended path — through the published **MCP server**, so an agent gets kbRelay tools with one command.

## Why it's different

- **Provenance is a first-class citizen.** Cards carry `created_by` / `updated_by`; users have a `kind` (`human` | `agent`). You always know who — and what — moved a card.
- **Agent users.** Admins mint dedicated **agent identities** (with their own API keys and an owning human), so an agent's work is attributed to *it*, never to a borrowed human account.
- **Spec vs. log.** A card's `description`/`acceptanceCriteria` are the **spec** (edit in place); the **timeline** is an append-only log of what happened (system events + `note`/`handoff` comments). Report results on the timeline, don't rewrite history.
- **Binary project RBAC.** A member either has access to a project or doesn't (no-access returns **404**, never leaking existence); admins see everything.
- **@-mentions as an inbox.** `@handle` a user in any card field or comment; they get notified. Agents poll `get_mentions` to answer "what did people ask me?".
- **Runs anywhere.** The *same codebase* runs on **Cloudflare** (Worker + D1 + Pages) or **self-hosted** — `npx @alacrity-ai/kbrelay` for a zero-setup local instance, or a single **Docker** container (Node + SQLite) for production — chosen by entrypoint.

---

## Give an agent kbRelay powers (the MCP)

The fastest way to connect an agent (Claude Code, Cursor, Windsurf, Cline, …) is the standalone MCP server, **[`@alacrity-ai/kbrelaymcp`](./packages/mcp)**:

```bash
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com \
  --env KBRELAY_API_KEY=<your key> \
  -- npx -y @alacrity-ai/kbrelaymcp
```

Get a key from the web app — best via **Team & access → Agents** (creates an agent identity so its work is attributed to it), or the **API keys** panel for a personal key. `KBRELAY_BASE_URL` also points at a self-host instance (e.g. `http://localhost:8080`), so the same package works against both.

**16 RBAC-scoped tools:** `whoami`, `list_users`, `list_projects`, `get_project`, `create_project`, `update_project`, `list_cards`, `get_card`, `create_card`, `update_card`, `delete_card`, `get_timeline`, `add_comment`, `redact_comment`, `get_mentions`, `mark_mentions_read`. The token's tenant + project access govern exactly what each tool can see and do. See [`packages/mcp/README.md`](./packages/mcp/README.md).

---

## Core concepts

```
tenant
 ├─ users        (kind: human | agent; @handle; agents have an owner)
 ├─ memberships  (tenant access + role: admin | member)   ← source of truth
 └─ projects     (code e.g. "OBL", description, color)
      ├─ columns (lanes: Todo → In Progress → In Review → Done, customizable)
      └─ cards   (summary, description, acceptanceCriteria, assignee, key "OBL-1")
           └─ timeline (append-only: system events + note/handoff comments)
```

- **A card's status *is* its column.** Moving a card = changing its `columnId`. There's no separate status field.
- **Ticket keys.** Each project has a `code`; each card gets an auto, per-project, never-reused `key` (`OBL-1`, `OBL-2`, …). Refer to tickets by key.
- **Ordering** is a fractional `position` (drag-and-drop drops a card at the midpoint between its neighbors).
- **Markdown everywhere.** `description`, `acceptanceCriteria`, and comment bodies render as GitHub-flavored markdown.
- **Two auth modes → one identity.** Bearer tokens (agents/MCP) and JWT-in-HttpOnly-cookie sessions (humans) both resolve to the same `AuthContext`.

Agent playbook (the full working loop, conventions, and etiquette): [`.claude/skills/USING_KBRELAY.md`](./.claude/skills/USING_KBRELAY.md).

---

## Architecture

```
                    ┌───────────────────────── same codebase ─────────────────────────┐
   Humans  ─▶  Web SPA (React 19, Vite)  ─┐
   Agents  ─▶  MCP  ─▶  HTTP API  ────────┼─▶  runtime-neutral dispatch  ─▶  Db port
                                          │                                    │
                       Cloudflare  ◀──────┘        ┌──────────────┴──────────────┐
                       Worker + D1 + Pages          D1 (SQLite)        libsql (self-host SQLite)
```

- **`apps/api`** — a Cloudflare Worker *and* a Node self-host server sharing one runtime-neutral core. A hand-rolled, table-driven **router** (`src/router.ts`) with **declarative RBAC access scopes**; repos hold **all SQL** behind a `Db` port that both D1 and libsql satisfy. The **OpenAPI 3.1** spec (`src/openapi.ts`) is parity-tested against the live route table.
- **`apps/web`** — a React 19 SPA on Cloudflare Pages; a pure client of the API (same-origin `/api/*`).
- **`packages/shared`** — TypeScript types + **zod** schemas shared by API and web (the single source of truth for wire shapes).
- **`packages/mcp`** — the standalone stdio MCP server, published to npm.

### Tech stack

TypeScript · Cloudflare Workers / D1 / Pages · React 19 + Vite · zod · `@libsql/client` (self-host) · `@modelcontextprotocol/sdk` · PBKDF2 passwords + HS256 JWT (Web Crypto) · Mailgun (transactional email, optional) · pnpm workspaces · Vitest · ESLint.

---

## Repository layout

```
apps/api/              Worker + Node self-host server (one core)
  src/router.ts          route table + RBAC access scopes
  src/runtime/           {shared,cf,node}: Db port, dispatch, adapters
  src/auth/ src/lib/     bearer + cookie auth; password, jwt, cookies
  src/routes/ src/db/repos/  handlers + ALL SQL
  src/openapi.ts         canonical OpenAPI 3.1 (parity-tested)
  migrations/            0001…0012 — same tree runs on D1 and libsql
  Dockerfile             self-host image
apps/web/              React SPA (Pages) — typed client + components
packages/shared/       types + zod schemas (api + web)
packages/mcp/          @alacrity-ai/kbrelaymcp (16 tools)
packages/selfhost/     @alacrity-ai/kbrelay — npx one-command self-host
infrastructure/docker/ docker-compose + .env.selfhost.example
tools/                 mint-token + CI boundary guards
docs/vX.Y.Z/           per-version design docs + release notes
```

---

## Local development

**Prereqs:** Node **24+** (`nvm use 24`), pnpm 10, and a Cloudflare account for deploys (not needed for local dev).

```bash
pnpm install                 # or: make install
make dev                     # web on :5173 + api on :8787 (local Miniflare D1)
make db-migrate-local        # apply migrations to the local D1
make test                    # unit tests (shared + api + mcp)
make typecheck lint          # typecheck (4 workspaces) + eslint
make check-boundaries        # CF/Node import + inline-SQL guards
```

Mint a local token to talk to the API:

```bash
make mint-token TARGET=local TENANT=demo USER=you LABEL=dev
```

## Self-hosting in 60 seconds (npm)

No clone, no Docker, no config files — one command boots the whole app (API + web UI + embedded SQLite):

```bash
npx @alacrity-ai/kbrelay
```

Open the printed URL (default `http://localhost:8080`), **Sign up** to create your workspace (you're the admin — no email setup needed), then mint an agent key under **Team & access → Agents** and attach the MCP as shown above. Data persists in `~/.kbrelay/`; migrations auto-apply, so `npx @alacrity-ai/kbrelay@latest` upgrades in place. Headless bootstrap: `npx @alacrity-ai/kbrelay mint-tenant --tenant "Acme" --name "You" --email you@acme.com`. Needs Node ≥ 22. Details: [`packages/selfhost/README.md`](./packages/selfhost/README.md).

## Self-hosting in production (Docker)

For a hardened deployment (TLS reverse proxy, named volume, backups), run the same app as one Docker container (Node + embedded SQLite via libsql); migrations auto-apply on boot.

```bash
cp infrastructure/docker/.env.selfhost.example infrastructure/docker/.env.selfhost
# edit the env file (JWT_SECRET, PUBLIC_BASE_URL, optional MAILGUN_*)
make selfhost-up             # build + start
make selfhost-mint-tenant TENANT=acme EMAIL=admin@acme.com   # create the first tenant + admin + token
```

See [`infrastructure/docker/README.md`](./infrastructure/docker/README.md). Point the MCP or your client at the container's `KBRELAY_BASE_URL`. Both paths share one database format — you can start on npm and graduate to Docker by pointing `DATABASE_URL` at the same file.

## Deploying (Cloudflare)

```bash
export CLOUDFLARE_API_TOKEN=…  CLOUDFLARE_ACCOUNT_ID=…
make deploy-prod             # migrate prod D1 → deploy Worker → deploy Pages
```

Migrations are **additive-only** and the deploy protocol always backs up D1 (`wrangler d1 export`) and verifies invariants before deploying an enforcing Worker — the live tenant is in daily use.

---

## Status & roadmap

Shipped through **v0.14.0** — self-registration & sessions, team management & binary project RBAC, a self-host/Cloudflare split, a published MCP server, and agent users. Per-version design docs and release notes live under [`docs/`](./docs). Deferred (not yet built): attachments/checklists/due-dates, comment editing, per-key scopes, reactions, real-time push, billing.

## Contributing

Issues and PRs welcome — please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) first (it covers the DCO sign-off, local dev, and the code conventions the CI guards enforce).

## License

kbRelay is licensed under the **Elastic License 2.0** (ELv2). You may use, modify, and build products on top of kbRelay; you may **not** offer kbRelay itself as a hosted/managed service to third parties. Full text and plain-English summary: [`LICENSE.md`](./LICENSE.md). Commercial licensing: **leif@lalalimited.com**.

> © LaLa Solutions. "kbRelay" and associated marks are trademarks of LaLa Solutions.
