# kbRelay — v0.7.0 Release Notes

**Date:** 2026-07-01
**Type:** Feature (data-model + API + web + docs + one-time prod backfill)
**Live:** https://kbrelay.lalalimited.com

Adds **project codes** and **auto ticket keys**, and renames the card's `title`
field to **`summary`**.

## What changed

### Project codes + ticket keys
- Every project has a short **`code`** (2–6 alphanumerics, uppercased, unique per
  tenant), e.g. `OBL`. Entered in a **new two-field New Project modal** (name +
  code, with a live "first ticket: OBL-1" preview).
- Every card gets an auto-assigned **`key`** — `CODE-N` (`OBL-1`, `OBL-2`, …),
  **sequential per project and never reused** (a project counter, monotonic even
  across deletes). The key is **derived** (`code` + `seq`), not editable.
- The old descriptive `title` is now **`summary`** (that's how it was used
  anyway). Board cards show the **key** (small, top-left) above the **summary**;
  the card modal shows the key as an eyebrow, "Summary" as the edit field.
- **Filter** keyword search now matches **summary** (and the key — typing `OBL-3`
  finds it). The API `?q=` list filter matches summary.
- Project switcher shows the code as a small chip.

### API contract
- **ProjectDto** `+ code`; **createProjectInput** requires `code` (409 on
  duplicate); **patchProjectInput** allows `code`.
- **CardDto**: `title` → `summary`; `+ seq`, `+ key`. **create/patch card inputs**:
  `title` → `summary` (key/seq are never sent).
- `openapi.json` schemas + create-project body updated; router↔spec parity intact.

## Migration (one-time, applied to prod)
- `0005_ticket_keys.sql` — schema: add `projects.code` + `card_seq`, rename
  `cards.title`→`summary`, add `cards.seq`, unique `(tenant_id, code)` index.
- `0006_backfill_ticket_keys.sql` — data: assign codes to the three live projects
  and number existing cards by creation order; set each counter to its card count.
- **Backfill result (verified on prod):** `OBL` (Orderbase - Launch, OBL-1..20 →
  now continuing), `BML` (buildmylease.com, BML-1..11), `BMS` (buildmylease.com
  Support, 0). Seq contiguous per project; **existing summaries untouched** (their
  embedded RDRBS-/AG-/HU- prefixes remain as history, independent of the new key).

## Deploy & verification
- `typecheck` ✓ · `lint` ✓ · `test` (34 unit tests) ✓ · `build` ✓.
- Local backend smoke: sequential keys, **no reuse after delete** (OBL-4 after
  deleting OBL-3), key stable on summary edit, `edited` event records `summary`,
  `?q=` matches summary.
- Order: **migrate prod (0005+0006) → deploy Worker → deploy Pages** (so the new
  schema and the code that reads `summary` land together).
- Live checks: `openapi.json` documents `code`/`summary`/`key`/`seq`; all projects
  have codes; cards return keys; `BML-1` = "AG-1 · Ship the measurement spine".
  Worker `cf9a90a9…`; web bundle `index-BrYwNwN9.js`.
- **Rollback:** redeploy prior Worker/Pages; would also need `summary`→`title`
  back — so we roll forward. Backfill is safe to re-run (`seq WHERE seq IS NULL`,
  codes by explicit id).

## Not in scope
Key renaming, moving a card between projects, code-edit UI (API only for now),
multiple codes per project.
