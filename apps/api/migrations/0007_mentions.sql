-- 0007_mentions.sql — @-mentions & notifications (v0.8.0).
--
-- Adds a unique-per-tenant @-mention handle to users, and a card_mentions
-- table. A mention is a live projection of text: exactly one row per
-- (recipient, card, source location). `source_id` is NOT NULL so the unique
-- index actually dedupes (SQLite treats NULLs as distinct in unique indexes);
-- for card fields it holds the field literal, for comments the card_events id.

ALTER TABLE users ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX idx_users_tenant_handle ON users(tenant_id, handle);

CREATE TABLE card_mentions (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  card_id           TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,       -- who was @-mentioned
  author_user_id    TEXT NOT NULL,       -- who wrote the mention
  source_kind       TEXT NOT NULL,       -- summary | description | acceptance_criteria | comment
  source_id         TEXT NOT NULL,       -- comment's evt_ id, else the source_kind literal
  created_at        INTEGER NOT NULL,
  read_at           INTEGER              -- NULL = unread
);

-- The invariant: one mention per (recipient, card, location).
CREATE UNIQUE INDEX idx_mentions_dedup
  ON card_mentions(tenant_id, recipient_user_id, card_id, source_kind, source_id);

-- The bell's hot path: a user's mentions, unread first, newest first.
CREATE INDEX idx_mentions_recipient
  ON card_mentions(tenant_id, recipient_user_id, read_at, created_at);
