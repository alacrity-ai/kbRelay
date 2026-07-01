# kbRelay — v0.5.0 Release Notes

**Date:** 2026-07-01
**Type:** UX release (web-only)
**Live:** https://kbrelay.lalalimited.com

Two UI/UX changes. No API, schema, or migration change.

## 1. Themed dialogs (no more browser prompt/confirm/alert)
- Replaced the native `window.prompt` / `window.confirm` / `window.alert` (used
  for add/rename/delete column and new project) with a **themed, promise-based
  dialog service** — `DialogProvider` + `useDialog()` exposing `confirm`,
  `prompt`, and `alert`.
- Keyboard- and a11y-friendly: autofocus, `Enter` submits, `Esc`/backdrop cancels,
  `danger` variant for destructive confirms (red), disabled primary on empty
  prompts. Matches the app's dark theme; no OS chrome.

## 2. Project settings modal + column reordering
- A **gear** next to the project switcher opens a **tabbed project-settings
  modal**. Tabbed for future growth; today it has the **Columns** tab.
- **Columns tab** lets you **set lane order** with ↑/↓ controls (persists the
  moved column's fractional `position` — the same rank model cards use, reusing
  `PATCH /columns/:id`). It also hosts **+ Add column**.
- **Removed the far-right "+ Add column" button** from the board (it cluttered the
  layout); adding columns now lives in the Columns tab. Per-column rename/delete
  stay on the column headers.
- Board reflects settings changes immediately (a `reloadNonce` prop triggers a
  board reload after a change).

## Files
- New: `components/Dialog.tsx`, `components/ProjectSettings.tsx`.
- Changed: `app/App.tsx` (wrap in `DialogProvider`), `components/Board.tsx`
  (dialogs; `reloadNonce`; removed add-column button/handler),
  `pages/BoardApp.tsx` (gear + settings modal + nonce; prompt dialog),
  `styles.css`.

## Verification
- `typecheck` ✓ · `lint` ✓ · `build` ✓.
- API smoke: a `position` PATCH reorders lanes (`Done` → front) as expected.
- **Deploy:** `make deploy-web-prod` (Pages only). Live bundle
  `index-DDUFEA03.js` / `index-BeYGrLZR.css` (verified cache-busted on the custom
  domain); API health ok.
- **Rollback:** redeploy the previous Pages build.

## Not in scope
Drag-to-reorder columns (↑/↓ is enough for now), more settings tabs, toast
system, any API/schema change.
