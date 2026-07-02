# kbRelay v0.15.0 — Human⇄Agent Flows: Final Design

**Status:** Approved design, ready to build. Synthesizes
[`0-CALLBACK_RESEARCH.md`](./0-CALLBACK_RESEARCH.md) (how an event reaches an
agent) and [`1-PROPOSED_FLOWS.md`](./1-PROPOSED_FLOWS.md) (how a ticket becomes
"fair game"). Grounded in the current code (migrations `0001`–`0012`, `apps/api`,
`apps/web`, `packages/shared`, `packages/mcp`).

**The decision:** Option E — **column roles** + **assignment routing** + a
**handback contract**. Columns stay fully customizable; each column may carry an
optional **semantic role**. "Actionable" = *assigned to me* **and** *in a
`ready`-role column*. Finished work always lands in `review`; the human closes
(the agent may close only when told). A card entering the actionable state — and,
as a follow-on, an @-mention — is exactly what fires the KBR-8 callback.

---

## 1. Decisions locked in this design

From the KBR-8 discussion and @leif's refinements:

1. **Roles, not hard-coded columns.** A nullable `role` on each column. Column
   names/colors/order/count stay fully customizable (Invariant: columns are the
   user's to shape).
2. **Five weighted roles; everything else inert:** `ready`, `in_progress`,
   `review`, `done`, `blocked`. A column with no role is neutral (e.g. Backlog).
   - **`blocked`** matters: if an agent hits a blocker mid-work, it moves the
     card to the blocked-role column **and comments why** — never silent.
3. **One holder per role per project.** Column A and B can't both be `ready`.
   **Reassigning a role yanks it** from whoever held it: set `ready` on B → A's
   `ready` is cleared, atomically.
4. **Clear role badges on columns.** The board shows a column's role plainly at
   the top; a role-less column is visibly role-less. Easy to switch in Project
   Settings → Columns.
5. **Actor-agnostic `ready`.** Routing is the assignee's job (already
   first-class). `ready` means "ready for whoever it's assigned to" — human or
   agent. No separate "agent-only" lane.
6. **Agent shows its hand on pickup:** moves the card to `in_progress` + drops a
   short "taking this" note. (Agents already tend to do this; we canonicalize it.)
7. **Handback:** agent → `review` by **default**. Agent → `done` **only** when
   explicitly told ("LGTM", "move to done", "@claude close this"). Nothing
   *stops* the agent from moving to `done` when instructed.
8. **Default new-project board (6 lanes, roles pre-wired):**
   `Backlog` (—) · `Blocked` (`blocked`) · `Ready` (`ready`) ·
   `In Progress` (`in_progress`) · `In Review` (`review`) · `Done` (`done`).
9. **No unassigned "pool" self-grab yet.** An agent works only cards **assigned
   to it**. (Cool future idea — see §9.)
10. **@-mention is also a trigger** (follow-on): @-ing an agent should fire a
    callback; the agent decides what to do (comment, move to done, move to
    blocked, …). Open-ended by design.

---

## 2. The model

```
   ┌──────────┐  ┌──────────┐   human drags   ┌────────┐  agent picks up  ┌──────────────┐
   │ Backlog  │  │ Blocked  │ ─(or unblocks)─▶ │ READY  │ ───(auto)──────▶ │ IN PROGRESS  │
   │  (—)     │  │ blocked  │◀─agent, if stuck │ ready  │  in_progress +   │ in_progress  │
   └──────────┘  └────┬─────┘   + why note     └────────┘  "taking this"   └──────┬───────┘
                      │                                                            │ done
     (inert until     │  human returns w/ note                                     ▼
      a human acts)   ▼                          ┌────────┐  agent finishes  ┌──────────────┐
                 ┌────────┐  human closes (or    │ REVIEW │◀───(auto)─────── │   the work   │
                 │  DONE  │◀─agent when told)──── │ review │  handoff + @you  └──────────────┘
                 │  done  │                       └────────┘
                 └────────┘
```

**Actionable predicate (the single definition, reused everywhere):**

```
actionable(user) := card.assignee_user_id = user.id
                    AND card.column has role = 'ready'
                    [AND card.project = X]   -- optional scope
```

This is what the agent's loop drains, what `GET /me/queue` returns, and (KBR-8)
what fires the push.

---

## 3. Data model (migration `0013`, additive)

Today (`0001_init.sql`) `columns` is `(id, tenant_id, project_id, name, color,
position, created_at)` — **no role**. Add one nullable column:

```sql
-- 0013_column_roles.sql  (additive; behavior-preserving)
ALTER TABLE columns ADD COLUMN role TEXT;   -- NULL = neutral

-- Opportunistic, safe backfill: wire roles for columns whose names already
-- match the canonical set. Ambiguous names (Todo, Backlog) are left NULL for
-- the owner to assign — we do NOT guess which lane is "ready".
UPDATE columns SET role = 'blocked'     WHERE role IS NULL AND name = 'Blocked';
UPDATE columns SET role = 'ready'       WHERE role IS NULL AND name = 'Ready';
UPDATE columns SET role = 'in_progress' WHERE role IS NULL AND name = 'In Progress';
UPDATE columns SET role = 'review'      WHERE role IS NULL AND name = 'In Review';
UPDATE columns SET role = 'done'        WHERE role IS NULL AND name = 'Done';
```

