# kbRelay — v0.12.0 Design: Self-Host / Cloudflare Split

**Date:** 2026-07-01
**Status:** Design (pre-implementation). Item 3 of `0-ROADMAP_PLAN.md`.
**Grounded in:** textral (`/home/leif/textral/TEXTRAL_REFACTOR_WIP`):
`apps/api/src/runtime/shared/interfaces.ts`, `runtime/cf/d1-db.ts`,
`runtime/node/pg-db.ts`, `runtime/{cf,node}/bindings.ts`, `src/index.ts`,
`src/runtime/node/index.ts`, `apps/api/Dockerfile`,
`infrastructure/docker/docker-compose.yml`, `scripts/migrate-postgres.ts`,
`tools/check-no-*.sh`.

---

## 1. Goal

Run kbRelay (API + web + DB) **with zero Cloudflare dependency**, self-hosted via
Docker, while the Cloudflare deployment keeps working unchanged. Two modalities,
**one codebase**, chosen by **which entrypoint boots** (no in-app mode flag —
textral's key lesson).

## 2. The core simplification — SQLite on both sides

textral pays a real tax for Postgres self-host: a `?`→`$N` translator, BIGINT/JSON
type-parity shims, and **two migration trees**. kbRelay avoids all of it: our SQL is
already **plain SQLite** (D1). So self-host runs **SQLite via `@libsql/client`** (a
local file, `libsql://`/`sqld` optional). Consequences:

- **One SQL dialect, one migration tree** — the exact `apps/api/migrations/*.sql` run
  on both D1 and libsql. No translation, no type shims.
- **Identical semantics** — RETURNING, correlated subqueries, `ALTER … RENAME
  COLUMN`, `INSERT … / DELETE`, and our `batch()` groups behave the same on D1 and
  libsql (same engine). This is why Item 3 is **low risk**.

Postgres stays a *possible future adapter*, not something we build now.

## 3. The `Db` port — shaped like D1 (minimal repo churn)

textral redesigned repos around `one/all/exec`. We don't need to: define the port as
**D1's own surface**, so repos change by ~one identifier, not a rewrite.

```ts
// runtime/shared/db.ts
export interface Db {
  prepare(sql: string): DbStatement;
  batch(stmts: DbStatement[]): Promise<void>;
}
export interface DbStatement {
  bind(...args: unknown[]): DbStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}
```

- **CF adapter = the D1 binding itself** (`env.DB` already satisfies this shape).
- **Node adapter** (`runtime/node/libsql-db.ts`): wrap `@libsql/client` so
  `prepare(sql).bind(...).first()/all()/run()` and `batch([...])` map onto libsql's
  `execute`/`batch`. Normalize the row/`results` shape to match D1.
- **Repos change `env.DB` → `env.db`** (a rename) and otherwise keep their SQL and
  `.prepare().bind().first()/all()/run()` calls **verbatim**. `insertEventStmt` /
  `reconcileMentionStmts` etc. that return prepared statements for `batch` keep
  working — they now build against `env.db`.

**`batch` / atomicity parity:** D1 `batch` runs the group atomically; libsql `batch`
(or a `BEGIN…COMMIT` wrapper) does the same. The port's `batch` is the only
transaction primitive kbRelay uses today, so parity is trivial to guarantee.

## 4. Two entrypoints, one app

Refactor the dispatcher so the routing/handler core is **runtime-neutral** and takes a
built `env`:

- **`buildEnv` split.** Introduce `AppEnv` (what handlers see: `{ db, JWT_SECRET,
  MAILGUN_*, PUBLIC_BASE_URL, … }`). `runtime/cf/bindings.ts#buildCfBindings(env)`
  wraps the Worker `env` (D1 `DB` → `db`, vars/secrets passthrough).
  `runtime/node/bindings.ts#buildNodeBindings(process.env)` builds the libsql `db` +
  reads config from env vars.
- **CF entrypoint** stays `apps/api/src/index.ts`: `export default { fetch(req, env,
  ctx) { return dispatch(req, buildCfBindings(env), ctx) } }`.
- **Node entrypoint** `apps/api/src/runtime/node/index.ts`: a small server using
  **`@whatwg-node/server`** (`createServerAdapter`) + `node:http` — Node 24 has global
  `Request`/`Response`, so the same `dispatch(req, env)` runs unchanged. It also
  **serves the built SPA** (`apps/web/dist`) for non-`/api` paths (static file
  handler), giving the same-origin `/api` model in one process. Graceful shutdown on
  SIGTERM/SIGINT.

Handlers already receive a `RouteContext {env,…}`; they only ever touch `ctx.env.db`
and config — never a runtime primitive. The Web-standard `Request`/`Response` the
dispatcher already uses is the portability seam.

## 5. Migrations — one tree, two appliers

- **Keep** `apps/api/migrations/*.sql` as the single source.
- **CF/D1:** unchanged — `wrangler d1 migrations apply` (existing `make db-migrate-*`).
- **Self-host/libsql:** a ~40-line runner `apps/api/scripts/migrate-libsql.ts` (model
  on textral's `migrate-postgres.ts`): read the `.sql` files sorted by name, apply each
  in a transaction, track applied names in a `_migrations` ledger table (idempotent).
  Because the dialect is identical, **no per-file changes** — the same SQL text runs.

## 6. Docker & compose (minimal)

- **One `Dockerfile`** (Node 24, multi-stage): build `@kbrelay/shared`, `apps/web`
  (Vite → `dist`), and bundle the Node entrypoint + migrate runner (esbuild). Runtime
  stage carries `dist/` (server) + `apps/web/dist` (SPA) + `migrations/`. `CMD` runs
  the Node server.
- **`docker-compose.yml`** = **just the `app` service + a named volume** for the SQLite
  file (`/data/kbrelay.db`) — **no DB/redis/other containers.** `env_file:
  .env.selfhost`. A healthcheck on `/api/health`. (Optional `sqld` service documented
  for anyone wanting a networked DB, but the default is the embedded file.)

## 7. Make targets

- `selfhost-up` → `docker compose up -d --build --wait`
- `selfhost-down`, `selfhost-logs`
- `selfhost-migrate` → run `migrate-libsql` against the volume (once before first use)
- **`selfhost-mint-tenant NAME=… EMAIL=…`** → a CLI (`scripts/mint-tenant.ts`) that
  creates tenant + admin user (+ optional password) + a first API token, **no email**
  — the offline equivalent of self-registration (mirrors textral's `/admin/bootstrap`
  + `seed-self-host.ts`). Prints the token once.

Mailgun stays a graceful no-op unless `MAILGUN_*` is set, so self-register email flows
are *optional* in self-host — the make target is the primary onboarding path.

## 8. Config / env

- **CF:** `wrangler.toml` bindings/vars + `wrangler secret put` (unchanged) plus the
  Item 1 secrets (`JWT_SECRET`, `MAILGUN_*`, `PUBLIC_BASE_URL`).
- **Self-host:** `.env.selfhost` (+ `.example`) read by `buildNodeBindings`:
  `DATABASE_URL` (e.g. `file:/data/kbrelay.db`), `JWT_SECRET`, `PUBLIC_BASE_URL`,
  optional `MAILGUN_*`, `PORT`.

## 9. Boundary guards (copy textral `tools/`)

Three CI scripts keep the shared code runtime-neutral:
- `check-no-inline-db.sh` — all SQL goes through `env.db` / `src/db/**` (no stray
  `env.DB.prepare`).
- `check-no-cf-imports-in-node.sh` — no `@cloudflare/*` / Worker types under
  `runtime/node/**` or shared.
- `check-no-node-imports-in-cf.sh` — no `@libsql/*`, `node:*`, `@whatwg-node/*` under
  `runtime/cf/**` or shared.

## 10. Resolved decisions

- **DB port = D1-shape** (not `one/all/exec`) — smallest diff to existing repos.
- **libsql embedded file** by default (`sqld` optional) — simplest "sql container".
- **Node serves SPA + API** in one process (same-origin), one container.
- **One migration tree**; libsql gets a tiny ledger-based runner.
- **Folder layout:** `apps/api/src/runtime/{shared,cf,node}` + `scripts/`.
- **No Postgres** in this item.

## 11. Testing

- Repos are unchanged logic → existing api tests still pass against D1.
- Add a **libsql adapter test**: run a slice of real repo calls (create card, move,
  comment, mention reconcile, redact) against an in-memory/temp libsql file and assert
  parity with expectations (RETURNING, batch atomicity, correlated subquery numbering).
- **Self-host stack smoke:** `make selfhost-up` → `selfhost-migrate` →
  `selfhost-mint-tenant` → hit the API + load the SPA on `localhost` → run the mention/
  redaction lifecycle end-to-end with **no Cloudflare involved**.
- CF path re-verified in prod after the refactor (behavior must be byte-identical).

## 12. Deploy

CF: normal `migrate → Worker → Pages` (the refactor is internal; the contract is
unchanged). Self-host: `make selfhost-up` on any Docker host. Verify **both**
modalities before declaring the item done.

## 13. Out of scope (→ later)

Postgres adapter, R2/S3 blob store (kbRelay has no uploads), KV/Redis, queues,
multi-node self-host, TLS termination (assume a reverse proxy), backups/replication
(a `sqld`/Litestream note only).
