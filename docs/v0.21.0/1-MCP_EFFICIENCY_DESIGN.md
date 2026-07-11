# v0.21.0 — MCP / API Efficiency: address work the way agents talk about it (KBR-127 → KBR-128)

Agents (and the humans prompting them) speak in **ticket keys** (`KBR-127`),
**project codes** (`KBR`), and **lane roles** (`in_progress`). The API speaks in
opaque ids. Every translation between the two costs the agent a round-trip and
a payload of tokens. This release removes the translation tax.

## 1. The audit

24 MCP tools today (`packages/mcp/src/tools/index.ts`), each a thin wrapper on
one endpoint. The tools are fine individually — the waste is in the **call
patterns** they force. Traced from real agent sessions on this very board
(the KBR-121 landing-page build; the KBR-127 brainstorm):

| Situation | Calls today | Why |
|---|---|---|
| "Work KBR-127" (a key from a human) | 2–3 | `list_projects` (find `KBR` → id, ~8 KB) → `list_cards`/`get_card` to map key → card id |
| Orient on a board | 2–3, heavy | `get_project` (columns) + `list_cards` (returns **full descriptions/AC** for every card) |
| Pick up a card (contract step 2) | 3 | `get_project` *just to learn the in_progress column id* → `update_card` → `add_comment` |
| Hand back | 2–3 | same column-id detour for the review lane |
| "My cards in this project" | 2 | `list_users`/`whoami` to get an id for `assignee=` |
| KBR-121 session, total | **~10 calls before the first real mutation** | all of the above compounding |

Root causes, in order of cost:

1. **Ids everywhere, keys nowhere.** `cardId`/`projectId` params only accept
   opaque ids, but every prompt, timeline entry, commit message, and handoff
   refers to `KBR-127` — the product's own convention (§ticket keys).
2. **No single board read.** Topology (columns+roles) and content (cards) are
   two endpoints, and the card list carries full markdown bodies whether or
   not the agent needs them.
3. **Column ids are load-bearing.** Moves require `columnId`, but the flow is
   defined by **roles** (the v0.15 design's own rule: resolve by role, never
   name) — so every move starts with a `get_project` detour.
4. **Docs teach conventions, not costs.** Tool descriptions explain the
   etiquette but not the cheapest call path.

## 2. The changes (all additive, zero breaking)

### 2.1 Ref resolution — keys and codes as first-class addresses (API)

Anywhere a route takes a **card id**, accept a **ticket key**; anywhere a
**project id**, accept a **project code**:

- `GET/PATCH/DELETE /v1/cards/KBR-127`, `/v1/cards/KBR-127/timeline`,
  `/comments`, `/attachments`, `/links`, `/review` — all work.
- `GET /v1/projects/KBR`, `/v1/projects/KBR/cards`, `/columns`, `/events`,
  `/board`, `/analytics`, card create under `/v1/projects/KBR/cards` — all work.

