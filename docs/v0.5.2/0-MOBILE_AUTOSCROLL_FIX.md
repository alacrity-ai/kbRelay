# kbRelay — v0.5.2: dragged card "blasts" to the last column on mobile

**Date:** 2026-07-01
**Type:** bug fix (web-only; touch UX)
**Live:** https://kbrelay.lalalimited.com
**Follows:** v0.5.1 (long-press to drag)

## 1. Problem statement

On a phone, once a card is picked up (floating on the finger), a slight sideways
move sends it flying across the board to the **final column** almost instantly —
way too fast to control.

## 2. Root cause

Two mechanisms compounding, both horizontal:

1. **dnd-kit auto-scroll is too aggressive.** When a drag nears the edge of a
   scroll container, dnd-kit auto-scrolls it. The default `acceleration` (10) and
   wide `threshold` (0.2 = the outer 20% of the viewport) mean a small sideways
   nudge on a phone — where a single column is ~86vw, so the edge is close — starts
   fast horizontal auto-scroll.
2. **`scroll-snap-type: x mandatory` amplifies it.** The mobile board snaps one
   column per swipe. During auto-scroll, every tiny scroll delta gets *snapped* to
   the next column, chaining column→column→…→last in a blink.

Together: nudge sideways → fast auto-scroll → snap yanks column by column → card
lands in the last column.

## 3. Solution — gentle, edge-only auto-scroll + no snapping mid-drag

1. **Tame auto-scroll** on the `DndContext`:
   `autoScroll={{ acceleration: 3, threshold: { x: 0.08, y: 0.2 } }}`. Much slower,
   and horizontal scroll only triggers within the outer ~8% of each edge — so a
   small sideways move no longer scrolls at all; you have to intentionally push
   toward the edge, and then it creeps rather than blasts. Vertical (within-column)
   auto-scroll stays usable.
2. **Disable scroll-snap while dragging.** Toggle a `.dragging` class on the board
   while a card is active (`.board.dragging { scroll-snap-type: none }`), so the
   snap can't yank whole columns during auto-scroll. Snap returns to normal the
   moment the drag ends.

Net: cross-column drag on mobile becomes a controllable, gradual scroll toward the
edge instead of an instant jump to the end. (The card modal's "Move to column"
quick control remains the fastest no-drag way to move a card on a phone.)

## 4. Files
- `components/Board.tsx` — `autoScroll` config; `.dragging` class on the board
  while a card is active.
- `styles.css` — `.board.dragging { scroll-snap-type: none }` (mobile).

## 5. Verify & deploy
`typecheck`/`lint`/`build` clean. Web-only deploy (`make deploy-web-prod`).
Rollback = redeploy previous Pages build.
