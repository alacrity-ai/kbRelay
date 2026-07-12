# v0.22.0 — Deep Search: bodies, archived, and "where it hit" (KBR-129)

Cmd/Ctrl+K search today (KBR-68) is a deliberately shallow v1: three LIKE
probes — ticket key, project name/code, card **summary** — merged and ranked in
code, returning key/summary/project/column with no indication of *why* a card
matched. This release makes it search inside cards, opt into archived cards,
and show the matching text.

Scope is settled with @leif: **LIKE stays** (no FTS5 yet), and **comments are
out** (descriptions + acceptance criteria only).

## 1. What changes (behavioural)

1. **Search card bodies.** The card probe matches `summary`, `description`, and
   `acceptance_criteria` — not just `summary`.
2. **Archived toggle.** A `archived` request param + a palette checkbox. Default
   **excludes** archived cards; checked includes them, badged in the results.
3. **Show where it hit.** Each card hit carries the **matched field** and a
   **snippet** (a windowed excerpt around the first match, with the term
   marked) so the palette previews the actual matching text.

## 2. Latent bug this also fixes

The current card-summary probe has **no `archived_at` filter** — so archived
cards already leak into results silently. Adding the default
`AND c.archived_at IS NULL` makes exclusion the (correct) default; the new
checkbox is the deliberate opt-in. So this is a fix *and* a feature.

## 3. Why LIKE, not FTS5

The repo rule is "LIKE until it visibly hurts" (search.ts). At current scale
(low hundreds of cards/tenant) a tenant-wide `LIKE '%q%'` over three TEXT
columns is cheap, and it needs no migration, no virtual table, no sync
triggers. The probe is structured so FTS5 is a drop-in later; the documented
upgrade trigger is a tenant whose card count makes the scan show up in D1 read
units. Not now.

## 4. Contract changes (`packages/shared/src/search.ts`)

`CardSearchHit` gains three fields (additive; existing consumers ignore them):

```ts
export type CardMatchField = 'key' | 'summary' | 'description' | 'acceptanceCriteria';

export interface CardSearchHit {
  kind: 'card';
  id: string;
  key: string | null;
  summary: string;
  projectId: string;
  projectCode: string | null;
  projectName: string;
  columnName: string;
  matchedField: CardMatchField;   // NEW — which field the query hit
  snippet: string | null;         // NEW — excerpt around the match, or null for key/summary hits
  archived: boolean;              // NEW — true if the card is archived
}
```

- `matchedField` precedes: `key` > `summary` > `description` > `acceptanceCriteria`
  (title matches rank above body matches; keyish queries rank first as today).
- `snippet` is null when the match is in the summary (the summary is already
  shown) or is a key hit; populated for description/AC hits.
- Request: `GET /v1/search?q=&limit=&archived=1`. Anything but `1` (or absent)
  ⇒ exclude archived. This mirrors the `?archived=1` convention on
  `GET /projects/:id/cards`.

Snippet shape: the marked term uses the same convention already used nowhere
else in wire data, so we keep it simple — return `{ before, match, after }` is
tempting but over-structured; instead return a plain string with the match
wrapped in a sentinel the client splits on. Chosen sentinel: **U+0001 … U+0001**
(a control char that cannot occur in card text), so `snippet.split('')`
yields `[before, match, after]` for the client with zero escaping worries and no
HTML in the API layer.

## 5. Server (`apps/api/src/db/repos/search.ts`)

- **Probe 3 (card bodies)** replaces the summary-only probe:
  ```sql
  WHERE c.tenant_id = ?
    AND (c.summary LIKE ?1 ESCAPE '\' OR c.description LIKE ?1 ESCAPE '\'
         OR c.acceptance_criteria LIKE ?1 ESCAPE '\')
    {AND c.archived_at IS NULL}      -- unless includeArchived
    {accessClause}
  ORDER BY (c.archived_at IS NOT NULL) ASC, c.updated_at DESC
  ```
  (live cards rank above archived; newest-touched first within each.)
- **The ticket-key probe** (probe 1) also respects the archived filter (default
  excludes) so a key search doesn't resurrect an archived card unless asked.
- **matchedField + snippet** computed in code from the returned row: test each
  field in precedence order with a case-insensitive `indexOf`; the first field
  containing the query is `matchedField`; for description/AC, build the snippet
  by windowing ±~60 chars around the hit, collapsing whitespace, adding `…`
  affixes when truncated, and wrapping the matched span in the sentinel.
- `searchTenant` gains an `includeArchived: boolean` in its options object;
  `cardHit()` gains the three new fields.

## 6. Route (`apps/api/src/routes/search.ts`)

Parse `archived` (`=== '1'`) → pass `includeArchived` through to `searchTenant`.
No RBAC change (still enforced in-query).

## 7. Web (`QuickFind.tsx` + `lib/api.ts` + `styles.css`)

- `api.search(q, { limit?, archived? })` — signature widens (object opts).
- Palette header gains an **"Include archived"** checkbox; toggling it re-runs
  the current query (it's part of the debounced effect's deps).
- Card row renders:
  - a **field badge** when the match isn't the summary (`in description` /
    `in acceptance criteria`);
  - a **snippet line** under the summary with the matched span highlighted
    (split on the sentinel; middle span wrapped in `<mark class="qf-hit">`);
  - an **"archived"** tag on archived hits.
- Highlight the query inside the summary too when `matchedField==='summary'`.
- Keyboard nav, grouping, debounce, zero-query recents: unchanged.

## 8. Tests

- `apps/api/src/routes/search.route.test.ts` (extend or add): body match in
  description and in AC; matchedField precedence (summary beats description
  when both hit); snippet contains the sentinel-wrapped term and is null for
  summary hits; archived excluded by default, included with the flag, and the
  key probe respects it; RBAC still filters a non-member's project.
- No web unit test framework change; the palette change is exercised in the
  live verification pass (screenshots).

## 9. Out of scope (settled)

- **FTS5 / ranked relevance** — deferred; LIKE per §3.
- **Comment / timeline search** — deferred; append-only logs, higher volume,
  muddies "find the spec".
- **Per-scope search (this board vs all)** — not requested; the palette stays
  tenant-wide.

## 10. Rollout

1. Gates: `make typecheck lint test check-boundaries build` (OpenAPI↔router
   parity + RBAC coverage included).
2. Commit → push `main` (leifktaylor, DCO + co-author trailer; secret-scan).
3. **Deploy API to prod** (`make deploy-api-prod`; no migration) **and web to
   prod** (`make deploy-web-prod`) — this touches both surfaces.
4. Live verify on kbrelay.lalalimited.com: a description-only match returns
   with `matchedField:"description"` + snippet; archived excluded by default,
   surfaced with the checkbox; palette shows field badge + highlighted snippet;
   existing key/summary/project search unchanged. Screensot evidence on the
   ticket.
5. Rollback: `git revert` + redeploy (no schema change; asset+worker only).

No MCP-package release — this is API-behaviour + web, not a tool-surface change.
