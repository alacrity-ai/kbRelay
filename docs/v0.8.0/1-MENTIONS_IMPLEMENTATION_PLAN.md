# kbRelay — v0.8.0 Implementation Plan: @-Mentions & Notifications

Sequences the work behind `0-MENTIONS_DESIGN.md`. Order matters: shared pure
logic (with tests) → schema → repos → routes → openapi → web → docs → deploy
(migrate → Worker → Pages).

---

## Guiding decision recap (from the design)
- Mentions are a **live projection** of text. Every write **reconciles**:
  add newly-present recipients, delete newly-absent ones, leave survivors
  (preserving `read_at`). **Presence, not count** — a location holds ≤1 mention
  per user regardless of occurrences.
- Location = `(recipient, card, source_kind, source_id)`; `source_id` NOT NULL.
- **Listing is side-effect-free**; read-state changes only via explicit ack.

---

## Step 1 — Shared: pure logic + types (`packages/shared`)

**`src/mentions.ts` (new, pure — the heuristics live here so they're unit-testable
without D1):**
- `parseHandles(text: string): string[]` — distinct, lowercased handles matched by
  `/(?:^|[^\w@])@([a-z0-9](?:[a-z0-9_-]{0,30}))/gi`. Emails don't match; repeats
  collapse (this is the "count doesn't matter" guarantee).
- `resolveMentionRecipients(text, users: {id,handle}[], authorId): string[]` —
  parseHandles → map handle→userId (tenant users) → drop unknown → **drop
  author** (no self-mention) → distinct userIds.
- `diffRecipients(wanted: string[], existing: string[]): { add: string[]; remove: string[] }`
  — the reconcile diff (survivors implicitly untouched).
- Types: `MentionSourceKind = 'summary'|'description'|'acceptance_criteria'|'comment'`;
  `MentionDto` (id, cardId, cardKey, cardSummary, projectId, projectCode,
  projectName, source {kind, commentId}, excerpt, authorUserId, createdAt, readAt);
  `MentionsResponse { mentions: MentionDto[]; unreadCount: number }`.
- `markMentionsReadInput` zod: `{ mentionIds?: string[]; all?: boolean }`
  (`.refine` one-of).

**`src/board.ts` / `src/auth.ts`:** add `handle: string | null` to `UserDto`
(needed by the web for autocomplete + chip rendering).

**`src/index.ts`:** `export * from './mentions.ts'`.

**Tests `src/mentions.test.ts`** — the full heuristic matrix from design §11:
parser (valid/multiple/email-safe/unknown/self/case/punctuation/repeat-collapse),
`resolveMentionRecipients` (drops author + unknown, distinct), `diffRecipients`
(add-only, remove-only, mixed, no-op when unchanged), and the count invariant
(`@joe ×3`→`×1` = no change; `×3`→`×0` = remove).

---

## Step 2 — Migrations

**`0007_mentions.sql`:**
```sql
ALTER TABLE users ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX idx_users_tenant_handle ON users(tenant_id, handle);

CREATE TABLE card_mentions (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  card_id           TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  author_user_id    TEXT NOT NULL,
  source_kind       TEXT NOT NULL,
  source_id         TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  read_at           INTEGER
);
CREATE UNIQUE INDEX idx_mentions_dedup
  ON card_mentions(tenant_id, recipient_user_id, card_id, source_kind, source_id);
CREATE INDEX idx_mentions_recipient
  ON card_mentions(tenant_id, recipient_user_id, read_at, created_at);
```

**`0008_backfill_handles.sql`** (explicit-by-id, safe to re-run, no-op elsewhere):
```sql
UPDATE users SET handle = 'leif'   WHERE id = 'u_leif'   AND handle IS NULL;
UPDATE users SET handle = 'joe'    WHERE id = 'u_joe'    AND handle IS NULL;
UPDATE users SET handle = 'claude' WHERE id = 'u_claude' AND handle IS NULL;
```

---

## Step 3 — API repos

**`db/repos/users.ts`:** add `handle` to `UserRow` + `toUserDto` (SELECT it in
`listUsers`); handle may be null.

