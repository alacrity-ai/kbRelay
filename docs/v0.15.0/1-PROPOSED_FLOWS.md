# kbRelay v0.15.0 — Proposed Human⇄Agent Work Flows (companion to KBR-8)

**Status:** Design exploration. No code. Decision doc — weighs options, lands a
recommendation, leaves open questions for @leif.
**Companion to:** [`0-CALLBACK_RESEARCH.md`](./0-CALLBACK_RESEARCH.md) (how an
event reaches the agent). This doc answers the *other half*: **what makes a
ticket "fair game" for an agent to work, and what happens when it's done** — the
flow that has to feel intuitive and safe.

> The two failure modes we're steering between:
> - **Runaway:** you draft/assign a few tickets and the agent charges off and
>   does more than you meant, and you're left wondering what happened.
> - **Dead air:** you draft a pile of tickets and *nothing happens* — no signal
>   the agent should act, so it never does.
>
> The whole design goal is a **deliberate, visible faucet**: turning work "on"
> is an explicit act, the default is "off/inert," and finished work always comes
> back to you for review unless you said otherwise.

---

## 1. First, un-blur the question: it's really **three** decisions

The "Ready for Work toggle vs. hard-coded columns" debate conflates three
independent things. Designing them separately makes the whole thing click.

| # | Decision | Question | Existing kbRelay signal |
|---|----------|----------|-------------------------|
| **① Readiness** | Is this card **actionable now**? | The faucet. "Go." | *nothing first-class* (people abuse column names) |
| **② Routing** | **Who** should do it? | human vs. which agent | `assignee_user_id` (already exists, works) |
| **③ Handback** | Where does finished work land, and **who closes it**? | the return contract | column move + timeline (convention only) |

**Routing is already solved** — `assignee_user_id` is a first-class field and
"assign it to Claude" is the most intuitive delegation gesture there is. The gap
is **①** (no deliberate readiness signal) and **③** (no enforced handback
contract). Everything below is about giving ① and ③ *just enough* semantic
weight without breaking kbRelay's "columns are yours to shape" promise.

**Actionable = ① Readiness AND ② assigned-to-me.** Neither alone is enough:
- assignee-only → no "assigned but not yet ready" state; the instant you assign,
  it's live (can't draft-assign, can't queue).
- readiness-only → the agent doesn't know *it's* the one to act (or a human is).

---

## 2. Invariants we must not break

Drawn from `.claude/CONTEXT.md` and the v0.10.0+ constraints:

1. **Columns are deliberately customizable.** Per-project, renamable,
   reorderable, add/delete. Any design that *hard-codes column names* fights the
   product. (This is the crux of @leif's worry — and it's a real one.)
2. **Humans and agents are symmetric.** kbRelay's thesis is humans *and* agents
   relaying work. Readiness should mean "ready for whoever it's assigned to,"
   not a special agent-only lane. Assign to a human → human picks it up; assign
   to an agent → agent works it. One concept, routed by assignee.
3. **Default is inert & safe.** A freshly created card must **not** be
   actionable. Becoming actionable is an explicit act.
4. **The readiness signal *is* the callback trigger.** Whatever we pick in ①
   should be the exact event that fires the KBR-8 push (channel / routine
   `/fire`). One definition, not two. (See §8.)
5. **Additive migration only.** The live `t_lala` tenant and every existing
   project/board keep working unchanged until an owner opts into new semantics.
6. **Parity + multi-tenant.** Anything the board expresses, the API/MCP express;
   everything scoped by `tenant_id` and project RBAC.

---

## 3. The options for ① Readiness

Six candidates, from "encode nothing" to "hard-code everything," with the two
failure modes scored for each.

