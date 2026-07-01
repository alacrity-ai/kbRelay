# kbRelay — Design Improvements Plan (v0.1.0)

**Date:** 2026-06-30
**Status:** design (v0.1.0, UX polish release)
**Companion to:** `1-IMPROVEMENTS_PLAN_IMPLEMENTATION.md`
**Predecessor:** `docs/v0.0.0/` (working MVP: API, web board, multi-tenancy all shipped)

---

## 1. Why this release

v0.0.0 proved the model: humans and agents relay work through one API-first board, and it all works. But the **web surface is bare-bones** and, more importantly, **painful to actually use** — especially on a phone, which is how Leif drives most agentic work.

This release is **web-only**. It touches **no API, no schema, no data model** — every change lives in `apps/web`. The goal is to make the board feel like a real, professional product and to make it genuinely usable one-handed on a vertical phone.

### The three problems this must solve (from the owner)

1. **The UI is bare-bones.** The CSS is minimal; it doesn't feel snappy, clean, or professional. It should feel like a real app.
2. **Viewing a card feels bad.**
   - Scrollbars are the browser default and clash with the dark theme.
   - The modal is tiny relative to the screen — hard to read and work in.
   - Opening a card drops you straight into an **edit form**. That's annoying (and dangerous on mobile) when you only want to *read* a card. Editing should be an explicit, deliberate action (a pencil / "Edit" button).
3. **It's not mobile-friendly.** Held vertically on a phone, the board is hard to read and operate. This is the priority use case: open the app, read cards clearly, move work along — from a phone.

### Plus one P0 bug found during review

4. **Cross-column drag crashes the app.** Dragging a card from one column to another glitches (the source column scroll-hijacks the gesture) and, on drop, the page goes blank. Root cause below (§5). It must be fixed here.

### Non-goals (explicitly out of scope for v0.1.0)

- No new API endpoints, no schema/migration changes, no new card fields.
- No comments/attachments/checklists/activity feed (still deferred — see v0.0.0 release notes).
- No real-time/websockets. The board still refetches.
- No auth/login changes (token gate stays).
- No light theme. We refine the existing dark theme rather than add theming.

---

## 2. Design principles for this pass

- **Refine, don't reinvent.** The dark slate/blue palette is fine and on-brand. We tighten it into a real design system (consistent spacing, radius, shadow, motion) rather than restyle from scratch.
- **Read-first, edit-on-purpose.** Opening a card is a safe, read-only act. Mutation requires an explicit gesture.
- **Mobile is a first-class layout, not a squeeze.** Design the vertical-phone experience deliberately; the desktop layout is the enhancement.
- **Snappy = motion + feedback.** Every interactive element has a hover/active/focus state and a short transition. Nothing should feel dead.
- **Touch targets ≥ 44px.** Everything tappable is thumb-sized on mobile.
- **Accessibility for free.** Real `:focus-visible` rings, adequate contrast, `prefers-reduced-motion` respected.

---

## 3. Improvement areas

### 3.1 Global design system (Problem 1)

- **Design tokens** expanded: a spacing scale, a radius scale, an elevation/shadow scale, a motion scale (duration + easing), and a slightly richer color set (hover tints, ring color, subtle inner borders). Keep CSS-variable-driven — no framework, no build change.
- **Typography:** tuned font stack, a small type scale (labels, body, titles), consistent line-heights, and better letter-spacing on uppercase micro-labels.
- **Buttons:** clear primary / secondary / ghost / danger variants with hover, active (press), disabled, and focus-visible states, plus a consistent icon-button size for square controls.
- **Inputs/selects/textareas:** consistent height, focus ring, and a focused border-accent so the active field is obvious.
- **Custom themed scrollbars** everywhere content scrolls (board, columns, modal): thin, theme-colored, hover-brightening — WebKit (`::-webkit-scrollbar`) + Firefox (`scrollbar-color`/`scrollbar-width`). This directly kills the "browser default scrollbar" complaint.
- **Micro-interactions:** cards lift slightly on hover; the drop-target column highlights; buttons depress on click. All transitions ~120–180ms, disabled under `prefers-reduced-motion`.
- **Sticky, polished top bar** with a proper brand mark and clear separation from the board.
- **Better states:** a real loading state (spinner, not bare text) and friendlier empty states for "no projects" / empty columns.

### 3.2 Card viewing & the modal (Problem 2)

- **Two explicit modes in the card modal:**
  - **View mode (default when opening an existing card):** read-only, richly laid out — big title, a status/column pill, assignee, color accent, description and acceptance criteria rendered as readable text blocks (whitespace preserved), and provenance (created/updated by, with human/agent badge) + timestamps. Primary actions: **Edit** (pencil) and a quick **Move** control; secondary: Delete. No form fields, no accidental edits.
  - **Edit mode:** the current form. Reached by clicking **Edit** on an existing card, or immediately for **New card** (creating is inherently an edit). Save returns to View mode (for an existing card) rather than closing, so you can confirm the result; Cancel reverts to View without saving.
