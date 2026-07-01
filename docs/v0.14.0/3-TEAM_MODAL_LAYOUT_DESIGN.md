# KBR-4 — Team & access modal layout fix

## Problem

The **Team & access** modal (`TenantSettings.tsx`, admin-only) works but looks
broken at every size:

- **Desktop:** the modal is far too narrow; each member row crams avatar +
  name/email + role `<select>` + "Projects" + "Remove" into one flex row, so
  the dropdown collides with the text.
- **Mobile:** width is fine, but the same single-row cramming overflows.

## Root cause

- `.dialog-card { width: min(440px, 94vw) }`. The `.wide` modifier only sets
  `max-width: 620px` — it never raises `width`, so the modal stays **440px** on
  desktop.
- `.member-row` is one `display:flex` row (identity + select + two buttons) with
  no wrap strategy, so it packs tight and breaks below ~520px.

## Fix (CSS + light markup)

### Width

```css
.dialog-card.wide { width: min(680px, 94vw); max-width: 680px; }
```

### Member / agent row structure

Split each row into an **identity block** (`flex: 1`, min-width: 0) and an
**actions cluster** (role select + buttons), wrapped in a container that wraps
gracefully:

```
.member-row        → display:flex; align-items:center; gap; flex-wrap:wrap
  .member-main     → flex: 1 1 200px; min-width:0   (avatar+name+email)
  .member-actions  → display:flex; gap; align-items:center; margin-left:auto
                     (role-select + Projects + Remove)
```

On desktop the actions sit right-aligned on the same line; when space is tight
they wrap as a unit. On mobile they stack full-width below the identity:

```css
@media (max-width: 560px) {
  .member-actions { margin-left: 0; width: 100%; }
  .member-actions .role-select { flex: 1; }         /* fill the row */
}
```

Touch targets: ensure select + buttons are ≥ the theme's tap height on mobile.

### Shared with the Agents tab

KBR-3 introduces a People/Agents tab split in this same component. The agent rows
reuse `.member-row` / `.member-main` / `.member-actions`, so this CSS covers both
tabs. The project-access checklist (`.member-projects` / `.project-checks`) is
unchanged but benefits from the wider modal.

## Testing

- Resize from ~360px to ~900px: no overlap, no horizontal scroll, actions
  legible and tappable throughout, on both People and Agents tabs.
- Verify against the live tenant (3 people + at least one agent) in prod after
  deploy.

## Acceptance criteria

- Desktop: comfortably wide; clean actions cluster; no overlap.
- Mobile (down to ~360px): no cramming; actions stack legibly; tappable.
- Fluid across the range for both tabs.

## Out of scope

Redesigning the invite row or the color/theming of the modal; those already work.
