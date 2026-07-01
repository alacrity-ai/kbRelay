# kbRelay — v0.3.0 Release Notes

**Date:** 2026-07-01
**Type:** Feature release (data-model + API + web)
**Live:** https://kbrelay.lalalimited.com

Gives every card an **append-only timeline** — the missing "log" that used to leak
into the description. Ships a D1 migration + Worker deploy alongside the Pages
deploy. See `0-PROBLEM_STATEMENT.md` (the diagnosis) and `1-IMPLEMENTATION.md`
(finalized design + evaluation).

## What changed

### The card timeline
- New `card_events` table (`0004_card_activity.sql`) — append-only, one row per
  event, `(card_id, created_at)` indexed.
- **System events**, auto-emitted from the card handlers: `created`, `moved`
  (with from/to column names), `assigned` (from/to user), `edited` (which fields).
  This is the **durable replacement for lossy `updated_by`** — the full
  who-did-what-when relay is now kept, not overwritten on each PATCH. Card mutation
  + its event(s) are written in one `batch()` so a move can't land without its log.
- **Comments** — user-authored `note` or a structured `handoff`. A handoff carries
  soft slots: `summary`, `evidence[]`, `verify[]`, `spunOff[]`.
- New endpoints:
  - `GET /api/v1/cards/:id/timeline` — system events + comments, chronological.
  - `POST /api/v1/cards/:id/comments` — `{ type?: 'note'|'handoff', body, meta? }`.
- **Web:** a **Timeline** section in the card's view mode — system events as
  compact lines, notes as bubbles, handoffs highlighted ("✅ Handoff from …") with
  their slots rendered — plus a Note/Handoff composer. Read-first posture kept
  (posting is explicit); it reloads on the v0.2.0 20s poll and after edits.

### Guidance
- `USING_KBRELAY.md` rewritten around the rule: **edit `description`/
  `acceptanceCriteria` only to change the plan; post to the timeline to report what
  happened; open a new card for discovered work** (list ids in `meta.spunOff`).
  Removed the old "put notes in the description" instruction. `CONTEXT.md` deferred
  list corrected.

## Design decisions (vs. the proposal)
- Single discriminator **`kind ∈ {system, note, handoff}`** (the sketch's
  `kind`-vs-`type` split was collapsed); `event_type` is system-only.
- **Explicit delete cascade** for `card_events` in `deleteCard` + `deleteProject`
  (the repo doesn't trust D1 FK enforcement).
- camelCase DTO fields (`spunOff`); `batch()` atomicity for mutation + events.
- Deferred as planned: full card-link graph, comment edit/delete, mentions/
  reactions/attachments, AC-as-checklist.

## Deploy & verification
- `make db-migrate-prod` (0004) → `make deploy-api-prod` → `make deploy-web-prod`.
- Worker version `d7595861…`; web bundle `index-C8nZvueh.js` / `index-egMYGx_Z.css`.
- `typecheck` ✓ · `lint` ✓ · `test` (33 unit tests, +8 new) ✓ · build ✓.
- Local Miniflare smoke: create→moved→assigned→edited system events, note +
  handoff comments, correct order/shapes, invalid type → 400, delete → events gone
  (per-actor history durable: Claude moved+assigned, Leif edited, both kept).
- **Live prod:** openapi documents both routes + `CardEvent`; a real
  create→handoff→timeline round-trip returns the `created` system event + the
  handoff; health ok.
- **Rollback:** redeploy prior Worker + Pages; the additive table is inert.
