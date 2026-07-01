-- 0005_ticket_keys.sql — project codes + ticket keys (v0.7.0), schema.
--
-- A card gains a Jira-style human key CODE-N (e.g. OBL-1): the project carries a
-- short `code`, each card an integer `seq`, and the key is derived (code + '-' +
-- seq) at read time — not stored. `seq` is monotonic per project via the
-- project counter `card_seq` (never reused, even after a delete).
--
-- The old descriptive `title` becomes `summary`. All changes are additive except
-- the column rename (SQLite/D1 supports RENAME COLUMN).

ALTER TABLE projects ADD COLUMN code TEXT;
ALTER TABLE projects ADD COLUMN card_seq INTEGER NOT NULL DEFAULT 0;

ALTER TABLE cards RENAME COLUMN title TO summary;
ALTER TABLE cards ADD COLUMN seq INTEGER;

-- Codes are unique within a tenant so keys are unambiguous. NULL codes (legacy,
-- pre-backfill) are treated as distinct by SQLite, so this is safe to add now.
CREATE UNIQUE INDEX idx_projects_tenant_code ON projects(tenant_id, code);
