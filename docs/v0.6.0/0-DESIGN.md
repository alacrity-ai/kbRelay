# kbRelay — v0.6.0 Design: board filters

**Date:** 2026-07-01
**Status:** design + implementation plan
**Scope:** `apps/web` only. **No** API/schema/migration change (filtering is
client-side over the already-loaded cards).
**Live:** https://kbrelay.lalalimited.com

## 1. Problem / ask

There's no way to focus the board. We want basic filters:
- A **filter button** in the top bar, to the right of the gear.
- It opens a **modal** where you can:
  - view only **My tickets**, or the tickets of **specific user(s)** (multi-select
    assignees), and
  - enter **keywords** in a text field that filters by **ticket title** (show only
    cards whose title contains the text).
- When the modal closes with filters set, it must be **evident filters are on** —
  the button is **lit/colored**.
- The modal has a **close button that applies** the filters and a **Clear** button
  that clears them.

## 2. Model

Filtering is purely a **display filter** over cards the board already has (the API
loads all project cards), so no new endpoint. A card is shown iff it passes:

```ts
interface BoardFilter { assignees: string[]; query: string }

// assignee facet: empty = all; otherwise the card's assignee must be selected
// title facet: empty = all; otherwise card.title (lowercased) includes query
```

- **My tickets** = a shortcut that sets `assignees = [me]`.
- **Active** when `assignees.length > 0 || query.trim() !== ''`.

Applying the filter only changes what each column *renders*; `items`/`cardsById`
stay complete, so drag math (which reads the full lists) is unaffected. Reordering
while filtered still computes positions from real neighbors.

## 3. UI

- **Top bar:** a funnel **filter button** immediately right of the gear (only when a
  project is selected). When filters are active it's **accent-colored** with a
  small **count badge** (number of selected assignees + 1 if a title query is set).
- **Filter modal** (themed, like the settings modal):
  - **Assignee** section: a **"My tickets only"** shortcut + a checkbox list of the
    tenant's users (color dot, name, "(You)" on yourself, kind badge). No selection
    = all assignees. Scrolls if long.
  - **Title contains** section: a text input (Enter applies).
  - **Footer:** **Clear** (ghost, left) clears all filters and closes; **Apply**
    (primary, right) applies the current selections and closes.
  - **Any close path applies** (the ✕, backdrop, Esc, Enter, Apply) — per the ask
    that "closing applies." Only **Clear** empties them.

## 4. Files
- `components/FilterModal.tsx` (new) — the `BoardFilter` type + helpers
  (`EMPTY_FILTER`, `isFilterActive`, `filterCount`, `cardMatchesFilter`) + the modal.
- `pages/BoardApp.tsx` — filter state, the funnel button (lit + badge), render the
  modal, pass `filter` to `<Board>`.
- `components/Board.tsx` — accept a `filter` prop; apply `cardMatchesFilter` when
  building each column's rendered cards.
- `styles.css` — funnel button active state + badge; filter modal + user rows.

## 5. Non-goals
No server-side filtering, no saved/named filters, no per-column filtering, no
filtering by column/label/date. Title-only keyword match (case-insensitive
substring) as specified. Unassigned-only is out (selecting users implicitly hides
unassigned).

## 6. Verify & deploy
`typecheck`/`lint`/`build` clean; manual: My tickets, multi-user, title keyword,
button lit + badge, Apply vs Clear, on desktop and ~390px. Web-only deploy
(`make deploy-web-prod`). Rollback = redeploy previous Pages build.
