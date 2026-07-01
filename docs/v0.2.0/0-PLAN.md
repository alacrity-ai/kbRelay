# kbRelay — v0.2.0 Plan

**Date:** 2026-07-01
**Status:** design + implementation plan
**Predecessors:** `docs/v0.0.0/` (MVP), `docs/v0.1.0/` (UX polish)
**Live:** https://kbrelay.lalalimited.com

Three focused changes. Unlike v0.1.0 (web-only), **Feature 1 touches the data
model + API** (users gain a color), so this release ships a **D1 migration + a
Worker deploy** alongside the Pages deploy.

---

## Feature 1 — Card color = the assignee's color

**Why:** picking a per-card color by hand is busywork and not very meaningful. A
card's color should tell you *who owns it* at a glance. Colors become a property
of the **user**, not the card.

**Behaviour**
- Every user has a `color`. Seeded: **Claude = red**, **Leif = blue**,
  **Joe = green**. Any user without an explicit color gets a **stable
  deterministic** color derived from their id (so new/other users still look
  distinct without manual setup).
- A card's display color is its **assignee's** color. Unassigned cards render a
  neutral gray.
- Users can set **their own** color (the API token is tied to a user):
  - **API:** new `PATCH /api/v1/me` with `{ "color": "#rrggbb" }`. Self-only —
    you can only recolor the user your token resolves to.
  - **UI:** a small color picker in the user menu (see Feature 3).
- The **per-card color setting is removed** from the UI, and `color` is dropped
  from the card create/patch request bodies (the API no longer accepts it). The
  `cards.color` DB column and the `CardDto.color` field are left in place
  (harmless, non-breaking; simply unused by the UI now) to avoid a destructive
  migration.

**Data model**
- Migration `0003_user_color.sql`: `ALTER TABLE users ADD COLUMN color TEXT;`
  then backfill the three seeded users (Claude/Leif/Joe).

**Shared (`packages/shared`)**
- `UserDto`, `MeResponse.user`, `AuthContext` gain `color: string` (always
  populated — never null on the wire, thanks to the deterministic fallback).
- New `colors.ts`: `USER_PALETTE`, `colorForUser(id)` (stable hash→palette),
  `UNASSIGNED_COLOR`. Used by **both** API (fallback) and web (rendering) so they
  never disagree.
- New `patchMeInput` zod schema: `{ color: '#rrggbb' }`.
- Remove `color` from `createCardInput` / `patchCardInput`.

**API (`apps/api`)**
- `authenticate.ts`: select `users.color`; put it on `AuthContext` (fallback to
  `colorForUser` when null).
- `db/repos/users.ts`: select + return `color` (fallback applied); add
  `updateUserColor(...)`.
- `routes/me.ts`: `handlePatchMe` — validate, update own color, return fresh
  `MeResponse`. `handleMe` now includes `color`.
- `router.ts`: register `PATCH /api/v1/me`.
- `openapi.ts`: add `color` to the `User` schema; document `PATCH /api/v1/me`
  (keeps the router↔spec parity test green).
- `cards.ts` repo: stop reading `input.color`; create writes `null`, patch leaves
  the existing value untouched.

**Web**
- `CardBody`/card render: left-border color = assignee's color (or
  `UNASSIGNED_COLOR`); the assignee chip gets a matching color dot.
- `CardModal`: remove the color swatches + `color` from the save payload; the
  modal accent uses the assignee's color.
- `lib/api.ts`: `patchMe(color)`.

---

## Feature 2 — Auto-refresh the open board + survive reloads on the same project

**Why:** the board never refreshes on its own, so changes others (or agents) make
don't show until a manual browser reload — and reloading can dump you onto a
different project.

**Behaviour**
- **Auto-refresh:** while the board is open and the **tab is visible**, silently
  re-fetch the project's columns + cards every **20s**. Also refresh immediately
  when the tab regains visibility/focus. "Silent" = no loading spinner flash, and
  the poll is **skipped during an active drag** so it can't clobber an in-flight
  move. An open card modal is fine (its data is a snapshot; the board refresh
  behind it doesn't disrupt it).
- **Project persistence:** the selected project id is stored in `localStorage`.
  On load, restore it if it still exists; otherwise fall back to the first
  project. So a reload keeps you where you were.

**Implementation**
- `Board.tsx`: `load({ silent })` variant (skips `setLoading`); a `setInterval`
  (20s) + `visibilitychange` listener that calls `load({ silent:true })` when
  `document.visibilityState === 'visible'` and no drag is active; guard against
  overlapping loads.
- `BoardApp.tsx`: read/write `localStorage['kbrelay.selectedProject']`; initialize
  `selected` from it when valid.

---

## Feature 3 — Top navbar polish

**Why:** the project `<select>` is cramped and narrow; the left-side identity
cluster (name, kind, tenant, sign-out) feels tight and unpolished.

**Behaviour / design**
- **Bespoke project switcher:** replace the native `<select>` with a styled
  dropdown — a button showing the current project (color dot + name + chevron)
  that opens a panel listing projects (each with its dot) and a **+ New project**
  action at the bottom. Wider, clearer, on-theme.
- **Consolidated user menu:** replace the cramped identity text + separate
  sign-out with a single **user menu** on the right: a **colored avatar**
  (initials in the user's color) + name + chevron. Opening it shows the user's
  name + kind badge + tenant, a **"Your color"** swatch picker (Feature 1), a
  divider, and **Sign out**. This declutters the bar and folds the color picker in
  naturally.
- More horizontal breathing room; works down to a narrow phone (avatar-only
  summary on small screens). Built with styled `<details>` popovers — no new deps.

---

## Sequencing

1. Plan (this doc).
2. Feature 1 backend (migration → shared → API → openapi) — verify with tests.
3. Feature 1 frontend (card coloring, remove picker, `patchMe`).
4. Feature 2 (auto-refresh + persistence).
5. Feature 3 (navbar) — also hosts Feature 1's color picker.
6. Verify (`typecheck`/`lint`/`test`/`build`) → **migrate prod D1** → deploy
   **API + web** → verify live → release notes.

## Risk / rollback

- **Migration** is purely additive (one nullable column + backfill) → safe; a
  redeploy of the previous Worker + Pages build rolls back behaviour, and the
  extra column is inert if unused.
- **Contract:** `PATCH /api/v1/me` is additive; removing card `color` from request
  bodies is backward-tolerant (the field is simply ignored/absent — no client
  breaks since our own web client is updated in lockstep, and `CardDto.color` is
  still returned).
- **Auto-refresh** guarded against drag and hidden-tab churn; worst case it
  re-fetches a small board every 20s.
