# kbRelay — v0.9.0 Design: Comment Redaction (soft-delete)

**Date:** 2026-07-01
**Status:** Design (pre-implementation)
**Depends on:** v0.3.0 timeline, v0.8.0 mentions.

---

## 1. Decision & rationale

The card timeline is an **audit trail**. Its value is that it faithfully records
what happened and who said what, when — humans and agents both rely on it to relay
work. So the default stays **append-only**: to correct a comment, post a follow-up
(more honest than a silent edit — it preserves both the mistake and the fix, and
is already the idiom here).

We add **exactly one** new power, because it's the one thing a follow-up can't
provide: the ability to **remove content that must not persist** — a leaked
credential/token, PII, or a comment on the wrong card. This is **redaction**, not
deletion:

> 🗑 *Comment removed by Claude · 14:32*

The content is genuinely gone (from the row, and therefore from `GET /me/mentions`
excerpts and everywhere else it surfaced), but the **row remains as a tombstone**
in its original chronological slot. You redact *content*; you never erase the
*event*. That keeps the audit property — "something was here, who removed it, when"
— while solving the security-shaped need.

**Explicitly not built:** comment *edit* (use a follow-up), hard-delete, and any
hidden shadow copy of redacted text (that would re-introduce "the secret still
exists somewhere").

## 2. Invariants / guards

1. **Comments only.** `note` and `handoff` are redactable. **`system` events
   (created/moved/assigned/edited) are never redactable** — they are the immutable,
   machine-generated audit spine. → `400`.
2. **Author-only.** You can only redact **your own** comment. → `403`. (Owner-
   moderation is deferred until RBAC exists.)
3. **Idempotent.** Redacting an already-redacted comment is a no-op `200` returning
   the tombstone.
4. **Tenant-scoped** like every other route; a comment on another tenant's card is
   a `404`.
5. **No shadow copy.** Redaction nulls `body` and `meta_json`. The content is not
   retained anywhere.
6. **Mentions retract.** A redacted comment's @-mentions are deleted (they no longer
   point at live text) — the recipient's bell/`GET /me/mentions` drop them. This
   reuses `deleteMentionsForCommentStmt` (built in v0.8.0), run in the same batch.

## 3. Data model

```sql
-- 0009_comment_redaction.sql
ALTER TABLE card_events ADD COLUMN deleted_at INTEGER;   -- NULL = live
ALTER TABLE card_events ADD COLUMN deleted_by TEXT;      -- who redacted
```

A redacted row keeps `id`, `card_id`, `author_user_id`, `kind`, `created_at`
(the tombstone facts) and sets `deleted_at`/`deleted_by`, with `body` and
`meta_json` nulled.

**`CardEventDto`** gains `deletedAt: number | null` and `deletedBy: string | null`.
When `deletedAt` is set, `body` and `meta` are `null` on the wire.

## 4. API

**New route:** `DELETE /api/v1/cards/{cardId}/comments/{commentId}`
(DELETE = redact). Returns `{ event }` (the tombstone DTO). Errors: `400` (system
event), `403` (not author), `404` (card/comment not found or cross-tenant).

No new request body. `openapi.json` documents the route; the CardEvent schema
gains the two fields. Router↔spec parity test covers it.

There is **no** system event emitted for a redaction — the tombstone itself is the
record (avoids a redundant second entry).

## 5. Web

- **Timeline:** a redacted comment renders as a muted tombstone —
  `🗑 Comment removed by {name} · {relTime}` — in place (no body, no handoff slots).
- **Redact control:** a small "Remove" affordance on **your own**, non-redacted
  comments; opens the themed confirm dialog ("The content will be permanently
  removed. This can't be undone.") then `DELETE`s and reloads the timeline. The
  server enforces author-only regardless, but the button only shows on your own.
- Needs the current user id in the Timeline → drill `meId` (BoardApp → Board →
  CardModal → Timeline). Server is authoritative; `meId` only gates the affordance.

## 6. Testing

- **Unit (shared, pure):** `classifyRedaction(event, userId)` — the guard heuristic:
  system → not_comment; other-author → not_author; own live → allowed; own already-
  redacted → allowed+idempotent. This is the breakable logic; it's pure and tested.
- **Manual (local + prod):** redact own note → body gone from timeline + tombstone
  shows; redact a `@`-mention note → recipient's `GET /me/mentions` drops it;
  redact someone else's comment → 403; redact a system event → 400; redact twice →
  idempotent 200; deleting the card still removes tombstones.
- **Contract:** router↔openapi parity for the new route (automatic test).

## 7. Migration & deploy

`0009_comment_redaction.sql` (two nullable columns — additive, safe). Deploy order:
**migrate prod → Worker → Pages** (so the DTO fields and the code reading them land
together).

## 8. Out of scope (deferred)

Comment edit, owner/admin moderation (redact others' — needs RBAC), un-redact,
redaction reason/audit-of-redactions beyond `deleted_by`/`deleted_at`, redacting
system events.
