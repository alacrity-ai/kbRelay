# kbRelay — v0.5.0 Design: custom dialogs (no browser prompt/confirm/alert)

**Date:** 2026-07-01
**Status:** design + implementation plan
**Scope:** `apps/web` only. **No** API/schema/migration change.
**Live:** https://kbrelay.lalalimited.com

## 1. Problem

Column and project actions lean on the browser's native `window.prompt` /
`window.confirm` / `window.alert`. They're jarring — unstyled OS chrome that
ignores the app's dark theme, can't be themed, look unprofessional, and on mobile
render inconsistently. Five call sites:

- `Board.tsx` — add column (`prompt`), rename column (`prompt`), delete column
  (`confirm`), delete-failure (`alert`).
- `BoardApp.tsx` — new project (`prompt`).

## 2. Approach — a promise-based dialog service

A small **`DialogProvider`** mounted once, exposing an imperative,
promise-returning API via a `useDialog()` hook:

```ts
const dialog = useDialog();
const name = await dialog.prompt({ title: 'New column', label: 'Name' }); // string | null
const ok   = await dialog.confirm({ title: 'Delete column?', danger: true }); // boolean
await dialog.alert({ title: 'Delete failed', message });                      // void
```

Why this shape: it's a **near drop-in** for the native calls (`await
dialog.prompt(...)` replaces `window.prompt(...)`), so the Board/BoardApp logic
barely changes; one mounted component; fully themed; keyboard- and
a11y-friendly.

A single centered modal (not a popover): the actions originate from different
spots (column header menu, add-column button, top bar) and a consistent centered
dialog is clearer and simpler than anchored popovers. Reuses the existing
`.modal-header/.modal-body/.modal-footer` styling in a compact `.dialog-card`
with its own backdrop (so it's unaffected by the card modal's full-height mobile
sheet rules).

Behavior:
- **Prompt:** themed text input, autofocused, `Enter` submits, empty disables the
  primary button; returns the trimmed string or `null` on cancel.
- **Confirm:** `danger` variant renders a red primary + red accent (for deletes).
- **Alert:** single OK button (used for the delete-conflict error).
- `Esc` and backdrop click cancel; primary/OK is focused for confirm/alert.

## 3. Files
- `components/Dialog.tsx` (new) — `DialogProvider`, `useDialog`, the dialog view.
- `app/App.tsx` — wrap the tree in `<DialogProvider>` (inside `ErrorBoundary`).
- `components/Board.tsx` — swap the 4 native calls for `useDialog()`.
- `pages/BoardApp.tsx` — swap `window.prompt` for `dialog.prompt`.
- `styles.css` — `.dialog-backdrop` + `.dialog-card`.

## 4. Non-goals
No toast system, no changes to the card-delete flow (already a custom modal), no
API change. Purely swapping native dialogs for themed ones.

## 5. Addendum — project settings modal + column reordering

Added mid-version (still web-only, still no API change — reorder reuses the
existing `PATCH /columns/:id { position }`):

- **Gear** button next to the project switcher opens a **tabbed project-settings
  modal** (`ProjectSettings.tsx`). Tabbed for future growth; today it has one tab,
  **Columns**.
- **Columns tab** — lists the project's lanes in order with **↑/↓** controls to
  **set column order**. A move optimistically reorders the list and persists the
  moved column's new fractional `position` (`rankBetween`, the same rank model as
  cards) — so only one write per move. It also hosts **+ Add column** (via the new
  prompt dialog).
- **Removed the far-right "+ Add column" button** from the board (it cluttered the
  layout); adding columns now lives in the Columns tab. Per-column rename/delete
  stay on the column headers.
- The board reflects settings changes immediately: `ProjectSettings` calls
  `onChanged`, which bumps a `reloadNonce` prop on `<Board>` to trigger a reload.

## 6. Verify & deploy
`typecheck`/`lint`/`build` clean; API smoke confirmed a `position` PATCH reorders
lanes. Manual check of add/rename/delete column, new project, a forced
delete-conflict (409), and gear → Columns → reorder on desktop and ~390px.
Web-only deploy (`make deploy-web-prod`). Rollback = redeploy previous Pages
build.
