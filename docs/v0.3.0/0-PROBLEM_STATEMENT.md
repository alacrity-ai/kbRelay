# kbRelay — Problem Statement: the card has a spec but no log (v0.3.0)

**Date:** 2026-07-01
**Status:** problem statement + proposed direction (implementation doc to follow)
**Predecessors:** `docs/v0.0.0/` (MVP), `docs/v0.1.0/` (UX polish), `docs/v0.2.0/` (user color, auto-refresh, navbar)
**Live:** https://kbrelay.lalalimited.com

---

## 1. The incident that surfaced this

An agent (Claude) picked up a real card — **"AG-1 · Ship the measurement spine"** on
the `buildmylease.com` project — did the work, and moved it to **In Review**. To
hand it back to a human it needed to say *what shipped, how it was verified, and
what follow-ups it spun off*. There was nowhere to put that, so it **appended a
block to the card's `description`**:

```
--- DONE 2026-07-01 (Claude) — SHIPPED TO PROD, awaiting human verify ---
Committed on develop as 2eebfff ... prod smoke passed ... two carry-overs ...
```

That works, and given the constraints it was the right call. But it is **wrong by
design**, and the owner flagged it immediately: *this information should be
first-class, not a mutation of the description.*

This isn't a one-off. Our own agent guide (`USING_KBRELAY.md` §5–6) literally
instructs agents to do it:

> "there are no comments in v0 — put status notes in the description or acceptance
> criteria" … "Notes go in the card. v0 has no comments/activity feed, so put
> progress notes, blockers, and results in the `description` (append; don't wipe
> the original)."

So the board's primary users — humans **and** agents relaying work to each other —
are being told to corrupt the spec because there's nowhere else to write.

---

## 2. What's actually wrong (the diagnosis)

A card carries two fundamentally different kinds of text, and today only one of
them has a home:

| | **Spec** | **Log** |
|---|---|---|
| What it is | "what to do / how we'll know it's done" | "what happened" |
| Fields today | `description`, `acceptance_criteria` | *(none)* |
| Natural edit mode | **rewritten in place** — edits improve the plan | **append-only**, never overwritten |
| Natural attribution | the author of record (`created_by`) | *per entry*, whoever wrote it, when |
| Tied to | the card | a **moment**, usually a state transition |

The log has no home, so it leaks into the spec. Concretely this causes:

1. **Spec rot.** `description` and `acceptance_criteria` stop being a trustworthy
   statement of the work and become a chat transcript. The next reader can't tell
   the plan from the play-by-play.
2. **Lost history.** Provenance today is **last-write-wins**: `cards.updated_by` /
   `updated_at` (see `0001_init.sql`) only remember the *most recent* toucher. On a
   human↔agent relay board, the sequence of who-did-what-when **is the product**,
   and we throw it away on every `PATCH`. The one signal the board exists to
   provide — "was it Claude, and what did it do?" — is the one we don't persist.
3. **Follow-ups buried as prose.** Half of what the agent appended (`OPS_API_TOKEN`
   unset, a staged CookiePolicy change, a dev-DNS gap) wasn't about AG-1 at all —
   it was **newly discovered work**, entombed in a Done ticket's description where
   nobody will action it.
4. **No safe handoff surface.** "In Review" is a handoff, but the reviewer has no
   place that says *what to verify* and *what evidence backs it* — so that, too,
   goes into the description.

This was a **known, documented deferral** (v0.1.0 non-goals: "No comments /
attachments / checklists / activity feed"). v0.3.0 is where it stops being deferred.

---

## 3. The one anti-solution to name and reject

The tempting fix is a scalar card field — `completion_notes` (or `result`,
`handoff_notes`). **We should not do this.** It reproduces the exact problem one
column over:

- It's **singular**, so it either gets **overwritten** (history lost again) or
  **grows unbounded** (a second description).
- It's **phase-named** ("completion"), but notes are needed **in progress** (a
  blocker) and **at review** (what to verify) too — a field named for one moment
  fits none of the others.
- It **divorces the note from its moment**. The value of the AG-1 note is that it
  belongs to the *Todo→In Review transition*, by *Claude*, at *that time*. A
  floating field loses all three.

The information isn't a *field*. It's a *log*.

---

## 4. Proposed direction: give the card a timeline

Add the missing primitive — a **per-card activity timeline** — and route each kind
of information to where it belongs.

### 4.1 The core: an append-only `card_events` timeline

One table, append-only (mirrors the "audit log takes no UPDATE/DELETE" discipline
we already trust elsewhere). Two sources of entries:

- **System events** — emitted automatically by the card handlers on **move**
  (`column_id` change), **assign** (`assignee_user_id` change), **create**, and
  **field edits**. This is the fix for the lossy `updated_by`: instead of
  overwriting last-touch, we *keep* it as a stream. "Claude moved this Todo→In
  Review" becomes durable history, computed from data we already have.
- **Comments** — authored markdown, attributed + timestamped. The AG-1 "what
  shipped" note becomes a **comment posted at the instant the card moved to In
  Review**, sitting directly under that move event — exactly where a reviewer
  reading top-to-bottom expects it. The description stays a clean spec.

