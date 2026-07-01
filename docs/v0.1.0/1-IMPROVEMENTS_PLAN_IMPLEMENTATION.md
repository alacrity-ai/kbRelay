# kbRelay — v0.1.0 Implementation Plan

**Date:** 2026-06-30
**Companion to:** `0-DESIGN_IMPROVEMENTS_PLAN.md`
**Scope:** `apps/web` only. No API, no schema, no migration, no shared-package changes.
**Goal:** ship the UX polish, the card view/edit split, mobile support, and the drag-crash fix — phased, each phase independently reviewable, no regressions.

**Global rules**
- Node 24 (`. ~/.nvm/nvm.sh && nvm use 24`).
- CSS stays variable-driven in `apps/web/src/styles.css` — no CSS framework, no new build tooling.
- Only new runtime dependency allowed: none required (dnd-kit already provides `DragOverlay`).
- After every phase: `make typecheck && make lint` clean; `make build` succeeds.
- Verify locally (`make dev`) on a desktop width **and** a ~390px mobile width (devtools device emulation) before deploy.

---

## Phase 1 — Global design-system CSS refresh

**Objective:** make the whole app feel snappy, clean, and professional without touching component logic.

**Files**
- `apps/web/src/styles.css` — the bulk of the work.
- `apps/web/index.html` — `viewport-fit=cover` on the viewport meta; optional `theme-color`.

**Work**
- Expand `:root` tokens: spacing scale (`--space-1..6`), radius scale (`--r-sm/md/lg/xl`), elevation (`--shadow-1/2/3`), motion (`--dur`, `--ease`), plus color additions (`--surface-3`/hover, `--ring`, `--accent-hover`, `--text-dim`).
- Typography: refined font stack, base size/line-height, `.type-label` uppercase micro-label treatment.
- Buttons: variants (`.primary/.ghost/.danger` + default), hover/active(`:active` translateY)/disabled/`:focus-visible` ring, and a square `.icon-btn` (≥40px, ≥44px on touch).
- Inputs/select/textarea: consistent sizing, focus ring + accent border.
- **Custom scrollbars:** a reusable rule applied to `html`, `.board`, `.column-body`, `.modal` (and a `.scroll` utility) — `::-webkit-scrollbar*` thin themed track/thumb with hover state; `scrollbar-width: thin` + `scrollbar-color` for Firefox.
- Card/column/topbar polish: hover elevation on `.card`, refined borders, sticky topbar with brand mark, count badge styling.
- `@media (prefers-reduced-motion: reduce)` disables transitions.

**Acceptance**
- Buttons/inputs/cards show hover/active/focus states; transitions feel fast (~120–180ms).
- Every scroll region shows a dark themed scrollbar (Chrome + Firefox).
- No component/TS changes required; typecheck/lint/build clean.

---

## Phase 2 — Fix the cross-column drag crash + enable touch drag

**Objective:** dragging a card between columns works reliably on desktop and touch, never blanks the page.

**Files**
- `apps/web/src/components/Board.tsx` — sensors, `DragOverlay`, hardened handlers.
- `apps/web/src/components/CardItem.tsx` — `touch-action: none`; a presentational variant for the overlay.
- `apps/web/src/components/ErrorBoundary.tsx` — **new**, small class component.
- `apps/web/src/app/App.tsx` — wrap tree in `<ErrorBoundary>`.
- `apps/web/src/styles.css` — `.card { touch-action: none }`, overlay/drag styles.

**Work**
1. **DragOverlay:** track `activeId` in state on `onDragStart`; render `<DragOverlay>` containing a static `CardItem` clone for that card; clear on end/cancel. This keeps the dragged visual mounted independent of container membership.
2. **Sensors:** keep `PointerSensor` (distance 5) for mouse; add `TouchSensor` with `activationConstraint: { delay: 180, tolerance: 8 }` so a swipe scrolls but a press-hold drags. Add `KeyboardSensor` for a11y (nice-to-have).
3. **`touch-action: none`** on the draggable card element so touch drags aren't scroll-hijacked.
4. **Harden `onDragEnd`/`onDragOver`:** replace non-null `!` assertions with guarded lookups; if any id isn't found, no-op (and reconcile via `load()` on API failure as today). Keep the optimistic cross-column move in `onDragOver`, now safe because the overlay — not the real node — is what's tracked.
5. **`onDragCancel`:** reset `activeId` and reconcile.
6. **ErrorBoundary:** class component with `getDerivedStateFromError`; renders a themed "Something went wrong — Reload" panel. Wrap `<App>`'s content.

**Acceptance**
- Drag a card between all columns on desktop → drops correctly, no blank screen.
- On touch emulation: vertical swipe scrolls; press-hold drags a card across columns and drops.
- Forcing a render throw shows the ErrorBoundary panel, not a blank page.