**`db/repos/mentions.ts` (new):**
- `SOURCE_FIELD` helpers; `newId('men')`.
- `reconcileStmts(env, {tenantId, card, authorId, sourceKind, sourceId, text}, users): Promise<D1PreparedStatement[]>`
  — load current recipients for the location, compute `diffRecipients` against
  `resolveMentionRecipients(text, users, authorId)`, return INSERT stmts for adds
  and DELETE stmts for removes (composed into the caller's batch).
- `deleteForCardStmt(env, tenantId, cardId)` / `deleteForCommentStmt(env, tenantId, evtId)`.
- `listMentions(env, tenantId, userId, status)` — JOIN cards + projects (+ for
  `comment` source, card_events) to build `MentionDto` with live `excerpt`,
  `cardKey` (project.code + '-' + seq), project fields; order `read_at IS NULL`
  then `created_at DESC`; filter by status; also compute `unreadCount`.
- `markRead(env, tenantId, userId, { mentionIds?|all })` → `UPDATE … SET read_at`
  scoped to the caller; return new `unreadCount`.
- One shared `tenantUsersForMentions(env, tenantId)` fetch (id+handle) used by the
  reconcilers.

**`db/repos/cards.ts`:** thread reconciliation into the existing batches.
- `createCard`: after building insert, append `reconcileStmts` for `summary`,
  `description`, `acceptanceCriteria` (source_id = the literal field name) into the
  `env.DB.batch([...])`.
- `patchCard`: for each of `summary`/`description`/`acceptanceCriteria` **present in
  input** (`!== undefined`), append its `reconcileStmts` (using `next.*` text) to
  the batch. Omitted fields → skip (PATCH precision). Uses the same `users` fetch.
- `deleteCard`: add `deleteForCardStmt` to the delete batch.

**`db/repos/card_events.ts`:** `addComment` — after we know the new `evt_` id,
run `reconcileStmts` for `source_kind:'comment', source_id: id, text: body` in the
same batch as the insert (convert the single insert to a `batch`).

---

## Step 4 — API routes

**`routes/me.ts`** (or a new `routes/mentions.ts`): 
- `handleListMentions` — `GET /v1/me/mentions?status=unread|read|all` (default
  unread) → `listMentions`.
- `handleMarkMentionsRead` — `POST /v1/me/mentions/read` → `parseJson(markMentionsReadInput)` → `markRead`.

**`router.ts`:** register both under `/api/v1/me/mentions` and
`/api/v1/me/mentions/read`.

**`openapi.ts`:** add `Mention` schema; document both paths (parity test will
enforce). Bump nothing else.

---

## Step 5 — Web

**`lib/api.ts`:** `getMentions(status?)`, `markMentionsRead(body)`; extend
`UserDto` usage (handle now present).

**`components/Markdown.tsx`:** accept optional `users` (id+handle+name); a small
remark/tokenization step (or `urlTransform`-free pre-parse) renders `@handle` as a
`<span class="mention-chip">@Name</span>` when the handle resolves, else plain
text. Keep the no-raw-HTML safety.

**`components/MentionTextArea.tsx` (new):** wraps a `<textarea>`, watches for `@`,
shows a positioned popover of tenant users (name + handle + kind), keyboard nav,
inserts `@handle `. Reused by the card modal (Description, Acceptance criteria) and
the Timeline composer.

**`components/NotificationBell.tsx` (new):** bell button placed **left of the user
menu** in `BoardApp` topbar; badge = unread count (same pattern as `filter-count`).
Dropdown lists mentions tenant-wide, each row `"{author} mentioned you in {key}"` +
snippet + relTime; unread styling; "Mark all read". Row click → mark that one read
+ deep-link.

**Deep-link plumbing:** `BoardApp` holds `nav: { projectId, cardId, source } |
null`; bell sets it (switching `selected` project if needed). `Board` receives
`nav`, opens the matching card's `CardModal`, and passes the `source` target;
`CardModal`/`Timeline` scroll to the Description/AC section or the comment
(`evt_` id anchor). No router introduced.

**Polling:** in `BoardApp`, fetch unread mentions on mount + on the existing 20s
tick; keep count in state for the badge.

**`styles.css`:** `.mention-chip`, `.bell-btn`, `.notif-badge`, `.notif-dropdown`,
`.notif-row(.unread)`, `.mention-popover`.

---

## Step 6 — Docs
- `.claude/skills/USING_KBRELAY.md`: how to @-mention (type `@handle`), the
  `GET /me/mentions` + `POST /me/mentions/read` loop ("check your mentions and
  respond"), and the reconciliation semantics (editing text retracts mentions).
- `.claude/CONTEXT.md`: add mentions to "what's shipped" + primitives.
- `docs/v0.8.0/RELEASE_NOTES.md`.

---

## Step 7 — Verify & deploy
- `make test` (shared heuristics + api parity), `typecheck`, `lint`, `build`.
- Local D1: migrate, mint nothing new; smoke `@joe` create/edit/retract + list +
  ack via curl against `:8787`.
- Deploy: **migrate prod (0007+0008) → deploy Worker → deploy Pages.**
- Prod smoke: `@claude` in a card + a note → `GET /me/mentions` (as claude) → ack.

---

## Risks / watch-items
- **Batch size:** reconcile adds N inserts + M deletes per field; fine for D1
  batch. All mention writes stay inside the card/comment batch (atomic).
- **Null handles:** legacy users without a handle can't be mentioned (autocomplete
  omits them); backfill covers the seeded three. New users need a handle at mint
  time — follow-up to `mint-token.mjs` (note in release, low urgency).
- **Markdown chip parsing** must not mangle code spans/links; keep the tokenizer
  conservative (only transform `@handle` outside backticks) or accept plain `@x`
  inside code. MVP: transform on text nodes only.
