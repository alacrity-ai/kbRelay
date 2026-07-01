# kbRelay — v0.6.0 Release Notes

**Date:** 2026-07-01
**Type:** Feature (web-only)
**Live:** https://kbrelay.lalalimited.com

## Board filters

A **funnel filter button** in the top bar (right of the gear) opens a filter
modal:

- **Assignee** — a **"My tickets only"** shortcut plus a checkbox list of the
  tenant's users (color dot, name, "(You)", kind badge). No one selected = show
  all assignees; select one or many to show only their cards.
- **Title contains** — a keyword text field that shows only cards whose **title**
  contains the text (case-insensitive substring).
- **Footer:** **Apply** commits the selections and closes; **Clear** removes all
  filters and closes. Any close path (✕, backdrop, Esc, Enter) applies — per the
  ask that "closing applies."

When filters are active, the button is **lit (accent-colored) with a count badge**
(selected assignees + 1 if a title query is set), so it's obvious the board is
filtered.

Filtering is **client-side** over the cards already loaded — no API/schema change.
It only changes what each column renders; the full card data stays intact, so
drag-and-drop and positions are unaffected. Filters persist across the 20s
auto-refresh and project switches until cleared.

## Files
- New: `components/FilterModal.tsx` (the `BoardFilter` type + `EMPTY_FILTER`,
  `isFilterActive`, `filterCount`, `cardMatchesFilter`, and the modal).
- Changed: `pages/BoardApp.tsx` (funnel button + state + modal), `components/
  Board.tsx` (`filter` prop applied to rendered cards), `styles.css`.

## Verification
- `typecheck` ✓ · `lint` ✓ · `build` ✓.
- **Deploy:** `make deploy-web-prod` (Pages only). Live bundle
  `index-kzUnRRF-.js` / `index-Dn3ZrCqV.css` (verified cache-busted); API health
  ok.
- **Rollback:** redeploy the previous Pages build.

## Not in scope
Server-side filtering, saved/named filters, per-column filtering, filtering by
column/label/date, unassigned-only. Title-only keyword match as specified.
