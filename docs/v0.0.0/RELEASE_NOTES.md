# kbRelay v0.0.0 — Release Notes

**Shipped:** 2026-07-01
**Live:** https://kbrelay.lalalimited.com (SPA) · `https://kbrelay.lalalimited.com/api` (Worker) · `/api/openapi.json` (contract)

The MVP: a lightweight, multi-tenant, API-first kanban board where humans and agents relay work to each other.

## What shipped

- **Multi-tenant from row zero.** Every row is scoped by `tenant_id`; a token sees only its tenant's data. Verified by an automated cross-tenant isolation test (Acme cannot read/mutate LaLa's data — all 404).
- **Users as first-class actors.** `human` vs `agent` kind; every card stamped with `created_by` / `updated_by`, so the board shows who did what (e.g. "Claude created, Leif moved").
- **Unified bearer-token auth.** Humans and agents authenticate the same way; the web UI is just a token-holding API client. Tokens stored hashed (sha256), minted out-of-band.
- **Projects → columns → cards.** Projects seed the default `Todo → In Progress → In Review → Done`. Columns are renamable/addable/reorderable/deletable (empty only). Cards have title, description, acceptance criteria, color, assignee, and fractional-rank ordering.
- **Drag-and-drop** board (web) via `@dnd-kit`, persisting moves through the API.
- **OpenAPI 3.1** served at `/api/openapi.json`, kept honest by a router-parity test.
- **API/UI parity** — everything the board does, the API does.

## Stack / infra

- Monorepo (pnpm workspaces, Node 24): `apps/api` (Cloudflare Worker), `apps/web` (Vite + React 19 → Cloudflare Pages), `packages/shared` (types + zod).
- **D1**: `kbrelay` (prod) / `kbrelay-dev` (dev). **Pages**: project `kbrelay`, custom domain `kbrelay.lalalimited.com`. Same LaLa Cloudflare account as landlord-contracts.
- Makefile-driven: `make dev`, `make deploy-prod`, `make mint-token`.

## Verification at ship

- Unit: 26 tests (rank logic, OpenAPI parity, shared schemas) — green.
- Integration: 33 assertions (board CRUD, provenance, ordering, validation, cross-tenant isolation) against a live worker — green.
- Prod smoke: health, authenticated `/me`, OpenAPI, SPA all live at `kbrelay.lalalimited.com`.

## Deliberately deferred (hooks left in — all additive later)

- Human login (password / magic-link) — MVP humans paste a token.
- RBAC enforcement — nullable `users.role` exists, unenforced.
- Self-service registration / invites / email.
- A user in multiple tenants — single `users.tenant_id` for now.
- Card activity feed, attachments, checklists, comments, due dates, real-time sync, billing.

## Token runbook

Mint: `make mint-token TARGET=prod|dev|local TENANT=lala USER=<name> LABEL=<label>` → prints the plaintext **once**, stores only the hash. Record it in `DO_NOT_COMMIT.md`. Prod tokens for Leif/Joe/Claude were minted at ship (see `DO_NOT_COMMIT.md`).

## Known follow-ups

- The dev environment (`dev.kbrelay.lalalimited.com`) route exists in `wrangler.toml` but its DNS/custom-domain isn't wired (prod-only for now).
- First-load of a brand-new tenant shows an empty board — create a project to begin.
