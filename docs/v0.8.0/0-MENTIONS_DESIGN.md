# kbRelay — v0.8.0 Design: @-Mentions & Notifications

**Date:** 2026-07-01
**Status:** Design (pre-implementation)
**Depends on:** v0.3.0 timeline (comments), v0.7.0 ticket keys.

---

## 1. Goal

Let any tenant user (human **or** agent) **@-mention** another user inside a
card's text. Each mention becomes a **notification** for the mentioned user,
surfaced two ways:

- **Web** — a notification **bell** in the navbar (left of the user-name button)
  with an unread **badge**; its dropdown lists *"UserA mentioned you in OBL-2"*
  rows that **deep-link** to the exact spot (open the card modal, scroll to the
  mention).
- **API** — `GET /v1/me/mentions` returns every place the caller is mentioned
  (ticket key, location, the text, who mentioned them). This is the payoff: an
  agent can be told *"check your mentions and respond to them"* and loop over its
  own inbox — read each mention, comment on that ticket, acknowledge.

This is the coordination primitive kbRelay exists for: **directed, actionable,
API-drivable attention** on top of the existing provenance + timeline.

---

## 2. The headline question — when is a mention "seen"?

> *Does calling the list endpoint empty the queue, or must you visit the mention
> location?*

### Decision: **Listing never clears. Acknowledgment is a separate, explicit call.**

`GET /v1/me/mentions` is **side-effect-free**. Marking a mention read is a
distinct action: `POST /v1/me/mentions/read`.

**Why not "list = clear":**

1. **HTTP contract.** GET must be safe/idempotent. A GET that mutates state
   surprises every caller (proxies, retries, the browser prefetching, a curl to
   inspect). An agent that lists twice would lose its inbox the second time.
2. **"Listed" ≠ "handled".** The whole point is the agent *acts* on each mention
   (comments on the ticket). If listing cleared them and the agent crashed after
   item 3 of 10, items 4–10 are silently lost. The human said "respond to all" —
   partial failure must leave the rest visibly pending.
3. **Re-checking is normal.** A human glances at the bell repeatedly; an agent
   may re-list to confirm. Neither should erase anything.

**Why not "clear only when you visit the location" (auto-ack on card open / on
posting a reply):** too implicit. An agent might handle a mention *without*
commenting (it moves the card, or decides no action is warranted); a human might
open a card for unrelated reasons. Tying read-state to a side-effect of some
other action makes "what's unread" unpredictable. **Acknowledgment should be an
explicit statement of intent**, not a guessed side effect.

### The intended loops

**Agent:**
```
GET /v1/me/mentions                     # unread by default
for each mention:
    read mention.excerpt (+ optionally GET the card/timeline for context)
    POST /v1/cards/{cardId}/comments     # respond on that ticket
    POST /v1/me/mentions/read {ids:[m]}  # explicitly acknowledge this one
```
Crash-safe: anything not acked is still returned next time.

**Human (web):** the bell badge shows unread count. Clicking a **specific**
mention marks *that one* read and deep-links to it. A **"Mark all read"** action
clears the rest. Merely *opening the dropdown* does **not** clear anything.

Both surfaces use the same `read_at` column — one truth for read-state.

> Convenience, not magic: `GET /v1/me/mentions` defaults to **unread** so the
> agent's "respond to all" is a clean loop; `?status=all` returns history with
> each row's `readAt`.

---

## 3. What counts as one mention — the location invariant

A mention is deduplicated by **(recipient, card, location)**, where a *location*
is a single field or a single comment:

| Location kind         | Granularity                     |
|-----------------------|---------------------------------|
| `summary`             | one per card                    |
| `description`         | one per card                    |
| `acceptance_criteria` | one per card                    |
| `comment`             | one **per comment** (`evt_` id) |

So `@joe` ×50 inside one note → **1** mention. `@joe` in the description + the
acceptance criteria + note #1 + note #2 of the same card → **4** mentions (two
distinct fields + two distinct comments). This is exactly the rule you specified;
"comments" is *not* one bucket — each note/handoff is its own location.

Implementation: an **upsert keyed on the location** (`INSERT OR IGNORE` against a
unique index), so re-parsing a field that already mentions joe is a no-op.

