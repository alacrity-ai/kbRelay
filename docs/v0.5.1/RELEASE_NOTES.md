# kbRelay — v0.5.1 Release Notes

**Date:** 2026-07-01
**Type:** Bug fix (web-only; mobile touch)
**Live:** https://kbrelay.lalalimited.com

## Fix: can't scroll a column on mobile (drag hijacked the touch)

**Symptom:** on a phone, dragging a finger down a column instantly grabbed a card
instead of scrolling; the only way to scroll was the too-thin scrollbar.

**Root cause (two compounding bugs):**
1. A `PointerSensor` (`distance: 5`) governed the drag. Pointer events fire for
   touch too, so a drag started after 5px of finger movement — before the
   `TouchSensor`'s hold delay could apply. The long-press was dead code on touch.
2. Cards were styled `touch-action: none`, which tells the browser to do no
   scrolling for touches starting on a card — so even when no drag started, the
   column wouldn't scroll.

**Fix — long-press to drag, scroll otherwise:**
- Swapped `PointerSensor` → **`MouseSensor`** (`distance: 5`) so it governs mouse
  only; touch is now handled solely by the TouchSensor. Desktop drag unchanged.
- **`TouchSensor` long-press:** `delay: 500ms, tolerance: 5px`. Hold ~0.5s to
  drag; move before that and the browser scrolls instead. (Tunable toward 1s.)
- **`touch-action: manipulation`** on cards (was `none`) so the browser can pan
  (scroll the column / swipe between columns) from a card until the long-press
  fires.

Net: swipe to scroll/change columns; press-and-hold a card to drag it. The narrow
scrollbar no longer matters because normal touch-scrolling works everywhere.

## Files
- `components/Board.tsx` (sensors), `styles.css` (`.card` touch-action).

## Verification
- `typecheck` ✓ · `lint` ✓ · `build` ✓.
- **Deploy:** `make deploy-web-prod` (Pages only, no API/schema change). Live
  bundle `index-DmLuUbHX.js` / `index-Bz9Faufe.css` (verified cache-busted); API
  health ok.
- **Rollback:** redeploy the previous Pages build.
