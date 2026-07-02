-- 0015_user_profile.sql — free-text user profile / persona (KBR-21).
--
-- A short self-description ("CTO", "backend dev — terse, wants tradeoffs", …).
-- Surfaced on UserDto + /me so agents can understand WHO assigned them work and
-- how to read that person's feedback. Additive + nullable: existing users read
-- as NULL, no behavior change for the live t_lala tenant.
ALTER TABLE users ADD COLUMN profile TEXT;
