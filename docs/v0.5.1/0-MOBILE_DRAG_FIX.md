# kbRelay — v0.5.1: mobile can't scroll a column (drag hijacks the touch)

**Date:** 2026-07-01
**Type:** bug fix (web-only; touch UX)
**Live:** https://kbrelay.lalalimited.com

## 1. Problem statement

On a phone, you can't scroll down through a long column of cards. Two things go
wrong:

- **A finger-drag instantly picks up a card** instead of scrolling the column. So
  the only way to scroll is the thin custom scrollbar, which is too narrow to grab
  reliably.
- The desired behavior: **let me scroll with my finger first; only start a
  drag-and-drop if I press-and-hold on a card (~long-press).**

## 2. Root cause

Two compounding bugs in the drag setup:

1. **`PointerSensor` hijacks touch.** The board registers a `PointerSensor` with
   `activationConstraint: { distance: 5 }`. Pointer events fire for *touch* too, so
   on a phone the PointerSensor starts a drag after just **5px** of finger
   movement — **before** the `TouchSensor`'s hold delay ever gets a chance. The
   TouchSensor's delay is effectively dead code on touch; the PointerSensor wins,
   which is the "instantly picks up a card" behavior.
2. **`touch-action: none` on cards blocks native scrolling.** Cards are styled
   `touch-action: none`, which tells the browser to do **no** panning/scrolling for
   a touch that starts on a card. So even when a drag *doesn't* start, the column
   still won't scroll — the browser has been told not to. Hence "can't scroll,"
   forcing the user onto the too-thin scrollbar.

Together: touch on a card either grabs it (PointerSensor @5px) or does nothing
(touch-action:none) — but never scrolls.

## 3. Solution — long-press to drag, scroll otherwise

Standard dnd-kit pattern for a scrollable touch list: **separate mouse and touch
sensors**, and let the browser scroll until a deliberate long-press.

1. **Replace `PointerSensor` with `MouseSensor`** (`distance: 5`). MouseSensor
   responds to *mouse* events only, so it no longer governs touch — desktop
   click/drag is unchanged. (Mobile browsers only emit compat mouse events after
   `touchend`, so this can't fire mid-touch.)
2. **`TouchSensor` with a real long-press:** `activationConstraint: { delay: 500,
   tolerance: 5 }`. Hold ~0.5s roughly still → drag starts. Move more than 5px
   before that → activation aborts and the browser scrolls. 500 ms is the platform
   long-press convention (easily tuned toward 1 s if we want it more deliberate).
3. **`touch-action: manipulation` on cards** (was `none`). Lets the browser pan in
   both axes (vertical column scroll *and* horizontal board/column swipe) when a
   touch starts on a card; once the long-press fires, dnd-kit takes over and
   `preventDefault`s the scroll. This is what makes finger-scrolling work again.

Net: a finger swipe scrolls the column (or swipes between columns); a
press-and-hold on a card picks it up to drag. Keyboard sensor unchanged. The thin
scrollbar stops mattering because normal touch-scrolling works everywhere.

## 4. Files
- `components/Board.tsx` — swap PointerSensor→MouseSensor; TouchSensor delay
  180→500, tolerance 8→5.
- `styles.css` — `.card { touch-action: manipulation }` (was `none`).

## 5. Verify & deploy
`typecheck`/`lint`/`build` clean. Manual on a phone (~390px): scroll a long column
by dragging anywhere (including on cards); swipe between columns; press-and-hold a
card ~0.5s to drag it within/between columns and drop; desktop mouse drag
unaffected. Web-only deploy (`make deploy-web-prod`). Rollback = redeploy previous
Pages build.