Sketch (`0004_card_activity.sql`), consistent with `0001_init.sql` conventions
(denormalized `tenant_id`, ms timestamps, cascade on card delete):

```sql
CREATE TABLE card_events (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id        TEXT NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id),          -- the actor; system events use the acting token's user
  kind           TEXT NOT NULL,                        -- 'comment' | 'handoff' | 'system'
  event_type     TEXT,                                 -- system only: 'created'|'moved'|'assigned'|'edited'
  body           TEXT,                                 -- markdown, for comment/handoff
  meta_json      TEXT,                                 -- structured slots (see 4.2 / 4.3)
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_card_events_card ON card_events(card_id, created_at);
```

New endpoints, following the existing router shape
(`/api/v1/cards/:id`, sub-resources under a parent):

```
POST /api/v1/cards/:id/comments   { type?: 'note'|'handoff', body, meta? }
GET  /api/v1/cards/:id/timeline    → system events + comments, merged chronologically
```

`created_by`/`updated_by` stamping already proves who the actor is, so every entry
is trustworthy for free. Deleting a card cascades its events.

### 4.2 Make the handoff a *typed* comment, not a new field

The move-to-review note is special enough to render distinctly, so give comments a
**type** (`note | handoff`). A `handoff` comment carries a few **soft slots** in
`meta_json` — it's still a timeline entry, so a card can be handed off → sent back →
handed off again, each its own dated record:

```jsonc
// what the agent should have POSTed instead of editing the description
{
  "type": "handoff",
  "body": "Measurement spine shipped + prod-smoke-verified.",
  "meta": {
    "summary": "UTM/gclid capture → D1 (0009) → ops export, live in prod",
    "evidence": ["commit:2eebfff", "deploy:buildmylease-api@6111ea4a", "gate:green"],
    "verify":   ["attributed prod draft captured PRODSMOKE123", "normal draft path intact"],
    "spun_off": ["card:set-OPS_API_TOKEN", "card:ship-cookiepolicy-after-HU3"]
  }
}
```

The web renders it as a highlighted **"✅ Handoff from Claude"** timeline entry
rather than a plain chat bubble. "Handoff" is the right name because it names the
**event** (crossing into review) and is naturally **plural** — where
"Completion Notes" names a phase and pretends to be singular.

### 4.3 Follow-ups become *cards*, not prose (stretch / may defer)

The sharpest point: discovered work (`OPS_API_TOKEN`, the staged CookiePolicy
change) should become **linked cards**, not notes. Minimum viable version ships
now — the handoff's `meta.spun_off` just lists card ids the agent created. A true
**card-link graph** (`relatesTo` / `blocks` / `discoveredFrom` edges) is a clean
follow-on and can be deferred past v0.3.0 without blocking the core fix.

---

## 5. Scope for v0.3.0

**In:**
- `card_events` table + migration `0004` (data-model + API release, like v0.2.0).
- `POST /api/v1/cards/:id/comments` and `GET /api/v1/cards/:id/timeline`.
- Auto-emit system events from the card create/patch/delete handlers (move,
  assign, create) — the durable replacement for lossy `updated_by`.
- `CardEventDto` + input zod schemas in `packages/shared`; `openapi.ts` entries so
  the router↔spec parity test stays green.
- Web: a **Timeline** section in the card modal (chronological, system events +
  comments), a comment composer, and the handoff highlight treatment. Read-first
  posture (v0.1.0) preserved — posting a comment is an explicit action.
- Update `USING_KBRELAY.md`: the new rule is *edit the description to change the
  plan; post to the timeline to report what happened; open a card for work you
  discovered.* Remove the "put notes in the description" guidance.

**Out (deferred, name them so it's a decision):**
- The full card-link graph (§4.3) beyond a `spun_off` id list.
- Editing/deleting comments (append-only for now; a redaction path can come later).
- @-mentions, reactions, attachments, real-time/websocket push (timeline still
  loads via the v0.2.0 auto-refresh poll).
- Turning `acceptance_criteria` into checkable items (a natural future: tie a
  handoff's `verify[]` to AC items).

---

## 6. Risk / rollback

- **Migration** is purely additive (one new table + index; no change to `cards`) →
  safe. Rollback is a redeploy of the prior Worker + Pages build; the unused table
  is inert.
- **Contract** is additive: two new endpoints + `CardEventDto`. Nothing existing
  changes shape, so current agents/clients keep working; the description-append
  workaround still functions during the transition.
- **Volume:** system events are low-cardinality (a handful per card); the
  `(card_id, created_at)` index keeps the timeline read cheap.
- **Backfill:** none required — history begins at launch. Existing description-
  embedded notes stay put; we don't migrate prose out of descriptions.

---

## 7. What "done" looks like

- An agent moving a card to In Review can **POST a handoff** and **never touch the
  description**; the reviewer sees it as the top entry of a clean **Timeline** with
  the summary/evidence/verify laid out.
- Moving or reassigning a card **leaves a durable system event** — the full
  who-did-what-when relay history is visible, not just last-write.
- `USING_KBRELAY.md` tells agents to use the timeline, and the description of a
  worked card reads like a **spec**, not a transcript.
