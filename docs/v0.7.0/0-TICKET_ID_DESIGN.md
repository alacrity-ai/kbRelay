# kbRelay — v0.7.0 Design: project codes + ticket keys (title → summary)

**Date:** 2026-07-01
**Status:** design
**Companion:** `1-TICKET_ID_IMPLEMENTATION_PLAN.md`
**Live:** https://kbrelay.lalalimited.com
**Type:** data-model + API + web + docs + one-time prod backfill.

---

## 1. Problem

A card has one text field, `title`, holding a long descriptive string (e.g.
*"RDRBS-315 BANs UX: status badges + clear activate/deactivate…"*). There is no
short, stable identifier to refer to a ticket by, and projects have only a display
name. We want Jira-style **ticket keys** (`OBL-1`, `OBL-2`) so tickets are
referable, and the descriptive text to become a proper **summary**.

## 2. Model

- **Project code** — a short prefix per project (2–6 chars, `[A-Z0-9]`, uppercased),
  unique within a tenant. E.g. `OBL` for "Orderbase - Launch".
- **Ticket key** — `CODE-N`, e.g. `OBL-1`. **Derived**, not stored as a string:
  a card stores an integer **`seq`**; the key is computed `code + "-" + seq` at
  read time. (Deriving avoids a denormalized string to keep in sync.)
- **Sequence** — `seq` is **monotonic per project** via a project counter
  `card_seq` (never reused, even after a delete — like Jira). New card:
  `UPDATE projects SET card_seq = card_seq + 1 … RETURNING card_seq`.
- **`title` → `summary`** — the existing descriptive field is **renamed**. The word
  "title" now means the key.

### The two words, precisely
| Concept | Field | Example | Editable? |
|---|---|---|---|
| Ticket **key** | derived `key` (from `code`+`seq`) | `OBL-1` | no (auto) |
| Ticket **summary** | `summary` (was `title`) | "Ship the measurement spine" | yes |
| Project **code** | `projects.code` | `OBL` | at create; via API after |

## 3. Data model changes

**projects**: `+ code TEXT` (nullable in DB for legacy; required by the API on
create), `+ card_seq INTEGER NOT NULL DEFAULT 0`, `UNIQUE(tenant_id, code)`.

**cards**: `title` **renamed** to `summary`; `+ seq INTEGER` (nullable in DB;
always set by the API going forward). Key is computed, not stored.

All additive/rename — verified D1 supports `ALTER … RENAME COLUMN`, `ADD COLUMN`,
correlated-subquery backfill, and `RETURNING`.

## 4. API contract changes

- **ProjectDto**: `+ code: string | null`.
- **createProjectInput**: `+ code` (required; `/^[A-Za-z0-9]{2,6}$/`, uppercased).
  Uniqueness checked per tenant → `409` on clash.
- **patchProjectInput**: `+ code?` (same validation/uniqueness) — lets a code be
  corrected later.
- **CardDto**: `title` → `summary`; `+ seq: number | null`; `+ key: string | null`
  (server-computed `code-seq`; null if the project has no code yet).
- **createCardInput / patchCardInput**: `title` → `summary`. No key/seq input
  (auto). Card `color` was already removed in v0.2.0.
- **List cards `?q=`**: searches `summary` (was `title`).
- **openapi.ts**: Project + Card schemas and the create-project body updated;
  router↔spec parity test unaffected (no route changes).
- **System events**: an `edited` event's `fields` uses `summary` (not `title`).

## 5. Web changes

- **Board card** (`CardBody`): show the **key** as a small mono eyebrow (top-left)
  above the **summary** (which occupies the slot the title had). Assignee chip
  unchanged. Null key → just the summary.
- **Card modal**: view mode shows key as an eyebrow + summary as the heading; edit
  mode's "Title" field becomes **"Summary"**; the key is shown read-only (auto).
- **New-project modal** (new): two fields — **Name** and **Code** — with a live
  preview ("First ticket: `OBL-1`"). Replaces the single-field prompt. Client
  validates/uppercases the code.
- **Filter**: keyword search matches **summary** (was title). (Also matches the
  key as a convenience — typing `OBL-3` finds it — a low-risk superset of the ask.)
- **Project switcher**: show the code as a small chip next to the name.

## 6. Migration (one-time, prod data is real + in use)

Two migrations:

- **`0005_ticket_keys.sql`** — schema (generic, all envs): add `code`, `card_seq`;
  `RENAME COLUMN title TO summary`; add `seq`; `CREATE UNIQUE INDEX
  idx_projects_tenant_code ON projects(tenant_id, code)`.
- **`0006_backfill_ticket_keys.sql`** — data (safe on all envs; no-ops where ids
  don't exist): assign codes to the three known live projects by id, number each
  project's existing cards by creation order (`created_at`, id tiebreak) via a
  correlated subquery, and set each project's `card_seq` to its card count.

Codes assigned (by live project id):
| Project | id | code | cards |
|---|---|---|---|
| Orderbase - Launch | `prj_2f713d4c864745fbb9cae134052dfd8c` | `OBL` | 20 → OBL-1..20 |
| buildmylease.com | `prj_0e619e7c54664ff696e16bfee79583a7` | `BML` | 11 → BML-1..11 |
| buildmylease.com Support | `prj_c6a2f28633a4485c9588bc8081718cd5` | `BMS` | 0 |

Existing summaries keep their embedded historical prefixes (RDRBS-/AG-/HU-); the
new kbRelay key is independent and assigned by creation order. No text is stripped.

## 7. Blast-radius audit (what must change)

- **shared**: `board.ts` (ProjectDto, CardDto, 4 zod inputs), `board.test.ts`.
- **api**: `migrations/0005`, `0006`; `db/repos/projects.ts` (code + uniqueness +
  counter), `db/repos/cards.ts` (summary/seq/key/`?q=`/events); `openapi.ts`;
  `test/integration/assertions.mjs`.
- **web**: `lib/api.ts` (CardInput, createProject body), `components/CardItem.tsx`,
  `CardModal.tsx`, `FilterModal.tsx`, new `NewProjectModal.tsx`, `pages/BoardApp.tsx`,
  `styles.css`.
- **docs**: `.claude/skills/USING_KBRELAY.md`, `.claude/CONTEXT.md`.

## 8. Non-goals

Renaming/deleting keys, moving a card between projects (key would change), multiple
codes per project, code-edit UI (API only for now), full-text server search. Key
match in the filter is the only scope addition (a superset that helps).

## 9. Risk / rollback

Schema migration renames a column — the API deploy that reads `summary`/`seq` must
land together with (or right after) the migration. Sequence: migrate → deploy API
→ deploy web. Rollback is redeploying the prior Worker/Pages **and** would require
renaming `summary`→`title` back; because the change is contained and tested, we
roll forward. Backfill is idempotent-ish (re-running re-derives the same seq/codes).
