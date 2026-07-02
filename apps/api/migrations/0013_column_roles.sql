-- 0013_column_roles.sql — semantic roles on columns (v0.15.0).
--
-- Columns stay fully customizable (name/color/order); an optional `role` gives a
-- column semantic weight so humans and agents share one definition of "ready",
-- "in review", etc. without hard-coding column names. NULL = neutral (e.g.
-- Backlog). Roles: ready | in_progress | review | done | blocked.
--
-- Additive + behavior-preserving: `role` had no meaning before, so setting it
-- changes nothing for the live t_lala tenant. The backfill below only wires
-- roles for columns whose names ALREADY match the canonical set exactly;
-- ambiguous names (Todo, Backlog) are left NULL for the owner to assign — we do
-- not guess which lane is "ready". Idempotent (guarded by `role IS NULL`).
--
-- See docs/v0.15.0/2-HUMAN_AGENT_FLOWS_DESIGN.md §3.

ALTER TABLE columns ADD COLUMN role TEXT;

CREATE INDEX idx_columns_role ON columns(project_id, role);

UPDATE columns SET role = 'blocked'     WHERE role IS NULL AND name = 'Blocked';
UPDATE columns SET role = 'ready'       WHERE role IS NULL AND name = 'Ready';
UPDATE columns SET role = 'in_progress' WHERE role IS NULL AND name = 'In Progress';
UPDATE columns SET role = 'review'      WHERE role IS NULL AND name = 'In Review';
UPDATE columns SET role = 'done'        WHERE role IS NULL AND name = 'Done';
