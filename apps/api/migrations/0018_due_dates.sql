-- Due dates (v0.17.0, KBR-63): a single optional deadline per card.
-- Epoch ms, null = no due date. Additive only — safe on the live tenant.
ALTER TABLE cards ADD COLUMN due_at INTEGER;
