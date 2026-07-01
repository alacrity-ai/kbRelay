# kbRelay — v0.7.0 Implementation Plan

**Companion to:** `0-TICKET_ID_DESIGN.md`
**Order:** shared → API (migrations, repos, openapi, tests) → web → docs → verify →
deploy (migrate prod → API → web) → verify live. Each step compiles/lints clean.

---

## Phase 1 — shared (`packages/shared/src/board.ts`)

- `ProjectDto`: add `code: string | null`.
- `CardDto`: rename `title: string` → `summary: string`; add `seq: number | null`,
  `key: string | null`.
- Validators: add `const code = z.string().trim().regex(/^[A-Za-z0-9]{2,6}$/).transform(s => s.toUpperCase())`.
- `createProjectInput`: add `code` (required). `patchProjectInput`: add
  `code: code.optional()`.
- `createCardInput`: `title: name` → `summary: name`. `patchCardInput`:
  `title: name.optional()` → `summary: name.optional()`.
- `board.test.ts`: update createCard tests (`title`→`summary`); add createProject
  code cases (valid `ABC`, lowercase `abc`→ok+uppercased, `''`→fail, `TOOLONG7`→fail);
  add a missing-code project → fail.

## Phase 2 — migrations

**`apps/api/migrations/0005_ticket_keys.sql`** (schema):
```sql
ALTER TABLE projects ADD COLUMN code TEXT;
ALTER TABLE projects ADD COLUMN card_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cards RENAME COLUMN title TO summary;
ALTER TABLE cards ADD COLUMN seq INTEGER;
CREATE UNIQUE INDEX idx_projects_tenant_code ON projects(tenant_id, code);
```

**`apps/api/migrations/0006_backfill_ticket_keys.sql`** (data; no-ops off-prod):
```sql
UPDATE projects SET code='OBL' WHERE id='prj_2f713d4c864745fbb9cae134052dfd8c';
UPDATE projects SET code='BML' WHERE id='prj_0e619e7c54664ff696e16bfee79583a7';
UPDATE projects SET code='BMS' WHERE id='prj_c6a2f28633a4485c9588bc8081718cd5';
-- Number each project's existing cards by creation order (id tiebreak).
UPDATE cards SET seq = (
  SELECT COUNT(*) FROM cards c2
  WHERE c2.project_id = cards.project_id
    AND (c2.created_at < cards.created_at
         OR (c2.created_at = cards.created_at AND c2.id <= cards.id))
) WHERE seq IS NULL;
-- Each project's counter = its current card count.
UPDATE projects SET card_seq = (SELECT COUNT(*) FROM cards WHERE cards.project_id = projects.id);
```
(Verified on local D1: rename, correlated numbering, and the counter all work.)

## Phase 3 — API repos

**`db/repos/projects.ts`**
- `ProjectRow` + `toDto`: add `code`.
- `createProject`: validate code uniqueness (`SELECT 1 FROM projects WHERE
  tenant_id=? AND code=?` → `HttpError(409, 'Project code already in use')`);
  insert `code` (and `card_seq` defaults to 0). Add `code` to the INSERT columns.
- `patchProject`: allow `code` (if provided and changed, re-check uniqueness);
  add to UPDATE.
- Add `getProjectRow`/helper exposing `card_seq` + `code` for the cards repo, or a
  small `nextCardSeq(env, tenantId, projectId)` that does the `RETURNING` update,
  and `projectCode(env, tenantId, projectId)`.

**`db/repos/cards.ts`**
- `CardRow`: `title` → `summary`; add `seq`.
- `toDto(row, code)`: `summary`; `seq`; `key = code && row.seq != null ? \`${code}-${row.seq}\` : null`.
  Since key needs the project code, thread it in:
  - `listCards`: fetch the project's `code` once, map rows with it.
  - `getCard`/create/patch: fetch the card's project code (join or a small lookup).
- `createCard`: `input.summary`; get `seq` via `nextCardSeq(...)`; INSERT includes
  `summary, seq`; keep the `created` system event in the same `batch()`.
- `patchCard`: `summary`; edited-fields uses `'summary'`; do **not** touch `seq`.
- `?q=` clause: `(summary LIKE ? OR description LIKE ?)`.

**`routes/*`**: unchanged except types flow through (zod already validates).

**`openapi.ts`**: Project schema `+ code`; Card schema `title`→`summary`, `+ seq`,
`+ key`; create-project body `+ code` (required).

**`test/integration/assertions.mjs`**: create project with `code`; assert
`project.code`; create card with `summary`; assert `card.summary`, `card.key ===
'<CODE>-1'`, `card.seq === 1`; second card → `-2`. Cross-tenant checks unchanged.

## Phase 4 — web

- `lib/api.ts`: `CardInput.title` → `summary`; `createProject` body type `+ code`.
- `components/CardItem.tsx` (`CardBody`): render `card.key` in a `.card-key`
  eyebrow (when present) + `card.summary` in `.card-title` slot; assignee chip as-is.
- `components/CardModal.tsx`: state `title`→`summary`; edit label "Summary"; view
  header = key eyebrow + summary; save sends `summary`; validation "Summary is
  required."; new card has no key until saved.
- `components/FilterModal.tsx`: `cardMatchesFilter` matches `card.summary` (and
  `card.key`); comment/label wording "title"→"summary".
- `components/NewProjectModal.tsx` (new): Name + Code inputs, uppercase code,
  live "First ticket: CODE-1" preview, client validation, calls
  `createProject({name, code})`. Themed like the other modals.
- `pages/BoardApp.tsx`: `newProject()` opens `NewProjectModal` (not `dialog.prompt`);
  render it; show project `code` chip in the switcher trigger + dropdown rows.
- `styles.css`: `.card-key` (mono, muted, small), modal `.view-eyebrow`, new-project
  modal + code input + preview, `.project-code` chip.

## Phase 5 — docs

- `.claude/skills/USING_KBRELAY.md`: card shape (`summary`, `key`, `seq`), project
  shape (`code`); "create a project" now needs `code`; "create a card" uses
  `summary` (key is auto); `?q=` searches summary; examples updated
  (`title`→`summary`, show `key`).
- `.claude/CONTEXT.md`: primitives line (`title`→`summary`; keys/codes); add a
  v0.7.0 bullet.

## Phase 6 — verify

- `make typecheck && make lint && make test && make build` clean.
- Local: `make db-reset-local && make db-migrate-local` (applies 0005+0006);
  `make dev`; via API — create a project with a code, create two cards → assert
  keys `CODE-1`, `CODE-2`, `seq` 1/2; edit summary; `?q=` by summary; run the
  integration assertions against local.

## Phase 7 — deploy (order matters)

1. `make db-migrate-prod` (applies **0005 then 0006** — schema + backfill).
2. `make deploy-api-prod` (Worker now reads `summary`/`seq`, computes `key`).
3. `make deploy-web-prod`.
4. Verify live: `/v1/projects` shows codes; a project's cards show `key`/`seq`/
   `summary`; open the board — keys render. Spot-check `OBL-1`, `BML-1` exist.
5. `docs/v0.7.0/RELEASE_NOTES.md`.

**Backfill safety:** 0006 only sets `seq WHERE seq IS NULL` and codes by explicit
id, so re-running is safe; existing summaries are untouched.
