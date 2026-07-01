# kbRelay v0.10.x — What We Landed

**Date:** 2026-07-01 · Outcome record for the initiative planned in
`PLANNING_HIGH_LEVEL.md`. All four roadmap items are **built, tested, and landed.**

## The four items

| # | Item | Version | Status | Verification |
|---|------|---------|--------|--------------|
| 1 | Self-registration & sessions | v0.10.0 | **Deployed to prod** | 31 local + 13 prod assertions |
| 2 | Team management & project RBAC | v0.11.0 | **Deployed to prod** | 31 local + 7 prod assertions |
| 3 | Self-host / Cloudflare split | v0.12.0 | **Both modalities verified** | libsql parity test + full Docker stack; CF prod byte-identical |
| 4 | MCP server `@alacrity-ai/kbrelaymcp` | v0.13.0 | **Published to npm (0.1.0)** | 11 unit + 12 integration + install smoke |

Per-item detail: `docs/v0.10.0/RELEASE_NOTES.md` … `docs/v0.13.0/RELEASE_NOTES.md`.

## What each delivered

- **v0.10.0** — Register → own tenant + owner + starter agent (atomic). PBKDF2 +
  HS256 JWT HttpOnly cookie; login/logout/forgot/reset; self-service API keys;
  membership model. Two auth modes (bearer token **and** cookie) → one `AuthContext`.
  Web `/auth/*` + API-keys panel. Migration `0010` (additive). **Agents' bearer tokens
  unchanged.**
- **v0.11.0** — Binary `project_access`, enforced by one dispatcher check driven by
  declarative route `access` scopes (no-access → **404**), guarded by a
  router-iterating coverage test. Admin Team & access modal (invite/remove/role +
  per-member project checklist) + public accept-invite. Assignee & @-mention access
  enforcement. Migration `0011` with a **behavior-preserving backfill**.
- **v0.12.0** — A `Db` port shaped like D1 (repos changed by a rename); one
  runtime-neutral dispatcher; a Node entrypoint serving API + SPA; **SQLite via libsql**
  on the *same* migration tree; one `Dockerfile` + one-service compose (embedded SQLite
  volume, auto-migrate on boot); offline `mint-tenant`; boundary-guard scripts.
- **v0.13.0** — Standalone stdio MCP server, inline fetch client, **15 RBAC-scoped
  tools**, `publishConfig.access: public`. Published `0.1.0`.

## The hard constraint held

Across both prod migrations (`0010`, `0011`) the live **`t_lala` tenant stayed intact**
— **6 projects, 38 cards**, existing tokens working — each step gated by a
`wrangler d1 export` backup + explicit post-migration verification. RBAC rollout was
behavior-preserving: a member (`u_claude`) still sees all 6 projects; nothing
disappeared when enforcement turned on. Restore points: `kbrelay-pre0010.sql`,
`kbrelay-pre0011.sql`.

## Final state

- **Quality gates green:** typecheck (4 workspaces), lint, **134 unit tests**
  (47 shared + 76 api + 11 mcp), boundary guards.
- **Prod:** Worker version `eec142c9`; Pages redeployed; migrations `0010`+`0011`
  applied; new secrets set (`JWT_SECRET` recorded in `DO_NOT_COMMIT.md`, `MAILGUN_*`).
- **Self-host:** `make selfhost-up` builds + runs the whole app on Docker with no
  Cloudflare (see `infrastructure/docker/README.md`).

## Two flags

1. **npm read-CDN propagation** — the package is published (proven by npm's
   `403 "cannot publish over 0.1.0"` on a re-attempt); `npm view` was still lagging on
   the read side at last check (normal for a first-time scope). `npx -y
   @alacrity-ai/kbrelaymcp` resolves once it catches up. The tarball's `bin` field and
   the install `.bin` symlink were both verified working.
2. **Nothing committed** — per the no-commit-unless-asked rule, ~19 changed/new paths
   sit on `develop`, ready for review. A commit (and tags like `mcp-v0.1.0`) is a
   one-word ask away.
