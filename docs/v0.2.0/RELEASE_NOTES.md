# kbRelay — v0.2.0 Release Notes

**Date:** 2026-07-01
**Type:** Feature + UX release (API + web)
**Live:** https://kbrelay.lalalimited.com

First release since v0.1.0 to touch the **backend** — users gained a color, so
this shipped a **D1 migration + Worker deploy** alongside the Pages deploy.

## What changed

### 1. Card color = the assignee's color
- Color is now a property of the **user**, not the card. A card renders in its
  **assignee's** color (left border + a dot on the assignee chip); unassigned
  cards are neutral gray.
- Seeded identities: **Claude = red**, **Leif = blue**, **Joe = green**. Any user
  without an explicit color gets a stable, deterministic palette color.
- **Set your own color:**
  - API: `PATCH /api/v1/me` with `{ "color": "#rrggbb" }` (self-only — the token
    is tied to a user). `GET /api/v1/me` and `/api/v1/users` now return `color`.
  - UI: a "Your color" picker in the new user menu.
- The **per-card color picker was removed**; `color` is no longer accepted in card
  create/patch bodies. (`cards.color` column + `CardDto.color` remain, unused, to
  avoid a destructive migration.)

### 2. Auto-refresh + reload lands you back on the same project
- The open board **silently re-fetches every 20s** while the tab is visible, and
  the instant it regains focus — so changes agents/others make appear without a
  manual reload. Skipped mid-drag; no spinner flash; background errors stay quiet.
- The selected project is persisted to `localStorage`, so a browser reload keeps
  you on the project you were viewing.

### 3. Top navbar polish
- **Bespoke project switcher** (dropdown with color dots + a "+ New project"
  action) replaces the cramped native `<select>`.
- **Consolidated user menu**: a colored avatar (initials) + name opens a panel
  with your kind badge, tenant, the color picker, and Sign out — decluttering the
  bar. Collapses gracefully to avatar-only on a phone.

## Data model
- `0003_user_color.sql`: `users.color TEXT` (nullable) + backfill Claude/Leif/Joe.
  Additive and safe.

## Deploy
- `make db-migrate-prod` → `make deploy-api-prod` → `make deploy-web-prod`.
- Worker version `0f20c6cb…`; web bundle `index-CR9bSvgh.js` / `index-Bh6TtxOq.css`.
- **Verified live:** `openapi.json` documents `PATCH /api/v1/me` + `User.color`;
  `/me` and `/users` return colors (Claude red / Leif blue / Joe green); health ok.
- **Rollback:** redeploy the previous Worker + Pages build; the extra column is
  inert if unused.

## Verification
- `make typecheck` ✓ · `make lint` ✓ · `make test` (27 unit tests) ✓ · web build ✓
- Local smoke against Miniflare D1: migration applies; `GET/PATCH /me`, `/users`
  colors, and invalid-color → 400 all confirmed before prod.
- Owner (Leif) to evaluate the live UX.

## Not in this release (still deferred)
Comments/attachments/checklists/activity feed, real-time push, human login/RBAC,
multi-tenant membership, light theme, per-tenant color palettes.
