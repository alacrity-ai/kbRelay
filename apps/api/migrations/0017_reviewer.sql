-- v0.17.0 (KBR-61): reviewer on handback.
-- A single nullable pointer: who a review-lane card is waiting on. Not a
-- workflow — no approval states, no multi-reviewer. Additive only.
ALTER TABLE cards ADD COLUMN reviewer_user_id TEXT;