---

## 4. Data model

### 4.1 User handles (new)

To detect mentions unambiguously we need a stable, collision-free token to type.
Display names (`"Leif"`, `"Claude"`) collide and contain spaces, so we add a
**handle**: a unique-per-tenant slug.

```sql
ALTER TABLE users ADD COLUMN handle TEXT;              -- e.g. "leif", "claude"
CREATE UNIQUE INDEX idx_users_tenant_handle ON users(tenant_id, handle);
```

- Autocomplete inserts `@handle`; the parser resolves `@handle` → user id within
  the tenant.
- Backfilled for existing users by explicit id (`u_leif`→`leif`, `u_claude`→
  `claude`), same pattern as the v0.7.0 code backfill. New users get a handle at
  mint time (`tools/mint-token.mjs`) — derived from the requested name, slugified,
  de-duplicated with a numeric suffix if taken.

**Why handles, not an embedded id-link token** (e.g. `@[Leif](mention:u_leif)`):
edit mode is **raw markdown**, so whatever we insert is what the human sees and
types. `@leif` reads cleanly; a link-token is noise. Handles are also the
familiar Slack/GitHub model, and `foo@bar.com` naturally won't match (the char
before `@` is a word char — see the parser below).

### 4.2 Mentions table (new)

```sql
CREATE TABLE card_mentions (
  id                 TEXT PRIMARY KEY,          -- men_...
  tenant_id          TEXT NOT NULL,
  card_id            TEXT NOT NULL,
  recipient_user_id  TEXT NOT NULL,             -- who was @-mentioned
  author_user_id     TEXT NOT NULL,             -- who wrote the mention
  source_kind        TEXT NOT NULL,             -- summary|description|acceptance_criteria|comment
  source_id          TEXT NOT NULL,             -- comment's evt_ id, else the source_kind literal
  created_at         INTEGER NOT NULL,
  read_at            INTEGER                     -- NULL = unread
);

-- The invariant: one mention per (recipient, card, location).
CREATE UNIQUE INDEX idx_mentions_dedup
  ON card_mentions(tenant_id, recipient_user_id, card_id, source_kind, source_id);

-- The bell's hot path: my unread, newest first.
CREATE INDEX idx_mentions_recipient
  ON card_mentions(tenant_id, recipient_user_id, read_at, created_at);
```

**`source_id` is NOT NULL on purpose.** SQLite treats `NULL` as *distinct* in
unique indexes, so a nullable `source_id` would let two `description` rows coexist
and break the invariant. For card fields we store the literal (`source_id =
'description'`); for comments the `evt_` id. Non-null everywhere → the unique
index actually dedupes.

Mentions carry **no copy of the text** — the `excerpt` in the API is derived live
by joining to the card field / comment body at read time, so it can never go
stale relative to an edit. A mention row is a *pointer*, not a snapshot. Lifecycle
(delete-on-card-delete, reconcile-on-edit) is covered in §5.1.

> **Note on generality.** We name this `card_mentions` and scope it to mentions
> rather than building a generic `notifications` fan-out table. A mention has
> exactly one recipient, so mention *is* the notification here. If assignment/
> due-date notifications arrive later they can generalize this; we don't
> speculatively build that now.

---

## 5. Mention detection (server-side, authoritative)

Parsing happens **on the server** at write time — never trust the client to tell
us who was mentioned.

**Parser:**
```
/(?:^|[^\w@])@([a-z0-9](?:[a-z0-9_-]{0,30}))/gi
```
- Leading `(?:^|[^\w@])` means an `@` preceded by a word char (as in an email
  `foo@bar`) does **not** match — emails are safe.
- Each captured handle is resolved against the tenant's users. Unresolved handles
  are just text (no mention). **Self-mentions are ignored** (no notifying
  yourself).

### 5.1 Reconciliation — mentions are a projection of live text

**The governing principle:** *the set of mentions for a location always equals the
set of distinct users currently @-mentioned in that location's text.* Mentions are
**derived**, not accumulated. So every write doesn't just *add* — it **reconciles**
the stored mentions to match the new text:

```
reconcile(location, newText):
  wanted   = resolve(@handles in newText) − {author}      # distinct recipients now present
  existing = SELECT recipient FROM card_mentions WHERE (tenant, card, source_kind, source_id)
  INSERT the (wanted − existing)     # newly added mentionees  → new unread mention
  DELETE the (existing − wanted)     # mentionees edited out    → yanked from their bell
  # (wanted ∩ existing) is left untouched → preserves read_at + createdAt, no re-notify
```

This single primitive is the whole lifecycle. It replaces the append-only model
from an earlier draft: **if you edit `@joe` out of a description or acceptance
criteria, joe's mention is deleted** — it disappears from his bell and his
`GET /me/mentions`, because it no longer exists in the text. A mention with no
backing text is a lie; we don't keep it.

**Presence, not count — the retraction rule, made explicit.** A location holds at
most **one** mention per user regardless of how many times the handle appears.
Reconciliation compares the *set* of distinct users, so:

- Description has `@joe` **×3**, you edit it down to `@joe` **×1** → joe is *still
  present* → his mention (and its read-state) is **untouched**. No retract.
- Description has `@joe` **×3**, you remove **all 3** → joe is *absent* → his
  mention is **retracted** (deleted).
- Description has `@joe ×3` **and** `@sue ×1`, you remove all of joe's and keep
  sue → joe retracted, sue untouched.

