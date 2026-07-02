-- Card archiving (v0.17.0, KBR-60): archived cards keep their timeline,
-- attachments, and mentions — they just leave the board. Additive only.
ALTER TABLE cards ADD COLUMN archived_at INTEGER;
-- Optional per-project policy: lazily archive done-column cards older than
-- N days on board read (null = off). No cron, no scheduler.
ALTER TABLE projects ADD COLUMN auto_archive_done_days INTEGER;
