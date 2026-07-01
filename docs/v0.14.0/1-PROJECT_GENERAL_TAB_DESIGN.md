# KBR-1 — Project settings: a **General** tab (description + color)

## Summary

Give humans a UI to edit a project's **description** and **color**, and round
out the MCP write surface with `update_project`. The data layer already exists —
this is mostly a frontend tab plus one MCP tool.

## Current state

- **DB:** `projects.description` and `projects.color` columns already exist.
- **API:** `ProjectDto` returns both; `GET /projects`, `GET /projects/:id`
  include them; `PATCH /projects/:id` (`patchProjectInput`) already accepts
  `name`, `code`, `description`, `color`, `status`.
- **MCP:** `list_projects` / `get_project` already return the DTO (so
  description/color already flow to agents). There is **no** `update_project`
  tool — the surface is create + read only.
- **Web:** `ProjectSettings.tsx` has a single **Columns** tab. `NewProjectModal`
  only sets name + code. The switcher dot uses `p.color ?? var(--accent)`.

So: **no schema or route change needed.** Frontend + MCP tool + docs.

## Design

### Web — `ProjectSettings.tsx`

Add a **General** tab, made the default (first) tab; keep **Columns** as the
second. General tab fields:

- **Name** — text input, prefilled from the project. Saved via
  `PATCH /projects/:id { name }`.
- **Description** — `<textarea>`, prefilled. Saved as `description` (empty →
  `null`). Rendered elsewhere as plain text for now (no markdown surface needed
  in the modal).
- **Color** — a swatch grid + a **Default** chip that clears to `null` (theme
  accent). Reuse the existing `USER_PALETTE` from `@kbrelay/shared` for a
  consistent set (or a dedicated `PROJECT_PALETTE` — decide at build time;
  `USER_PALETTE` is fine and avoids a new export). Selecting a swatch stages it;
  **Save** persists `{ color }`.

A single **Save** button on the General tab issues one `PATCH` with the changed
fields and shows inline errors. To reflect name/color immediately in the
switcher (not just the board), `ProjectSettings` gains an `onProjectChanged`
callback that `BoardApp` wires to `loadProjects()` (re-fetch the projects list).
The existing `onChanged` (board nonce bump) stays for column edits.

`ProjectSettings` already loads `getProject(projectId)` for columns; extend it to
keep the `project` too so the General tab has its current values.

Optional nice-to-have (low cost): let `NewProjectModal` set an initial color
(swatch row) and description. Not required by the ticket; include if it doesn't
bloat the modal.

### MCP — `update_project`

Add one tool mirroring the PATCH surface:

```
update_project(projectId, name?, code?, description?, color?, status?)
  → PATCH /v1/projects/:projectId
```

- `description` / `color` are `.nullish()` (null clears).
- Enrich `get_project` / `list_projects` descriptions to note that
  `description` carries the project's purpose/context.

### API / OpenAPI

No route change. Verify the OpenAPI doc lists `description` + `color` on the
project create + patch request bodies and on the `Project` schema; add if
missing.

## Data flow

Edit in General tab → `api.patchProject(id, {name,description,color})` →
`PATCH /projects/:id` → `patchProject` repo (already coalesces undefined vs
provided) → returns updated `ProjectDto` → `onProjectChanged()` re-fetches
projects → switcher + checklists show the new color/name.

## Testing

- Shared/API: existing `patchProjectInput` tests cover validation; add a case
  that `description: null` and `color: null` round-trip (clearing).
- MCP unit: `update_project` builds `PATCH /v1/projects/:id` with the body;
  schema accepts partial input and `null` for description/color.
- Manual/prod: set a color + description on a KBR project; confirm the switcher
  dot changes and `GET /projects` + MCP `get_project` show the description.

## Acceptance criteria

- General tab edits description + color; persists; reflected immediately.
- `GET /projects` and `get_project` (MCP) surface description/color on prod.
- `update_project` sets them over MCP.
- Docs updated (CONTEXT, USING_KBRELAY, MCP README, OpenAPI).

## Out of scope

Multi-color theming; archival UX; markdown editing inside the settings modal.