- **Bigger modal.** On desktop, a wider, taller dialog (roughly `min(920px, 92vw)` wide, up to `88vh` tall) so there's real room to read and write. Content scrolls inside with themed scrollbars; header/footer stay put.
- **Mobile modal = full-height sheet.** On a phone the modal becomes a near-full-screen sheet (slides up), with a sticky header (title + close) and a sticky action bar at the bottom within thumb reach, respecting safe-area insets.
- **Quick move without drag.** Because dragging is awkward on a phone, View mode includes a one-tap **Move to column** control (a segmented/pill selector or select), giving a non-drag way to advance a card — the core mobile workflow.

### 3.3 Mobile responsiveness (Problem 3)

- **Responsive top bar.** On narrow screens it collapses: brand + project selector stay visible; the identity/sign-out and "new project" collapse into an overflow menu so nothing overflows or wraps badly.
- **Board layout for vertical phones.** Columns become **viewport-width and horizontally scroll-snap** (one column fills ~85–90vw and snaps into place), so a phone shows one clean, readable column at a time and you swipe between them. A subtle column indicator shows position (e.g. "In Progress · 2/4"). On desktop, the multi-column horizontal board is unchanged (just polished).
- **Real viewport height.** Use `100dvh` (dynamic viewport height) instead of `100vh` so the board isn't cut off by mobile browser chrome, and honor `env(safe-area-inset-*)` for notches/home indicators (`viewport-fit=cover`).
- **Bigger touch targets & spacing.** Cards, buttons, the add-card control, and column headers get larger tap areas and padding on small screens.
- **Touch drag that works** (see §5): dragging is enabled on touch with a short press-and-hold activation so vertical scrolling still works normally, and cards declare `touch-action: none` so the gesture isn't scroll-hijacked. The tap-to-open and quick-move controls mean drag is never the *only* way to move a card on mobile.

### 3.4 The drag crash (Problem 4 / P0)

Covered as its own implementation phase — see §5.

---

## 4. What "done" looks like (acceptance criteria)

- **Feel:** buttons, cards, inputs, and columns all have visible hover/active/focus states and smooth (but fast) transitions; scrollbars match the theme in every scrolling region; loading and empty states look intentional.
- **Card viewing:** opening an existing card shows a **read-only** view that uses a large share of the screen; you must click **Edit** to change anything; New card opens directly in the form. Save on an existing card returns to the view.
- **Mobile (vertical phone, ~390×844):** the top bar fits without ugly wrapping; the board shows one readable column at a time with swipe/snap between columns; the card modal is a full-height, thumb-reachable sheet; nothing is clipped by browser chrome or the notch; a card can be moved between columns **without** drag (via the quick-move control).
- **Drag:** a card can be dragged from any column to any other column, on desktop **and** touch, and dropped — with **no blank screen, no crash, no scroll-hijack**. A thrown render error shows a recoverable message instead of a blank page.
- **No regressions:** `make typecheck && make lint && make build` pass; existing API/board behavior and multi-tenancy are unchanged; deployed to prod.

---

## 5. The drag crash — root cause & fix strategy

**Symptoms (reported):** dragging a card between columns "glitches," the source column tries to scroll during the gesture, and on release the page goes blank.

**Root cause.** In `Board.tsx`, `onDragOver` mutates the `items` map to move the active card's id out of the source column's list and into the target column's list **mid-drag**. Each column renders its own `SortableContext`, and the card node is keyed within that column. React keys are scoped to siblings, so relocating the id to a different column's list **unmounts and remounts the card DOM node** under a new parent. The active drag node that `@dnd-kit` is tracking disappears out from under it; on `onDragEnd` the neighbor/position lookups (several non-null `!` assertions like `cardsById[prevId]!.position`) and dnd-kit's own measuring operate on a node/id that no longer maps cleanly, throwing during render. Because the app has **no error boundary**, a render throw unmounts the entire tree → blank page. Separately, the cards don't set `touch-action: none`, so on touch the browser claims the gesture for scrolling ("tries to scroll within the column").

**Fix (canonical dnd-kit pattern):**

1. **`DragOverlay`.** Render the actively-dragged card into a `DragOverlay` (a portalled clone that follows the pointer). The real card can then move between containers during `onDragOver` without the *dragged* visual unmounting — the overlay is a stable, separately-mounted node. This is the standard cure for cross-container "disappears/crashes on drop."
2. **`touch-action: none`** on draggable cards so touch drags aren't scroll-hijacked, plus a **touch sensor with a short activation delay + tolerance** so a plain vertical swipe still scrolls the board/column and only a deliberate press-hold starts a drag.
3. **Harden the handlers.** Remove the fragile non-null assertions in the move math; guard every lookup and no-op safely when an id isn't found, so a stray event can never throw.
4. **`ErrorBoundary` guardrail.** Wrap the app so any future render throw shows a "something went wrong — reload" panel instead of a blank screen. Defense in depth, not the primary fix.

The result: reliable cross-column dragging on desktop and touch, and — combined with the §3.2 quick-move control — a board you can actually operate from a phone.

---

## 6. Rollout

Single web deploy to Pages prod (`make deploy-web-prod`), no API deploy, no migration. Because there's no schema change, rollback is a redeploy of the previous Pages build. Owner (Leif) evaluates on desktop + phone once landed.