- **Role had no meaning before**, so setting it changes no existing behavior →
  the `t_lala` "additive-only" invariant holds. Backfill is idempotent.
- **Uniqueness is enforced in the repo, not the schema** (a partial unique index
  on `(project_id, role) WHERE role IS NOT NULL` is tempting, but D1 migration
  ergonomics + the "yank" UX are cleaner in code — see §4). We still add
  `CREATE INDEX idx_columns_role ON columns(project_id, role);` for the queue
  join.

**Shared types (`packages/shared/src/board.ts`):**

```ts
export type ColumnRole = 'ready' | 'in_progress' | 'review' | 'done' | 'blocked';
const columnRole = z.enum(['ready', 'in_progress', 'review', 'done', 'blocked']);

export interface ColumnDto { /* …existing… */ role: ColumnRole | null; }

// createColumnInput / patchColumnInput gain:  role: columnRole.nullable().optional()
```

**Default board (`DEFAULT_COLUMNS`, `board.ts:129`; seeded in
`projects.ts:createProject`):** replace the current 4-lane set
(`Todo/In Progress/In Review/Done`) with the 6-lane set from §1.8, each carrying
its `{ name, color, role }`. Update `board.test.ts` accordingly. This only
affects **newly created** projects.

---

## 4. API surface

### 4.1 Column role write path (`db/repos/columns.ts`, `routes/columns.ts`)
- `toDto` returns `role`.
- `createColumn` / `patchColumn` accept `role`.
- **Yank on set** — when a patch/create sets a non-null `role`, clear that role
  from any sibling in the same project **in the same `env.db.batch([...])`**:

  ```sql
  UPDATE columns SET role = NULL
   WHERE tenant_id = ? AND project_id = ? AND role = ? AND id != ?;
  ```
  So "make B the Ready column" is one atomic call that moves the badge. (Setting
  `role = null` just clears; no yank.)
- Roles ride the existing `PATCH /columns/:id` route (access scope `column`,
  already RBAC-guarded in the router). No new route.

### 4.2 The actionable queue — `GET /api/v1/me/queue`
A `me`-scoped endpoint (sits beside `/me/mentions`), returning the caller's
actionable cards across every project they can access, newest-ready first:

```
GET /api/v1/me/queue            → all my actionable cards, tenant-wide
GET /api/v1/me/queue?projectId=… → scoped to one project
```

- Repo query: `cards JOIN columns ON cards.column_id = columns.id` where
  `columns.role = 'ready'` AND `cards.assignee_user_id = <caller>`, RBAC-filtered
  by `project_access` exactly like `listMentions` (`mentions.ts:162`) so admins
  see all and members only their granted projects.
- Returns `CardDto[]` enriched with `projectCode`/`projectName` (like the
  mentions payload) so the agent needs no extra lookups.
- New handler in `routes/me.ts` + a `handleMyQueue`; register
  `{ method:'GET', pattern:'/api/v1/me/queue', handler: handleMyQueue }` in
  `router.ts` (protected; not project-scoped — it filters internally).
- Add to `openapi.ts` (the router↔OpenAPI parity test will fail otherwise).

