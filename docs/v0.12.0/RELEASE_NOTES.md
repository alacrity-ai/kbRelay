# kbRelay v0.12.0 — Self-Host / Cloudflare Split

**Shipped:** 2026-07-01 · **Design:** `../v0.10.0/3-SELFHOST_OR_HOSTED_SPLIT_DESIGN.md`

Item 3 of the roadmap. kbRelay now runs **two ways from one codebase**: the existing
Cloudflare deployment (Worker + D1 + Pages) **and** a self-hosted Docker container (one
Node process, SQLite via libsql) with **zero Cloudflare dependency**. The modality is
chosen by which entrypoint boots — no in-app mode flag.

## What shipped

- **The `Db` port** (`runtime/shared/db.ts`) — shaped like D1's own surface
  (`prepare/bind/first/all/run` + `batch`), so repos changed by a rename
  (`env.DB` → `env.db`), not a rewrite. Two implementations: the CF D1 binding
  (passed through as-is) and a `@libsql/client` adapter (`runtime/node/libsql-db.ts`).
- **One runtime-neutral dispatcher** (`runtime/shared/dispatch.ts`) — the routing /
  auth / RBAC core, over Web-standard `Request`/`Response`. Two thin entrypoints call
  it: the CF Worker (`src/index.ts` → `buildCfBindings`) and a **Node server**
  (`runtime/node/index.ts` via `@whatwg-node/server`) that also **serves the built
  SPA** for same-origin `/api`.
- **SQLite on both sides** — self-host uses the SAME `apps/api/migrations/*.sql` (no
  dialect translation, no type shims, one migration tree). A small ledger-based
  libsql migration runner (`scripts/migrate-libsql.ts`) applies them idempotently.
- **Docker** — one multi-stage `apps/api/Dockerfile` (build SPA + esbuild-bundle the
  server/CLIs; slim runtime with the native SQLite client) and a one-service
  `docker-compose.yml` (app + a SQLite volume, no DB container). Migrations auto-apply
  on boot.
- **Offline onboarding** — `scripts/mint-tenant.ts` (`make selfhost-mint-tenant`)
  creates a tenant + admin + API token with no email — reuses `registerTenant`, so it's
  identical to a web sign-up. Mailgun stays a graceful no-op when unset.
- **Make targets** — `selfhost-up/down/logs/migrate/mint-tenant`, `check-boundaries`.
- **Boundary guards** (`tools/check-no-*.sh`) — CI-style checks that the shared code
  stays runtime-neutral: no raw `env.DB`, no `@cloudflare/*` in shared/node code, no
  `@libsql/*` / `node:*` / `@whatwg-node/*` in CF/shared code.

## Why it's low-risk

Both backends are the **same SQLite engine**, so RETURNING, correlated subqueries,
`ALTER … RENAME COLUMN`, and atomic `batch()` groups behave identically. The repo logic
is unchanged; only the `db` handle differs.

## Tests & validation

- **libsql adapter parity test** (`runtime/node/libsql-db.test.ts`): real repo calls
  (register, create/move card, comment, mention reconcile + live excerpt, redact)
  against an in-memory libsql DB — proves RETURNING, batch atomicity, and correlated
  subqueries match D1. (76 API unit tests total.)
- **Self-host stack smoke** (Docker): `make selfhost-up` → mint-tenant → create
  project + card over the API → SPA served — all with no Cloudflare. Verified the
  container is healthy and migrations auto-applied.
- **CF re-verified in prod**: the refactor is internal (no migration, no contract
  change); the Item 2 prod verification passed **byte-identical** after redeploying the
  Worker (admin/member access preserved, RBAC live, live tenant intact).

## Not in this item (later)

Postgres adapter, blob/KV/queues, multi-node self-host, TLS termination (assume a
reverse proxy), backup/replication (a `sqld`/Litestream note only). Next: the MCP
server (v0.13.0).