---

## Phase 3 — Card modal: view/edit split + larger responsive modal

**Objective:** opening a card is read-only by default; editing is explicit; the modal uses real screen space and is a full-height sheet on mobile.

**Files**
- `apps/web/src/components/CardModal.tsx` — split into view + edit.
- `apps/web/src/components/Board.tsx` — modal state gains a `view | edit` sub-mode; open-existing defaults to `view`, create opens `edit`.
- `apps/web/src/styles.css` — larger modal, mobile bottom-sheet, view-mode layout, themed modal scrollbar.

**Work**
- **View mode (default for existing cards):** header (color accent + title + column pill + close), body (assignee, description block, acceptance-criteria block with `white-space: pre-wrap`, provenance + timestamps), footer actions: **Edit** (pencil, primary), **Move to column** quick control, **Delete** (danger, secondary). No inputs.
- **Edit mode:** the existing form; entered via **Edit** or for a new card. **Save** on an existing card → back to View (re-fetch/refresh the card); **Cancel** → back to View (new card: Cancel closes). Keep validation + busy/error handling.
- **Quick move:** in View mode, a pill/segmented control (or select) of columns that PATCHes `columnId` immediately and refreshes — the non-drag move path for mobile.
- **Layout:** desktop `min(920px, 92vw)` × up to `88vh`, sticky header/footer, scrolling body with themed scrollbar. Mobile (`max-width: 640px`): full-width, `100dvh`-ish sheet, slide-up, sticky bottom action bar within thumb reach, safe-area padding.

**Acceptance**
- Clicking a card opens read-only view; no way to mutate without clicking Edit.
- New card opens the form directly; Save on an existing card returns to view showing saved values.
- Desktop modal is large; mobile modal is a full-height sheet with reachable actions and themed scrollbar.

---

## Phase 4 — Mobile responsiveness pass

**Objective:** a clean, operable board on a vertical phone.

**Files**
- `apps/web/src/pages/BoardApp.tsx` — responsive/collapsing top bar.
- `apps/web/src/components/Board.tsx` / `Column.tsx` — mobile board layout hooks/classes.
- `apps/web/src/styles.css` — media queries, scroll-snap, dvh, safe-area.

**Work**
- **Top bar:** below ~640px, keep brand + project select; collapse identity/sign-out/new-project into an overflow (“⋯”) menu (simple CSS/details-based popover) so nothing overflows.
- **Board:** below ~640px, columns become `width: 86vw` (min 260px), `scroll-snap-type: x mandatory` on `.board`, `scroll-snap-align: center` on columns, so one column fills the screen and swipes snap. Desktop layout unchanged.
- **Heights:** switch board/column/modal `100vh` → `100dvh`; add `env(safe-area-inset-*)` padding to topbar, board, and modal action bar; ensure `index.html` has `viewport-fit=cover`.
- **Touch targets:** bump card padding, add-card, icon buttons, and column headers to ≥44px hit areas on small screens.
- Optional: a small column position indicator.

**Acceptance**
- At ~390×844: top bar fits without ugly wrap; board shows one readable column, swipes snap between columns; nothing clipped by chrome/notch; all controls are thumb-tappable.
- Desktop board visually unchanged aside from Phase 1 polish.

---

## Phase 5 — Verify + deploy

**Objective:** ship to prod with confidence, no regressions.

**Work**
- `make typecheck && make lint && make build` all clean.
- `make dev`; manual smoke on desktop width + ~390px emulation: load board, open a card (view), edit + save, quick-move, drag across columns (mouse + touch emulation), create card, create/rename/delete column, sign out/in.
- Source CF creds (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) from the gitignored `DO_NOT_COMMIT.md`.
- **Deploy web only:** `make deploy-web-prod` (no API deploy, no migration).
- Verify `https://kbrelay.lalalimited.com` serves the new build; spot-check on a real phone.
- Write `docs/v0.1.0/RELEASE_NOTES.md`.

**Acceptance**
- Prod serves the redesigned board; all §4 acceptance criteria in the design doc hold; API/multi-tenancy unchanged.

---

## Sequencing & risk

- **Order:** 1 → 2 → 3 → 4 → 5. Phase 2 (the crash) is highest-value and independent of the visual work, but Phase 1 tokens make everything after it cleaner, so tokens land first; the crash fix is the very next thing.
- **Risk — cross-container dnd:** DragOverlay is the well-trodden fix; if optimistic `onDragOver` reordering still proves flaky, fall back to computing the move only in `onDragEnd` (drop-target based) — less mid-drag flourish, maximally robust.
- **Risk — touch drag vs scroll conflict:** tuned by the TouchSensor delay/tolerance; the quick-move control guarantees mobility even if a user never discovers drag.
- **Rollback:** redeploy previous Pages build (no schema/state change).