### 4.3 No new "status" field
Status remains **the column** (kbRelay's existing invariant). Roles annotate
columns; they do not introduce a second status axis on the card.

---

## 5. MCP surface (`packages/mcp/src/tools/index.ts`)

- **New tool `list_my_queue`** — the agent's front door. Thin wrapper over
  `GET /me/queue`:
  > *"Your actionable work: cards assigned to you that sit in a `ready`-role
  > column, across all projects you can access (optional `projectId` scope).
  > This is what to work first. For each: get_card → move to the in_progress
  > column + a short 'taking this' comment → do the work → move to the review
  > column + a handoff comment. Only move to done if explicitly told."*
- **`get_project`** already returns columns; include each column's `role` so the
  agent can resolve the in_progress / review / blocked / done column ids by role
  (not by name). Update its description: *"columns carry an optional `role` —
  resolve pickup/review/blocked/done targets by role, never by hardcoded name."*
- **`update_card`** description: reinforce the contract (pickup→in_progress,
  finish→review, done-only-when-told, stuck→blocked+comment).
- Bump `@alacrity-ai/kbrelaymcp` minor; add a tool test (`tools.test.ts`).

---

## 6. Web surface (`apps/web`)

- **Column role badge (board).** In the column header (`components/Column.tsx`),
  render a small, clear role chip (e.g. `● Ready`) when `column.role` is set, and
  a muted "No role" affordance when it isn't — so it's obvious at a glance which
  lane means what. Color-code by role.
- **Role picker (Project Settings → Columns).** The Columns tab
  (`ProjectSettings.tsx`, the `tab === 'columns'` block, currently reorder-only)
  gains a per-row **role selector** (dropdown: none / Ready / In Progress /
  Review / Done / Blocked). Selecting a role that another column holds shows the
  yank ("moves Ready from *In Progress*") and, on save, the API performs it.
  `api.patchColumn` gains `role`.
- No change to drag-and-drop; moving a card between lanes is unchanged — it just
  now *means* something when the target column has a role.

---

## 7. The handback contract (canonicalized)

Encoded in the `using_kbrelay` skill (`.claude/skills/USING_KBRELAY.md`) and
taught through the MCP tool descriptions, so **every** agent follows it:

1. **Find work:** `list_my_queue` (assigned to me + in `ready`). Optionally
   scope to a project.
2. **Take it:** move the card to the **`in_progress`** column and add a one-line
   note ("On it — <plan>."). This is the *I-see-something-happening* signal.
3. **Do the work.**
4. **If blocked:** move to the **`blocked`** column and add a `note`/`handoff`
   comment explaining the blocker + what you need. @-mention the requester. Stop;
   don't guess.
5. **Finish:** move to the **`review`** column and post a **`handoff`** comment
   (summary / evidence / verify / spunOff) + @-mention the requester → they get
   the notification.
6. **Close:** leave `done` to the human. Move to **`done`** **only** when the
   card/comment explicitly authorizes it ("LGTM", "move to done").

Recommended loop (Phase 0, works today via polling; see KBR-8):

```
/loop 10m work my kbRelay queue: for each actionable card, take it (in_progress
+ note), do it, move to review with a handoff. Only close if told.
```

A shippable `.claude/loop.md` example encodes exactly this so a bare `/loop`
does the right thing.

---

## 8. Events & the KBR-8 callback (how this arms the push)

The readiness model **defines the trigger** the KBR-8 outbound webhook fires on.
The natural hook points already exist in `patchCard` (`cards.ts:191`), which
today derives `moved` and `assigned` system events:

- **Enters actionable state** — a card is **moved into a `ready`-role column
  while assigned to an agent**, OR **assigned to an agent while already in a
  `ready` column**. Fire the callback (→ channel event / routine `/fire`, per
  KBR-8). Leaving `ready` is a no-op/retract. Idempotent.
- **@-mention of an agent** *(follow-on — §10, new ticket)* — when the mention
  projection (`reconcileMentionStmts`) adds a mention whose recipient is an
  agent, fire an **open-ended** callback carrying the card + comment context; the
  agent decides what to do (comment, move to done/blocked, answer a question).

Both are *producer-side* concerns; the *transport* (webhook → channel / routine)
is KBR-8's build. This design gives KBR-8 its precise trigger definitions. Until
that lands, the same two signals are drained by **polling**: `list_my_queue`
(readiness) and `get_mentions` (mentions) — which is why the polling loop in §7
is fully functional on day one, no webhook required.

```
human drags card → Ready (assigned to Claude)
   │
   ├─ polling now:  list_my_queue surfaces it   ◀── ships in this feature
   └─ push later:   KBR-8 webhook fires on the ready-transition ── channel / routine
```

---

## 9. Non-goals / deferred

- **Unassigned pool self-grab** (agent picks up any `ready` + unassigned card in
  a project via an opt-in project setting). Cool, but off — avoids runaway.
  Revisit post-v0.15.0.
- **Per-card "notify agents" checkbox.** Assignment + `ready` are the trigger; a
  card flag is redundant. Not building.
- **WIP limits / column policies, auto-close timers.** Out of scope.
- **A second status axis on the card.** Status stays = column.

---

## 10. Build plan — tickets (KBR Backlog, assigned to Claude)

Landed in dependency order. Each is a small, reviewable PR. Per our own contract
they start in **Backlog** (inert); move to **Ready** to authorize work.

| Key | Title | Surface | Dep |
|-----|-------|---------|-----|
| **KBR-9**  | Column **roles**: schema + API + single-holder "yank" | migration + api + shared | — |
| **KBR-10** | Default new-project board → **6 lanes with roles pre-wired** | shared + seed + test | KBR-9 |
| **KBR-11** | **Actionable queue**: `GET /me/queue` + `list_my_queue` MCP tool | api + mcp | KBR-9 |
| **KBR-12** | Web: column **role badges** (board) + **role picker** (settings) | web | KBR-9 |
| **KBR-13** | **Handback contract**: canonicalize in skill + MCP descriptions + `loop.md` | docs + mcp | KBR-11 |
| **KBR-14** | *(follow-on)* **@-mention as a callback trigger** — extends KBR-8 | api + KBR-8 | KBR-8, KBR-9 |

**Cross-cutting acceptance (every backend ticket):** `make test` green;
`make check-boundaries` green (inline SQL stays in `db/repos/*`); OpenAPI↔router
parity test passes; migration is additive and `t_lala`-safe; parity holds
(anything the board does, the API/MCP do).

Once KBR-9…13 land, the polling flow is fully usable; KBR-14 + the KBR-8 webhook
build turn on true push.
</content>