**Implementation:** one normalization step in the dispatcher, driven by the
existing declarative access scopes (`auth/access.ts`): before
`enforceProjectAccess`, if a `card`-scoped param matches
`/^([A-Za-z0-9]{2,6})-([1-9][0-9]*)$/` (and isn't a `card_…` id), resolve
`project code + seq → card id` within the tenant and rewrite the param; if a
`project`-scoped param matches `/^[A-Za-z0-9]{2,6}$/` (and isn't `prj_…`),
resolve `code → project id`. Handlers keep receiving canonical ids — zero
handler changes. The grammar is unambiguous (real ids always contain `_`;
codes/keys never do). Unresolvable refs fall through to the existing **404**
path, and resolution is tenant-scoped *before* the RBAC check, so the
no-access-is-404 invariant is untouched. `label`/`attachment`/`cardLink`
scopes are id-only (no human-facing ref exists for them).

### 2.2 `columnRole` — move by role, not id (API)

`POST /projects/:ref/cards` and `PATCH /cards/:ref` accept an optional
`columnRole: "ready" | "in_progress" | "review" | "done" | "blocked"`,
resolved server-side to that project's role column (`400` with a clear message
if the project has no column in that role; `columnId` wins if both are sent).
The pickup ritual drops from 3 calls to 2 — and the 2 that remain need no
prior board read at all when combined with 2.1:

```
update_card { cardId: "KBR-127", columnRole: "in_progress" }
add_comment { cardId: "KBR-127", body: "On it — …" }
```

### 2.3 Board snapshot — the whole topology in one compact call (API + MCP)

`GET /v1/projects/:ref/board` → `{ project, columns, cards }` where `cards`
are **digests**: `id, key, summary, columnId, position, assigneeUserId,
reviewerUserId, dueAt, labels, attachmentCount, createdBy, updatedBy` — **no
description / acceptanceCriteria bodies** (the token-heavy fields; fetch one
card's spec with `get_card` when actually working it). New MCP tool
**`get_board`**. Orientation becomes one call, and its payload is a fraction
of today's `list_cards`.

### 2.4 MCP ergonomics + docs

- All tool descriptions rewritten to teach the cheap path: `cardId` params say
  "card id **or ticket key (KBR-12)**", `projectId` says "project id **or
  code (KBR)**", `update_card` documents `columnRole`.
- `list_cards.assignee` accepts **`"me"`** — the MCP resolves it via
  `GET /v1/me` once per process (cached), since "my cards" is the dominant
  filter and previously cost a `whoami`/`list_users` detour.
- `packages/mcp/README.md` + root `README.md` refreshed (tool table, counts —
  the root README still says 16; it's 25 after `get_board`), plus the
  `.claude/skills/USING_KBRELAY.md` agent guide gains the "address by
  key/code/role" section.
- Version bump `@alacrity-ai/kbrelaymcp` `0.7.0 → 0.8.0`, npm publish.

## 3. Call-count impact

| Flow | Before | After |
|---|---|---|
| "Work KBR-127" from a prompt | 2–3 calls | **1** (`get_card "KBR-127"`) |
| Orient on a board | 2–3 heavy | **1 compact** (`get_board "KBR"`) |
| Pickup ritual | 3 | **2**, no prior reads |
| Handback ritual | 2–3 | **2**, no prior reads |
| "My cards here" | 2 | **1** (`assignee:"me"`) |
| KBR-121-style session prelude | ~10 | **~4** |

## 4. Deliberately out of scope

- **`batch_update_cards`** (from the KBR-127 brainstorm sketch): key/role
  flattening removes most multi-call bursts; a batch endpoint needs
  partial-failure semantics + per-card provenance ordering decisions that
  deserve their own design when evidence demands it.
- **Key/code resolution in list *query params*** (`?assignee=`, `?column=`)
  server-side — `assignee:"me"` in the MCP covers the real case; the rest
  stays id-based until a need shows.
- **Tool removals / renames** — everything is additive; existing agent
  configs keep working unchanged.

## 5. File-change list

| File | Change |
|---|---|
| `apps/api/src/auth/access.ts` | `normalizeRefParams()` — key→id + code→id resolution per access scope |
| `apps/api/src/runtime/shared/dispatch.ts` | call `normalizeRefParams` before `enforceProjectAccess` |
| `packages/shared/src/board.ts` | `columnRole` on create/patch card input schemas (+ shared `COLUMN_ROLES`) |
| `apps/api/src/routes/cards.ts` | resolve `columnRole` → `columnId` in create/patch handlers |
| `apps/api/src/routes/projects.ts` (or `board.ts`) | `handleGetBoard` — project + columns + card digests |
| `apps/api/src/router.ts` | `GET /api/v1/projects/:id/board` (project scope) |
| `apps/api/src/openapi.ts` | board path; ref-acceptance + columnRole documented |
| `apps/api/src/refs.route.test.ts` **(new)** | key/code resolution: happy path, cross-tenant 404, no-access 404, malformed ref 404 |
| `apps/api/src/routes/board.route.test.ts` **(new)** | snapshot shape; digests exclude description/AC; columnRole create/move + 400-no-role |
| `packages/mcp/src/tools/index.ts` | `get_board`; description rewrites; `assignee:"me"`; `columnRole` params |
| `packages/mcp/src/tools/tools.test.ts` | updated expectations |
| `packages/mcp/package.json` + `README.md` | 0.6.0 + docs |
| `README.md`, `.claude/skills/USING_KBRELAY.md` | counts + "address by key/code/role" |

## 6. Rollout

1. Gates: `make typecheck lint test check-boundaries` (includes OpenAPI↔router
   parity + RBAC coverage tests, which force the new route to be declared
   correctly).
2. Commit → push `main` (leifktaylor, DCO + co-author trailer).
3. **Deploy API to prod** (`make deploy-api-prod`; no D1 migrations — schema
   untouched). Smoke with a bearer token: `GET /v1/cards/KBR-127` (by key),
   `GET /v1/projects/KBR/board`, `PATCH` a scratch card by `columnRole`, and
   `/api/health`.
4. **Publish `@alacrity-ai/kbrelaymcp@0.8.0`** (npm CI token via agentsecrets,
   injected as env — never printed). Verify `npm view` shows 0.6.0. Existing
   `npx -y` configs pick it up on next session start.
5. Evidence + handoff on the ticket. Rollback: API is backward-compatible by
   construction (`git revert` + redeploy if needed); npm keeps 0.7.0
   installable via pin.