### Option A — Encode nothing; convention only ("Todo means ready")
Agents/humans agree by convention that some column (e.g. "Todo") means ready.
- **Mechanism:** none. Pure social contract + per-project README.
- **Pros:** zero build; maximally flexible.
- **Cons:** the exact problem @leif named — not every project *has* a "Todo",
  the name/meaning varies, and a `/loop` can't reliably know what's actionable.
  **Dead-air risk: high** (agent guesses wrong, does nothing). **Runaway risk:
  medium** (agent guesses wrong, works backlog it shouldn't).
- **Verdict:** ✗ This is the status quo and it's what we're fixing.

### Option B — Assignment *is* readiness
If assigned to an agent, it's ready for that agent. No new field.
- **Pros:** dead simple; already exists; intuitive.
- **Cons:** conflates "this is yours" with "start now." **No draft-assign** — you
  can't pre-assign a card you're still writing. **Runaway risk: high** — assign
  five cards to plan them out, agent works all five immediately.
- **Verdict:** ✗ as the *sole* signal (kills drafting). ✓ as the **routing**
  half of a combined predicate (§1, §4-recommendation).

### Option C — Explicit boolean toggle: "Ready for Work"
A first-class `ready` flag on the card, orthogonal to column/assignee. A visible
checkbox in the card modal.
- **Mechanism:** `cards.ready BOOLEAN DEFAULT 0` (+ API/MCP/board).
- **Pros:** unambiguous; **survives custom columns** (it's not a column at all);
  deliberate act; you can draft freely then flip it. Easy `/loop` predicate.
- **Cons:** **second source of truth.** The board already shows state via
  columns; a hidden-ish boolean can *contradict* the column ("card in Done but
  `ready=true`"). Needs auto-clear rules (clear on move to review/done), which is
  fiddly. On a kanban tool, "what state is this in?" should be answerable by
  *looking at the board*, not opening a card to check a checkbox.
- **Verdict:** ◐ Works, but it duplicates what a column already communicates.
  Best as a *fallback* for teams that refuse to model readiness as a column.

### Option D — Hard-coded, protected columns (Ready / In Review / Done)
Every project always has these three columns; they can't be deleted; they carry
semantic weight.
- **Pros:** leverages the **drag gesture people already do** — moving a card *is*
  changing its state, the most intuitive kanban action there is. Semantics are
  visible on the board. No hidden field.
- **Cons:** **directly violates Invariant #1.** Forces one workflow on every
  project (a game-design board and a launch-checklist board don't want identical
  lanes). Rigid names (some want "QA" not "In Review"). Migration must inject
  columns into existing boards. Ordering vs. meaning get conflated.
- **Verdict:** ✗ as literal hard-coded names — too rigid for this product. But
  it's *pointing at the right instinct* (columns carry the state). Option E keeps
  the instinct and drops the rigidity.

### Option E — Column **roles** (semantic tags on *customizable* columns) ★
Keep columns fully customizable (name, color, order, count). Add an optional,
nullable **`role`** to each column: `ready`, `in_progress`, `review`, `done`
(unset = neutral/backlog). The *role* carries meaning; the *name* is yours.
- **Mechanism:** `columns.role TEXT NULL` (enum-validated). A project can mark
  its "Todo" column `role=ready`, its "QA" column `role=review`, etc. New
  projects ship with a default column set that has roles pre-assigned; existing
  projects get **all-null roles** (nothing changes) until the owner assigns them.
- **Pros:** **best of C and D.** Semantic weight *and* full customizability.
  Single source of truth (the board reflects reality — moving the card sets the
  state). Robust to renames/reorders. Actor-agnostic (ready = ready for the
  assignee, human or agent — Invariant #2). Clean `/loop` predicate. Additive &
  safe (Invariant #5).
- **Cons:** a small concept to teach ("mark which column means Ready"); one
  migration + a bit of board UI (a role badge / picker in Project Settings →
  columns). A project could set *zero* ready columns and get dead air — mitigate
  with a sensible default + a gentle "no Ready column set" hint.
- **Verdict:** ✓ **Recommended readiness mechanism.** It's the column instinct
  from D without breaking Invariant #1, and the single-source-of-truth win over
  C.

### Option F — Mention / imperative-driven
The `@claude` mention + comment text *is* the instruction; agent works whatever
it's @-mentioned into.
- **Pros:** most natural; carries **intent** (the comment says *what* to do);
  already exists.
- **Cons:** @mention is overloaded — it's also used for questions, FYIs, "what do
  you think?". An autonomous `/loop` can't cleanly tell "do this" from "discuss
  this." **Runaway risk: high** if the agent treats every mention as a work
  order. Unstructured.
- **Verdict:** ◐ Excellent as the **content/instruction layer on top** of a
  structured readiness signal — *not* as the readiness signal itself. (i.e., the
  card is made actionable by ① + ②; the comments tell the agent the specifics.)

---

## 4. Comparison

| Option | Deliberate? | Survives custom columns? | Single source of truth? | Runaway risk | Dead-air risk | Build cost |
|--------|:-----------:|:------------------------:|:-----------------------:|:------------:|:-------------:|:----------:|
| A Convention | ✗ | ✗ | — | med | **high** | none |
| B Assignment-only | ◐ | ✓ | ✓ | **high** | low | none |
| C Boolean toggle | ✓ | ✓ | ✗ (dup of column) | low | low | small |
| D Hard-coded columns | ✓ | ✗ (breaks #1) | ✓ | low | low | med + migration |
| **E Column roles** ★ | ✓ | ✓ | ✓ | low | low | med (1 migration + UI) |
| F Mention-driven | ◐ | ✓ | ✗ | **high** | med | none |

---

## 5. The ③ Handback contract (the anti-runaway, anti-head-spin half)

Readiness gets work *started* safely; the handback contract keeps you *in the
loop* and stops the agent running off. Regardless of which ① option we pick,
encode this as the expected flow (and put it in the `using_kbrelay` skill so
every agent follows it):

```
   ┌─────────┐   human moves    ┌────────┐  agent picks up   ┌─────────────┐
   │ Backlog │ ───(deliberate)─▶│ READY  │ ────(auto)───────▶│ IN PROGRESS │
   │ (inert) │                  │ role   │  sets in_progress │  role       │
   └─────────┘                  └────────┘   + comments      └──────┬──────┘
        ▲                                                            │ done
        │ human sends back with a note                              ▼
   ┌─────────┐   human closes (or  ┌────────┐  agent finishes  ┌───────────┐
   │  DONE   │◀──agent, if told)──│ REVIEW │◀────(auto)───────│  the work  │
   │  role   │                     │ role   │ + handoff comment └───────────┘
   └─────────┘                     └────────┘
```

Rules that make it feel safe and intuitive:
1. **The human meters the faucet, one card at a time.** Making a card `ready` is
   a per-card act (drag it in, or assign-into-ready). Want to authorize a batch?
   Drag five. Want to think first? Leave them in Backlog. *You* control the flow
   rate — that's the anti-runaway valve.
2. **The agent shows its hand immediately.** On pickup it moves the card to
   `in_progress` and drops a one-line "taking this" comment. So you *see*
   something happening the moment it does — no head-spinning "wait, what did it
   touch?" (`in_progress` role exists mostly for this visibility.)
3. **Finished work always lands in `review`, never `done`** — unless the card /
   comment explicitly says "you may close it." The human owns done. This is the
   single most important anti-runaway rule: **nothing auto-completes.**
4. **Every finish posts a `handoff` on the timeline** (what changed, evidence,
   how to verify) and @-mentions the requester → you get the KBR-8 notification.
   Anti-dead-air: work visibly progresses and pings you.
5. **Blocked/questions go to a comment + @mention (and optionally a `blocked`
   role column), not silence.** If the agent can't proceed, it says so on the
   card and stops — it does not guess.

---

## 6. How the agent actually finds its work (the `/loop` predicate)

The readiness model only pays off if the agent's query is trivial and
unambiguous. With **column roles (Option E)** the predicate is clean:

> **actionable(me) = cards where `assignee = me` AND `column.role = 'ready'`**
> *(optionally scoped to a project)*

That maps directly onto the kind of `/loop` @leif floated:

- `/loop 10m work any actionable tickets assigned to me` → drains the predicate
  tenant-wide.
- `/loop work any tickets assigned to me in KBR that are ready` → project-scoped;
  Claude picks a dynamic interval.

**Proposed API affordance to make this bulletproof:** a first-class
**`GET /api/v1/me/queue`** (or `GET /api/v1/projects/:id/cards?actionable=true`)
that returns exactly the actionable set — assignee = caller, column role =
`ready`, ordered by position. Then the `/loop` prompt doesn't have to encode any
column knowledge at all: *"work my queue."* This also becomes the MCP tool the
agent calls (e.g. `list_my_queue`), so the loop is one tool call → work → move to
review. Compare to today, where the agent must `list_cards` and *guess* which
column means ready. (Contrast with Option F, where the agent has to parse free
text to decide if a mention is even a work order.)

---

## 7. What "Ready for Agent Work" vs "Ready for Work" should be

@leif asked whether the toggle/column should be agent-specific. **Recommend:
actor-agnostic "Ready."** Because routing is already handled by the assignee
(Invariant #2), a single `ready` state serves both: a `ready` card assigned to a
human is the human's to pick up; assigned to an agent, the agent works it. One
concept keeps the board legible and honors the human⇄agent symmetry. An
agent-only "Ready for Agent Work" lane would fork the model and re-introduce the
"which column means what" ambiguity we're trying to kill.

(If you ever want "an agent may grab *unassigned* ready cards from a pool," that's
a deliberate future extension — `ready` + `assignee = null` + a project setting
"agents may self-assign." Off by default; explicitly not in this proposal, to
avoid runaway.)

---

## 8. Tie-in to KBR-8 (the callback trigger is the readiness transition)

The push mechanism and the readiness signal must share **one** definition of
"actionable," or they'll drift. So:

- **Fire the callback when a card *enters* the actionable state:** it transitions
  into a `ready`-role column while assigned to an agent, **or** it's assigned to
  an agent while already in a `ready` column. That single transition is what the
  KBR-8 outbound webhook emits (→ channel event / routine `/fire`).
- **Retract/no-op** when it leaves `ready` (moved to in_progress/review, or
  reassigned). Idempotent.
- This means the *same act* — dragging a card into Ready — both (a) authorizes
  the work and (b) pushes it to the agent. Maximally intuitive: one gesture, and
  the thing that means "go" is the thing that makes the agent go.

Net: KBR-8's reusable outbound-webhook feature and this doc's column-role model
compose into the full loop:

```
you drag card → Ready (assigned to Claude)
      │
      ├─▶ kbRelay fires webhook (KBR-8) ──▶ channel event / routine /fire
      │                                              │
      └─ card is now in the actionable queue         ▼
         (GET /me/queue)                     Claude picks it up:
                                             → in_progress + "taking this"
                                             → does the work
                                             → In Review + handoff + @you
```

---

## 9. Recommendation

**Adopt Option E (column roles) + assignment routing + the §5 handback
contract.** Concretely, for a v0.15.0 build:

1. **Schema (additive):** `columns.role` nullable enum
   (`ready` | `in_progress` | `review` | `done`; null = neutral). Migration
   leaves all existing columns null → **zero behavior change** until opted in.
2. **Defaults:** new projects get a starter column set with roles pre-wired
   (e.g. Backlog=null, Ready=`ready`, In Progress=`in_progress`,
   In Review=`review`, Done=`done`). Existing projects: owner sets roles in
   Project Settings → Columns (a small role picker/badge).
3. **Actionable predicate + API:** `GET /me/queue` (assignee = me AND role =
   ready) and an MCP `list_my_queue` tool; keep `assignee` + `column` filters too.
4. **Handback contract** documented in `using_kbrelay` + surfaced in the MCP
   guide: pick up → `in_progress` + comment; finish → `review` + handoff; human
   owns `done`.
5. **KBR-8 trigger** = "enters actionable state" (§8), reusing that doc's
   outbound webhook.
6. **Optional, deferrable:** the boolean `cards.ready` toggle (Option C) *only*
   if user testing shows people want readiness without modeling it as a column.
   I'd ship E first and see.

**Why not the toggle or hard-coded columns as primary:** the toggle creates a
second source of truth that can contradict the board (§3-C); hard-coded columns
break kbRelay's customizable-columns promise (§3-D). Column roles give the
semantic weight of D and the flexibility of C with a single source of truth — and
they make the "go" gesture the drag you're already doing.

**Should we encode a flow at all?** Yes — but *lightly*. Encode the **minimum
semantics** (which column is Ready / Review / Done via roles) + a **documented
contract** (handback to review, human closes). Don't encode a rigid pipeline.
That gives predictability (no dead air, no runaway) while leaving each team's
actual board shape to them.

---

## 10. Open questions for @leif

1. **Roles vs. toggle:** comfortable making readiness a **column role** (my rec),
   or do you specifically want a card-level **checkbox** you can flip
   independent of columns?
2. **How many roles carry weight?** Minimum is `ready` + `review`. Do you want
   `in_progress` (agent-shows-its-hand visibility) and `done` (close semantics)
   too? I lean yes on both — cheap, and they power the anti-head-spin feedback.
3. **Auto-`in_progress` on pickup:** should the agent *move* the card to
   in_progress itself (my rec), or just comment and leave it in Ready?
4. **Can an agent ever move to `done`?** Rec: only when the card/comment
   explicitly authorizes it; default is human-closes. Agree?
5. **Unassigned "pool" work** (agent self-grabs any `ready` card in a project):
   want it as a future opt-in, or never?
6. **Default column set:** OK to ship new projects with the 5-lane default
   (Backlog / Ready / In Progress / In Review / Done, roles pre-wired)?
</content>