The count of occurrences is never stored and never matters; only "is this user in
the current text, yes/no." This is why the dedup key is `(recipient, card,
location)` with no occurrence count.

Read-state is preserved for survivors: editing a field that *still* mentions joe
leaves his row (and its `read_at`) alone — no thrash, no spurious re-notify.
Removing then re-adding across separate saves does mint a fresh (unread) mention,
which is correct: the text genuinely lost and regained the mention.

### 5.2 Where reconciliation fires (the general pattern)

The same principle covers every text mutation — including the comment edit/delete
coming in the next patch. Mentions follow the text, always:

| Event                                   | Mention action                                             |
|-----------------------------------------|------------------------------------------------------------|
| Create card / **edit** a card field     | `reconcile` that field (`summary`/`description`/`acceptance_criteria`) |
| Clear a card field (set null/empty)      | `reconcile` → empties → **deletes** that field's mentions   |
| Add a comment                            | `reconcile` the new comment (`source_id = evt_ id`)         |
| **Edit a comment** *(next patch)*        | `reconcile` that comment against its new body               |
| **Delete a comment** *(next patch)*      | **delete** all mentions for that comment                    |
| **Delete a card**                        | **delete all** mentions for the card (every field + every comment) |

Two delete-only helpers cover teardown (no parsing needed):
`deleteMentionsForCard(cardId)` and `deleteMentionsForComment(evtId)`. Card
deletion runs its mention-delete in the **same `env.DB.batch([...])`** as the card
+ card_events deletion, so a card can't vanish while its mentions linger (which
would leave dangling bell entries pointing at a 404).

**PATCH precision.** On `PATCH /cards/:id`, only fields *present in the parsed
input* are reconciled — `input.description !== undefined`, etc. A pure move
(`{columnId, position}`) touches no mentions. A `{description: ""}` genuinely
clears the field and deletes its description mentions. (Zod distinguishes an
omitted field, `undefined`, from an explicit `null`/`""` — we key off that.)

Reconcile add/deletes are composed into the **same batch** as the card / comment
write, so text and its mentions move together atomically (the repo already uses
this pattern for card+event atomicity).

---

## 6. API

All under the existing bearer-auth, tenant-scoped router.

### `GET /v1/me/mentions`
Query: `status=unread` (default) `| read | all`. Recipient is always the token's
own user. Newest first. `all`/`read` capped (e.g. 100) with newest kept; `unread`
returns all.

```jsonc
{
  "mentions": [
    {
      "id": "men_...",
      "cardId": "card_...",
      "cardKey": "OBL-2",            // v0.7.0 key, may be null on un-keyed legacy
      "cardSummary": "Ship the measurement spine",
      "projectId": "proj_...",
      "projectCode": "OBL",
      "projectName": "Orderbase - Launch",
      "source": { "kind": "comment", "commentId": "evt_..." },  // commentId null for card fields
      "excerpt": "…full text of the field or comment body…",     // context without extra calls
      "authorUserId": "u_leif",
      "createdAt": 1751000000000,
      "readAt": null
    }
  ],
  "unreadCount": 3
}
```
`excerpt` carries the **full text of the location** (bounded by the 20k field
cap), **derived live** at read time by joining the mention to its card field /
comment body — never a stored snapshot, so it always reflects the current text
(and, since a live mention means the handle is still present, it always contains
the mention). The agent can still `GET /v1/cards/:id` / `…/timeline` for the whole
card. Everything needed to *act* — which ticket (`cardKey`), where (`source`), the
ask (`excerpt`), from whom (`authorUserId`) — is in the row.

### `POST /v1/me/mentions/read`
```jsonc
{ "mentionIds": ["men_a", "men_b"] }   // or  { "all": true }
```
Sets `read_at` on the caller's own matching mentions (can only ack your own).
Idempotent. Returns `{ "unreadCount": N }`.

*(A `.../unread` inverse is deferred — not needed for the core loops.)*

### Router additions
```
GET  /api/v1/me/mentions
POST /api/v1/me/mentions/read
```
`openapi.json` schemas updated; router↔spec parity kept (enforced by the existing
test).

---

## 7. Web UX

### 7.1 @-autocomplete
A reusable mention-autocomplete over the text inputs where mentions are authored:
**Description**, **Acceptance criteria** (textareas in the card modal), and the
**comment composer** (Timeline). *(Summary is a single-line input; mentions there
are unusual but still parsed server-side. Autocomplete on it is optional — see
open items.)*

Behavior: typing `@` opens a popover of tenant users (name + handle + kind badge),
filtered as you type; ↑/↓ + Enter or click inserts `@handle ` at the caret; Esc
dismisses. Data comes from the already-loaded `users` list — no new fetch.

### 7.2 Rendering mention chips
The `Markdown` component (used in card view + timeline comments) renders `@handle`
as a styled **chip** showing `@DisplayName` (resolved from the tenant user map we
pass in), so readers see friendly names while storage stays handle-based.
Unresolved `@foo` renders as plain text.

### 7.3 The bell
- New navbar button **left of the user menu**, mirroring the filter badge
  treatment: a **count badge** of unread mentions.
- **Unread count** is polled on the existing 20s board-refresh cadence (a light
  `GET /v1/me/mentions?status=unread`), so the bell stays live without a new
  timer.
- Clicking opens a dropdown listing mentions **tenant-wide** (see §8, decision #1),
  each row: *"{author} mentioned you in {cardKey}"* + a snippet + relative time,
  visually distinguishing unread. A **"Mark all read"** action at the top.

### 7.4 Deep-link
Clicking a row: (a) `POST …/read` for that mention, (b) switch the active project
if the mention is in another project, (c) open that card's modal, (d) scroll to
the source — the Description/AC section, or for a `comment` the specific timeline
event (`evt_` id anchor). Implemented via BoardApp navigation state
(`{projectId, cardId, source}`) threaded to `Board` → `CardModal`/`Timeline`; no
router is introduced (consistent with the current modal-by-state approach).

---

## 8. Confirmed decisions & edge cases

1. **Cross-project mentions show in the bell** (tenant-wide), each labeled with
   its key; deep-linking switches project first. Hiding them would silently drop
   notifications — the bell's job is "you're wanted *somewhere*."
2. **Self-mention** → no notification.
3. **Unknown handle** → plain text, no mention.
4. **Dedup** by (recipient, card, location); repeats within a location collapse to
   one. Distinct fields/comments are distinct mentions.
5. **Mentions track live text (§5.1–5.2).** Presence, not count: editing a
   handle out of a field/comment **retracts** that user's mention (only once the
   *last* occurrence is gone); a surviving mention keeps its read-state and is not
   re-notified. Deleting a card/comment deletes its mentions.
6. **Read-state** is explicit (§2): list is safe; `read` marks; opening a specific
   mention marks that one; "Mark all read" for the rest.
7. **Authorization** — you can only list/ack **your own** mentions; all queries
   tenant-scoped.
8. **Card deletion** deletes all its mentions (fields + comments), atomically
   with the card. Comment deletion/edit (next patch) reconciles the same way.
9. **Emails** (`a@b.com`) don't match the parser.

---

## 9. Out of scope (deferred)

- Generic notification types beyond mentions (assignment, due-date, moves).
- Mark-**unread** / snooze.
- Email/push/webhook delivery (in-app + API only).
- Editing a comment (comments remain immutable, so no re-parse needed).
- `@here`/`@everyone` group mentions.
- Rich mention chips in the raw editor (edit mode stays raw markdown by design).

---

## 10. Migrations

- `0007_mentions.sql` — `users.handle` + unique index; `card_mentions` table +
  its two indexes.
- `0008_backfill_handles.sql` — set handles for the existing tenant users by
  explicit id (`u_leif`→`leif`, `u_claude`→`claude`); no-op elsewhere. Same
  hardcoded-by-id, safe-to-re-run shape as v0.7.0's backfill.

No backfill of historical mentions (there are none — the feature is new).

---

## 11. Testing

The reconciliation heuristics are the subtle, breakable part — they get first-class
unit coverage, not just a manual smoke. Explicitly scoped in the impl plan:

**Parser (pure, `packages/shared`):**
- resolves a valid handle; multiple distinct handles in one string.
- `foo@bar.com` and `a@b` do **not** match (email safety).
- unknown handle → no recipient; self-handle → excluded.
- case-insensitivity; punctuation-adjacent (`(@joe)`, `@joe.`, `@joe,`); a handle
  repeated N times collapses to **one** distinct recipient.

**Reconciliation (repo, api — the retraction heuristics):**
- add: text gains `@joe` → one mention created (unread).
- **count-invariant / no false-retract:** `@joe ×3` → edit to `@joe ×1` → mention
  **unchanged**, `read_at` preserved.
- **retract-on-last:** `@joe ×3` → edit to `@joe ×0` → mention **deleted**.
- mixed: `@joe ×3, @sue ×1` → remove all joe, keep sue → joe deleted, sue kept.
- add + remove in one edit: `@joe` → `@sue` → joe deleted, sue created.
- **read-state survival:** joe reads mention → field edited but still `@joe` →
  still read (no new unread).
- **re-add across saves:** `@joe` → remove (deleted) → re-add later → fresh
  *unread* mention.
- **per-location independence:** `@joe` in description + AC + note#1 + note#2 → 4
  mentions; removing joe from AC leaves the other 3.
- **PATCH precision:** a move-only PATCH (`{columnId, position}`) changes no
  mentions; `{description: ""}` clears description mentions; an omitted field is
  left alone.
- **card delete** removes all its mentions (fields + comments), atomically.
- **comment-delete/edit hooks:** the delete-helper and reconcile-helper are unit
  tested now (even though the comment-edit/delete *routes* land next patch) so the
  primitives are proven before they're wired up.
- read-state transitions (`unread`→`read` via ack, idempotent); tenant isolation
  (can't list/ack another tenant's or another user's mentions); `?status`
  filtering; `unreadCount` accuracy.

**Contract:** router↔openapi parity for the two new routes.

**Manual (prod-like):** author `@claude` across description + AC + two notes on one
card → bell shows 4 → `GET /me/mentions` returns 4 with correct keys/excerpts →
edit `@claude` out of one note → bell drops to 3 → agent comments + acks → unread
→ 0 → deep-link opens card & scrolls to a comment → delete the card → its mentions
gone from the bell.

---

## 12. Open items for the impl plan

- Whether to also wire @-autocomplete onto the single-line **Summary** input
  (server parses it regardless; this is only about the typing affordance).
- Exact `all`/`read` history cap and whether to paginate (MVP: cap 100, no
  paging).
- Chip styling (neutral vs. author/recipient color).

Once this is signed off, the sibling doc `1-MENTIONS_IMPLEMENTATION_PLAN.md` will
sequence the shared-types → migration → repo → routes → openapi → web work and the
deploy order (migrate → Worker → Pages).
