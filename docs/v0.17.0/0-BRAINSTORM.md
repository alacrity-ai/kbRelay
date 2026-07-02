# v0.17.0 Brainstorm — Top 10 High-Leverage Features (KBR-58)

**Status:** Brainstorm / analysis. Nothing here is committed; this ranks candidates for
what comes after v0.16.0 and answers three questions @leif posed:

1. Are we missing basic kanban niceties that would add a ton of value?
2. Are **sprints** worth it, so a project doesn't fill up indefinitely on one board?
3. Is an **"assign reviewer"** concept worth it?

**The lens used throughout:** kbRelay's moat is that it is *not* Jira-with-agents. It's a
stripped-down Trello with agent-native ergonomics — one data model, two surfaces, RBAC,
provenance, roles, queue, handback. Every candidate below is scored against that:
**a feature earns its place only if it deepens the relay loop or removes a real
day-to-day annoyance, without adding a new concept users must learn.** Cost is S/M/L
(S ≈ a day, M ≈ 2–4 days, L ≈ a release). Simplicity risk is the risk the feature drags
us toward Jira.

**TL;DR answers:** kanban niceties — yes, four cheap ones (checklists, archiving,
labels, due dates) cover most of the gap. Sprints — **no**; the real pain is board
accumulation, and **archiving** solves that without importing ceremony (#2). Assign
reviewer — **yes, the minimal version**; it completes the handback loop and gives
humans the queue that agents already have (#3).

---

## The ranked ten

### 1. Interactive checklists — make `- [ ]` toggleable (S)

**Problem.** Cards already *render* GFM task lists in descriptions and comments, and both
humans and agents naturally write acceptance criteria as `- [ ] …`. But ticking one off
means opening edit mode and hand-editing markdown. That's the single most common
micro-interaction on a kanban card, and today it has the worst ergonomics.

**Shape.** No new entity, no migration. In view mode, render task-list checkboxes as
live controls; a click rewrites that line's `[ ]`/`[x]` in the source field
(description or acceptanceCriteria) via the existing `PATCH /cards/:id`, which already
stamps `updated_by` and emits the edit event. Optionally show a `3/7` progress chip on
the board card (computed at read time by counting boxes — same trick as
`attachmentCounts`). MCP needs nothing: agents already edit the markdown directly.

**Why it beats a Checklist entity.** Trello's checklist is a separate object with its
own CRUD. Ours stays *text* — agent-writable, diffable, renderable everywhere,
zero schema. This is the purest example of "kanban nicety without a new concept."

**Simplicity risk: none.** Cost: S.

### 2. Card archiving + Done-column hygiene — the answer to "sprints?" (M)

**Problem.** The real question behind sprints: *a project fills up indefinitely on one
board.* KBR already has 37 cards after two weeks; Done grows forever, drag targets get
long, and `list_cards` payloads bloat (the KBR-58 list call already overflowed a tool
budget). Boards need an off-ramp for finished work.

**Shape.** Trello's answer, not Jira's: **archive the card, not the board.**

- `archived_at` (nullable) on cards — one additive migration. Archived cards keep their
  timeline, attachments, mentions rows; they just leave the board.
- Board + `GET /cards` exclude archived by default; `?archived=1` shows them; a
  project "Archive" view in the web with restore (unarchive drops it in the first
  role-less column, or Done).
- Bulk affordance where the pain lives: an **"Archive all" button on the `done`-role
  column header**, plus an optional per-project auto-archive policy ("archive Done
  cards after N days" — default off, one integer column; enforced lazily on read, not
  by a cron).
- MCP: `update_card` accepts `archived: true|false`; queue/mentions already can't
  surface archived cards because they're column-scoped.
- Ticket keys are never reused, so `KBR-12` stays resolvable forever — archive is
  where the "history without clutter" story lives.

**Recommendation on sprints: don't build them.** Sprints import planning ceremony,
a time dimension, velocity expectations, and "which sprint is this in?" as a question
every card must answer — the exact Jira-shaped gravity we're avoiding. Agents work
continuous-flow, not in cadences. If a team wants a cadence, a label (see #4) named
`2026-Q3` plus filters covers 80% of it with zero new schema. Archiving attacks the
actual complaint (accumulation) at ~10% of the concept cost.

**Simplicity risk: low** (one nullable column; the "policy" knob is the only thing to
keep minimal). Cost: M.

### 3. Reviewer on handback — the answer to "assign reviewer?" (M)

**Problem.** The handback contract ends with "move to `review` + @-mention the
requester." But a mention is a *notification*, not a *queue*. A human supervising
several agents has no "what's waiting on ME to review" view — they diff it out of the
bell and the In Review columns per project. Meanwhile the card stays assigned to the
agent, so assignee-based views point at the wrong person during review.

**Shape — the minimal version, and no more:**

- One nullable `reviewer_user_id` on cards (additive migration), same validation as
  assignee (must have project access).
- **Queue integration is the whole point:** `GET /me/queue` grows a second section —
  cards in a `review`-role column where `reviewer = me` (typed, so agents can
  distinguish "work this" from "review this"). Now the *human's* loop is symmetric
  with the agent's: agents drain `ready`, humans drain `review`. This makes kbRelay's
  most distinctive idea (role-driven relay) rounder rather than adding a new one.
- Handback convention (skill + MCP tool descriptions): when finishing, set `reviewer`
  to the requester (default: the card's creator) as you move to `review`.
  @-mention still fires as today; the webhook's assign-into-ready trigger gains a
  sibling `review_requested` trigger later if wanted — *not* in v1.
- Web: a second small avatar chip on the card (distinct ring/badge), a "Review
  requested from you" filter.

**What to refuse:** multi-reviewer, approve/reject states, required approvals, review
checklists. The column role *is* the state machine; reviewer is just "who the review
column is waiting on."

**Recommendation: yes.** It's one column + one queue section, and it completes the
relay: today the agent side of the loop is first-class and the human side is vibes.

**Simplicity risk: medium** — this is the feature most likely to grow states. Hold the
line at "a pointer, not a workflow." Cost: M.

### 4. Labels — flat, per-project, capped (M)

**Problem.** The only way to say "this is a bug" vs "this is a feature" is prose in the
summary. Filtering by kind of work — the second most-used Trello affordance — doesn't
exist. Agents would use this heavily when triaging ("list all `bug` cards").

**Shape.** Trello-grade, deliberately flat:

- `labels` table (per-project: name + color, additive migration) + `card_labels` join;
  cap at ~12 per project to keep them a *palette*, not a taxonomy.
- `GET /projects/:id/cards?label=` filter; board filter bar gains label chips; card
  modal gets a picker. List payload includes label ids per card (cheap join).
- MCP: `labels` on `create_card`/`update_card` (by name — agents shouldn't juggle
  label ids), surfaced on `get_card`/`list_cards`/`list_my_queue`.

**What to refuse:** global labels, label descriptions, nested labels, auto-label rules.

**Simplicity risk: medium-low.** Labels are the classic gateway to custom fields —
the cap and flatness are the guardrails. Cost: M.

### 5. Due dates — one timestamp, no scheduler (S/M)

**Problem.** "By when" has no home. For human⇄agent relay this matters at the edges:
a human wants "agent, have this ready by Friday"; a human reviewing wants to see what's
gone stale.

**Shape.**

- Single nullable `due_at` on cards. Board card shows a date chip: amber when near,
  red when past. Sort/filter by due date in the list endpoint.
- **No reminder engine.** The existing surfaces carry it: due-soon is visible on the
  board, present in `get_card`/queue payloads (agents can self-prioritize), and — later,
  if wanted — a third webhook trigger. No cron, no notification fan-out in v1.
- MCP: `dueAt` on create/update; queue sorts due-first.

**Simplicity risk: low** as specced; the risk is scope-creep into recurring dates and
reminders — refuse both. Cost: S/M.

### 6. "My Work" — the human home screen (M)

**Problem.** Agents get `list_my_queue` — one call, everything actionable, across all
projects. A human gets… nine boards to visit. The web app has no cross-project
"what needs me?" surface, and as project count grows (nine active already on this
tenant) that's the difference between kbRelay being *the* morning tab vs a thing you
check when nudged.

**Shape.** A `/me` page (default landing after login) with three lists, all from
existing or #3-extended endpoints:

1. **My queue** — assigned to me, `ready` (exists: `GET /me/queue`).
2. **Waiting on my review** — from #3.
3. **My mentions** — unread (exists: `GET /me/mentions`).

Each row: key, summary, project chip, one-click jump to the card. Zero new API if #3
lands first — this is almost pure web work, and it's the human mirror of the agent
loop.

**Simplicity risk: none** (it's a view). Cost: M.

### 7. Ticket-key autolinking (S)

**Problem.** People and agents already write `KBR-12` in descriptions, notes, and
handoff `spunOff` slots — as dead text. Cross-referencing work is the cheapest form of
a relations graph, and we get it for free from the key convention.

**Shape.** In the shared Markdown renderer, linkify `\b[A-Z]{2,6}-\d+\b` to the card
(resolve project by code, tenant-scoped; unknown keys stay plain text). Card modal
navigates in place. Optionally (phase 2) a lazy "Referenced by" strip on the card
computed by text search — no join table, no migration, no edge maintenance.

This intentionally **defers the full card-link graph** (already on the deferred list):
typed relations (blocks/duplicates) are Jira gravity; autolinks give 80% of the value
at ~5% of the cost.

**Simplicity risk: none.** Cost: S.

### 8. MCP attachment upload — close the parity gap (S/M)

**Problem.** v0.16.0 shipped attachments, but the MCP can only *read* them. The agent
loop wants the write path badly: "attach the screenshot/report to the handoff" is the
natural way to deliver evidence, and today it needs raw curl with a multipart body —
the one place the "everything the board can do, the API/MCP can do" story breaks.

**Shape.** New MCP tool `add_attachment(cardId, filePath | base64, filename)` →
posts multipart to the existing `POST /cards/:id/attachments`, returns the DTO with
URL + markdown snippet ready to embed; `attachmentIds` param on `add_comment` (API
already accepts it). Server changes: none. Also fixes the tool-budget footgun we hit
during this very brainstorm: attachments give agents a place to put *large* outputs
instead of pasting them into comments.

**Simplicity risk: none** (parity, not surface). Cost: S/M.

### 9. Project activity feed — supervision at a glance (M)

**Problem.** Every card has a timeline, but a supervising human can't answer "what did
the agents do today?" without opening cards one by one. As agent count grows, the
missing surface isn't more control — it's *observability*.

**Shape.** `GET /projects/:id/events?since=` — a read-only, paginated union of the
existing `card_events` (which already record create/move/assign/edit/comment with
actor + timestamps; **zero new writes**). Web: an "Activity" tab in the project
(actor avatar, verb, card key, relative time). MCP: `get_project_activity` so an agent
can catch up on what happened while it was away — genuinely useful for
multi-agent relay ("what did the other agent already do?").

**Simplicity risk: low** (pure projection of data we already store). Cost: M.

### 10. Global quick-find — Cmd+K (S/M)

**Problem.** Finding "that card about attachments" means picking a project, then the
filter box. Keys (`KBR-34`) are the lingua franca everywhere *except* navigation.

**Shape.** One endpoint `GET /search?q=` (tenant-wide, RBAC-filtered, matches key
prefix + summary; SQLite `LIKE` is fine at this scale) + a Cmd+K palette in the web:
type a key or words, enter to jump. Also list projects by name/code. Explicitly not
full-text search over descriptions/comments in v1.

**Simplicity risk: low.** Cost: S/M.

---

## Honorable mentions (real value, below the line)

- **WIP limit per column** — a soft `max_cards` with a red count when exceeded; classic
  kanban, cheap, and interesting for throttling agents. Didn't make the cut because
  roles + queue already meter agent pickup.
- **Daily digest email** — mailgun plumbing exists; "your queue + your mentions each
  morning." Wait for #6 to define what a "digest" even is.
- **Real-time board (SSE)** — 20s polling is honestly fine at current scale; webhooks
  cover the agent-latency case. Revisit when a board feels laggy in real use.
- **Saved filters / board views** — wait for labels to exist first.
- **Public read-only board link** — nice for clients someday; RBAC implications need
  care, don't rush it.

## Anti-features — hold the line

Explicitly *not* building, because each one is a step on the Jira staircase:

- **Sprints / iterations / velocity / burndown** (see #2 — archiving instead).
- **Estimates / story points / time tracking.** Agents make effort-accounting weird
  anyway; the queue is the capacity model.
- **Custom fields.** Labels (#4, capped) are the pressure valve. The card schema is
  the product.
- **Automation-rules engine** ("when X move to Y"). Agents *are* the automation; rules
  would compete with them and double the mental model.
- **Threaded comments.** The timeline's flatness is why handoffs read like a log.
- **Multiple assignees.** One assignee + one reviewer (#3) states exactly who's next.
- **Approval workflows / required reviewers.** Column roles are the whole state
  machine; keep it that way.
- **Comment editing** — stays deliberately omitted (append-only + redaction), per v0.9.0.

## Suggested shape of v0.17.0

If v0.17.0 is one coherent release, the theme writes itself: **"close the loop for
humans"** — #3 reviewer + #6 My Work + #2 archiving (they compound: queue symmetry,
a home screen that shows it, and boards that stay tidy), with #1 checklists and #7
autolinks as cheap riders. #8 (MCP upload) can ship any time as a pure-MCP patch
release. Labels/due dates (#4/#5) make a natural v0.18.0 "kanban niceties" pair, and
#9/#10 slot in wherever there's slack.

*(Analysis: KBR-58. Existing backlog checked for overlap — none of the above is
already ticketed; archiving relates to the deferred "card-link graph"/"real-time push"
list only in that it shares the keep-it-simple rationale.)*
