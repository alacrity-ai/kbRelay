# kbRelay — v0.9.0 Release Notes

**Date:** 2026-07-01
**Type:** Feature (data-model + API + web + docs)
**Live:** https://kbrelay.lalalimited.com

Adds **comment redaction** — a narrow, audit-safe soft-delete for the timeline.

## Why
The timeline is an audit trail, so it stays **append-only**: corrections are
follow-up comments (more honest than a silent edit). The one thing a follow-up
can't do is **remove content that must not persist** — a leaked credential/token,
PII, or a comment on the wrong card. Redaction is exactly that, and nothing more.

## What changed

### Redaction (soft-delete)
- **`DELETE /v1/cards/{cardId}/comments/{commentId}`** redacts a comment: nulls its
  `body` + `meta` and leaves a **tombstone** in place — the content is gone, but
  the row remains showing *who removed it, when*. You redact content; you never
  erase the event.
- **Guards:** **author-only** (`403` otherwise); **system events cannot be
  redacted** (`400`) — they're the immutable audit spine; **idempotent** (redacting
  twice is a no-op `200`); tenant-scoped.
- **Mentions retract:** a redacted comment's @-mentions are deleted (they no longer
  point at live text), so they drop from recipients' bells and `GET /me/mentions`.
- **No shadow copy:** the redacted text is not retained anywhere.

### Web
- A redacted comment renders as a muted tombstone: *🗑 Comment removed by {name} ·
  {time}*, in its original chronological slot.
- A subtle **"Remove"** control appears on your **own** comments (reveals on hover),
  behind a themed confirm dialog. The server enforces author-only regardless.

### Not built (deliberate)
Comment **edit** (use a follow-up), hard-delete, owner/admin moderation of others'
comments (needs RBAC), un-redact.

## API contract
- **CardEventDto** `+ deletedAt` `+ deletedBy` (both null for live rows; a redacted
  comment has `body`/`meta` null).
- **New route** `DELETE /v1/cards/{id}/comments/{commentId}`; `openapi.json` +
  router↔spec parity test updated.

## Migration
- `0009_comment_redaction.sql` — `card_events.deleted_at` + `deleted_by` (two
  nullable columns; additive, safe).

## Verify & deploy
- `typecheck` ✓ · `lint` ✓ · `test` (34 shared incl. 4 new `classifyRedaction` +
  28 api = 62) ✓ · `build` ✓.
- **Local D1 smoke:** author redacts own comment → body+meta nulled, tombstone
  (`deletedBy`/`deletedAt` set), secret gone from the timeline (`grep` = 0),
  comment's mention retracted; non-author → 403; system event → 400; redact twice →
  idempotent 200.
- **Prod smoke** (Leif author, Claude non-author): openapi documents the route +
  fields; non-author redact → 403; author redact → `PRODSECRET999` gone from
  timeline; Claude's mention retracted → 0; temp project deleted (no prod
  residue). Worker `ff32a923…`; web bundle `index-ynekDMD0.js`; health ok.
- Order: **migrate prod (0009) → Worker → Pages.**

## Notes
The comment-scoped mention-delete helper this reuses shipped in v0.8.0; the guard
heuristic (`classifyRedaction`) is pure and unit-tested. This is the "delete" half
of the v0.8.0 forward-looking note on comment edit/delete — **edit was
intentionally dropped** in favor of append-only + redaction.
