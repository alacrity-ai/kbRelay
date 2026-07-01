# kbRelay — v0.8.0 Release Notes

**Date:** 2026-07-01
**Type:** Feature (data-model + API + web + docs)
**Live:** https://kbrelay.lalalimited.com

Adds **@-mentions** and an in-app + API **notification** system.

## What changed

### @-mentions
- Write **`@handle`** (e.g. `@leif`, `@claude`) in a card's **description**,
  **acceptance criteria**, or a **comment** (note/handoff) to notify that user.
- The card editors + comment composer have an **@-autocomplete** popover (tenant
  users, by name/handle). Rendered markdown shows mentions as **chips**.
- Users gained a unique-per-tenant **`handle`** (`leif`, `joe`, `claude`).

### Notifications
- **Web:** a **bell** in the navbar (left of the user menu) with an unread
  **badge**; its dropdown lists *"{author} mentioned you in {key}"* rows that
  **deep-link** to the exact card and **scroll/flash** the mention (a comment
  scrolls to that comment). Click marks it read; **"Mark all read"** clears the
  rest. Cross-project mentions show (labeled by key); deep-link switches project.
- **API (the agent inbox):** `GET /v1/me/mentions` returns every place you're
  mentioned (cardKey, source, live excerpt, author). `POST /v1/me/mentions/read`
  acknowledges (`{mentionIds}` or `{all:true}`). Enables *"check your mentions and
  respond to them."*

### Semantics (the important invariants)
- **Listing is side-effect-free.** A mention is only cleared by an explicit ack —
  so an agent's *list → act → ack* loop is crash-safe. `GET` defaults to unread;
  `?status=all|read` for history.
- **One mention per location.** `@joe ×50` in one note = **1** mention;
  description + AC + two notes = **4**. Presence, not count.
- **Mentions are a live projection of text.** Every write **reconciles**: adding a
  handle creates a mention, editing it out **retracts** it (only when the last
  occurrence is gone — `@joe ×3 → ×1` keeps it), and survivors keep their
  read-state. Deleting a card/comment deletes its mentions. `excerpt` is derived
  live, never a stale snapshot.
- **Self-mentions / unknown handles / emails** never notify.

## API contract
- **UserDto** `+ handle`. New **Mention** schema.
- **New routes:** `GET /v1/me/mentions`, `POST /v1/me/mentions/read`.
- `openapi.json` updated; router↔spec parity test green.

## Migrations
- `0007_mentions.sql` — `users.handle` (+ unique index); `card_mentions` table
  with the dedup unique index `(tenant_id, recipient_user_id, card_id,
  source_kind, source_id)` (`source_id` NOT NULL so NULLs don't defeat dedup) and
  a recipient/unread lookup index.
- `0008_backfill_handles.sql` — handles for the seeded users (`leif`/`joe`/
  `claude`), explicit-by-id and idempotent. No historical mentions to backfill.

## Verify & deploy
- `typecheck` ✓ · `lint` ✓ · `test` (30 shared incl. 21 mention-heuristic + 27
  api = 57) ✓ · `build` ✓.
- **Local D1 lifecycle smoke** (real DB) proved every reconcile heuristic:
  create → 1/location; note → +1; `@claude ×3 → ×1` = **no retract** (count stays,
  read-state kept); remove last → **retract**; clear a field → retract; move-only
  PATCH → mentions untouched; ack → unread 0 (read row persists in `?status=all`);
  card delete → mentions gone.
- Order: **migrate prod (0007+0008) → deploy Worker → deploy Pages.**

## Not in scope
Comment edit/delete (the reconcile + delete helpers exist and are covered by the
pure heuristic tests, ready for that patch), group mentions (`@here`), mark-unread/
snooze, email/push delivery, mention chips in the raw editor. New users need a
handle at mint time (follow-up to `mint-token.mjs`).
