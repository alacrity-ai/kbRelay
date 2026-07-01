-- 0008_backfill_handles.sql — assign @-mention handles to the seeded users.
--
-- Explicit-by-id and idempotent (guarded on handle IS NULL), so it is safe to
-- re-run and a no-op on any database that lacks these ids. New users get a
-- handle at mint time; there is no historical mention data to backfill.

UPDATE users SET handle = 'leif'   WHERE id = 'u_leif'   AND handle IS NULL;
UPDATE users SET handle = 'joe'    WHERE id = 'u_joe'    AND handle IS NULL;
UPDATE users SET handle = 'claude' WHERE id = 'u_claude' AND handle IS NULL;
