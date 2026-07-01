# kbRelay — v0.1.0 Release Notes

**Date:** 2026-06-30
**Type:** Web UX polish release (frontend-only)
**Live:** https://kbrelay.lalalimited.com
**Scope:** `apps/web` only — **no** API, schema, migration, or shared-package changes.

---

## Summary

v0.0.0 shipped a working MVP (API, board, multi-tenancy). v0.1.0 makes the web
board feel like a real product and — critically — makes it usable one-handed on a
vertical phone, which is the primary way agentic work gets driven here. It also
fixes a P0 crash where dragging a card between columns blanked the page.

## What changed

### 1. Design-system refresh (snappier, cleaner, more professional)
- Token-driven CSS: spacing/radius/elevation/motion scales, richer dark palette.
- Buttons, inputs, selects, cards, columns, and the top bar now have consistent
  hover / active / `:focus-visible` states and fast (~120–180ms) transitions.
- **Custom themed scrollbars** in every scroll region (board, columns, modal) —
  WebKit + Firefox — replacing the clashing browser-default scrollbars.
- Real loading spinner and friendlier empty states; brand mark; sticky, blurred
  top bar. `prefers-reduced-motion` respected.

### 2. Card viewing: read-first, edit-on-purpose
- Opening an existing card now shows a **read-only View** (big title, column +
  assignee pills, description / acceptance-criteria blocks, provenance with
  timestamps). No more landing straight in an edit form.
- Editing is an explicit action — a **pencil / Edit** button. Saving an existing
  card returns to View; **New card** opens the form directly.
- The modal is much larger (`min(920px, 94vw)`, up to `88dvh`) with themed
  scrolling, and becomes a **full-height bottom sheet on mobile**.
- **Quick "Move to column"** control in View — advance a card without dragging
  (the core mobile workflow).

### 3. Mobile-friendly (vertical phone)
- Top bar collapses: brand + project stay; identity / new-project / sign-out move
  into an overflow (⋯) menu.
- Board becomes **scroll-snap columns** at ~86vw — one clean, readable column at a
  time, swipe to move between them.
- `100dvh` heights + `env(safe-area-inset-*)` so nothing is clipped by mobile
  browser chrome or the notch (`viewport-fit=cover`).
- Larger tap targets (≥40–44px) on cards, icon buttons, and controls.

### 4. P0 fix — cross-column drag no longer crashes
- **Root cause:** `onDragOver` relocated the active card's id into another
  column's list mid-drag; because React keys are sibling-scoped, the card node
  unmounted/remounted under a new parent, dnd-kit lost the tracked node, and drop
  threw during render — with no error boundary, the whole app blanked. Cards also
  lacked `touch-action: none`, so touch drags were scroll-hijacked.
- **Fix:** render the dragged card in a **`DragOverlay`** (portal clone, never
  unmounts mid-drag); `touch-action: none` on cards; a **TouchSensor** with a
  press-hold activation (so a swipe still scrolls); hardened move math (no
  throwing non-null assertions); and an app-wide **ErrorBoundary** guardrail.

## Deploy

- `make deploy-web-prod` — Pages project `kbrelay`, branch `main`.
- No API deploy, no D1 migration. Multi-tenancy / API behavior unchanged.
- Verified: `kbrelay.lalalimited.com` serves the new bundle
  (`index-Cc0ZtPMo.js` / `index-DEMKfvPv.css`); `/api/health` → `{ok:true}`.
- **Rollback:** redeploy the previous Pages build (no state/schema change).

## Verification done pre-deploy
- `make typecheck` ✓ · `make lint` ✓ · `vite build` ✓
- Owner (Leif) to evaluate the live UX on desktop + phone.

## Not in this release (still deferred)
Comments/attachments/checklists/activity feed, real-time push, human login/RBAC,
light theme, any API/schema change. See `docs/v0.0.0/RELEASE_NOTES.md`.
