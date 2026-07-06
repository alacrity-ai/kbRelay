# v0.19.0 — Analytics (KBR-102 / KBR-103 / KBR-104)

A full-page Analytics view (topbar bar-chart button; in the mobile "…" menu)
with two scopes — **Project** (the selected board) and **Workspace** (every
project the caller can see) — over a **7/30/90-day** window (default 30).

## What it shows

- **Totals**: created, completed, active-on-board, overdue, comments.
- **Throughput**: created-vs-completed series, daily buckets (weekly at 90d),
  zero-filled so the chart reads continuously.
- **Cycle time**: avg + median + sample count.
- **Leaderboard**: per user — completions performed, cards created, comments
  posted (humans and agents both, kind-badged). **Top reviewers** beside it.
- Project scope adds the **live column distribution**; workspace scope adds a
  **per-project breakdown** (created / completed / active / avg cycle).

## Definitions (the part worth reading)

- **Completed** = a `moved` event landing a card in the column whose *current*
  role is `done` — the same join auto-archive uses. There is no completion
  timestamp column; `card_events` is the source of truth. Consequences:
  - One card counts once per window (its **latest** done-entry wins for timing
    and leaderboard attribution — reopen + re-done doesn't double-count).
  - Events survive archiving, so archive-after-done doesn't erase history.
  - Deleting a card purges its events (existing behavior), so deleted cards
    drop out of the metrics.
  - Column roles are mutable with no history: re-roling a column re-interprets
    past moves. Documented tradeoff, matches everything else role-based.
- **Cycle time** = first entry into the `in_progress`-role column (falling
  back to card creation when a card skips straight to done) → the completing
  done-entry.
- **Active** = non-archived cards not sitting in the done-role column;
  **overdue** = active with `due_at < now`.

## API

- `GET /v1/projects/:id/analytics?days=` — standard project access scope.
- `GET /v1/analytics?days=` — workspace; RBAC in-query like `/v1/search`
  (members: granted projects only; admins: whole tenant). Deliberately
  member-visible — the scoreboard belongs to the team.
- `days` ∈ {7, 30, 90}, default 30, else 400. DTOs in
  `packages/shared/src/analytics.ts`.

Implementation (`apps/api/src/db/repos/analytics.ts`): a handful of narrow,
window-bounded row-fetches aggregated in code — portable across D1/libsql,
definitions in one place, plenty fast at board scale. Migration `0024` adds
`card_events(tenant_id, created_at)` for the tenant-wide window scans.

## Web

`apps/web/src/components/Analytics.tsx` — stat cards, a hand-rolled inline SVG
dual-series bar chart, and horizontal-bar lists (user colors from the shared
palette). **Zero new dependencies.** Styles under `anx-*`; responsive ≤640px.

Tests: `apps/api/src/routes/analytics.route.test.ts` (fixture cards walked
through real column moves; totals/cycle/leaderboard/scoping/validation) and
`apps/web/src/components/Analytics.test.tsx` (render, tab + window switching,
empty/error states).
