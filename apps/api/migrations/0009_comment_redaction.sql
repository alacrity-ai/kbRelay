-- 0009_comment_redaction.sql — soft-delete (redaction) for card comments (v0.9.0).
--
-- The timeline stays append-only; the only new power is redacting a comment's
-- CONTENT (leaked secret / PII / wrong card) while keeping the row as a tombstone
-- (who removed it, when). System events are never redacted. On redaction the
-- caller nulls body + meta_json; these columns record the tombstone.

ALTER TABLE card_events ADD COLUMN deleted_at INTEGER;   -- NULL = live comment
ALTER TABLE card_events ADD COLUMN deleted_by TEXT;      -- user who redacted it
