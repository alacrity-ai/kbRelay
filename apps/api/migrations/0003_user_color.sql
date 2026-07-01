-- 0003_user_color.sql — give users a color (v0.2.0).
--
-- A card's display color is now its assignee's color, so color is a property
-- of the user, not the card. Additive + backfill only; the nullable column is
-- inert for any user without an explicit color (the API fills a stable
-- deterministic fallback from the shared palette at read time).
--
-- Seeded identities: Claude = red, Leif = blue, Joe = green.

ALTER TABLE users ADD COLUMN color TEXT;

UPDATE users SET color = '#dc2626' WHERE id = 'u_claude'; -- red
UPDATE users SET color = '#3b82f6' WHERE id = 'u_leif';   -- blue
UPDATE users SET color = '#16a34a' WHERE id = 'u_joe';    -- green
