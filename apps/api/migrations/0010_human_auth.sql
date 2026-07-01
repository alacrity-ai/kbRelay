-- 0010_human_auth.sql — human authentication foundation (v0.10.0).
--
-- ADDITIVE-ONLY. See docs/v0.10.0/0-ROADMAP_PLAN.md §3a: the live `t_lala`
-- tenant and its 6 projects are in active daily use and must survive intact.
-- This migration only ADDs columns/tables/indexes and backfills the NEW
-- columns/tables; it never touches projects/cards/columns/card_events data.
--
-- Adds a second, parallel auth path (email + password + JWT cookie) alongside
-- the existing bearer-token auth, and the membership model that makes one
-- email able to belong to more than one tenant (foundation for Item 2 invites).

-- ── users become email-keyed identities ──────────────────────
-- `tenant_id` is RETAINED (nullable-in-spirit "origin tenant") so no existing
-- query breaks; `memberships` is the source of truth for access/role.
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_algo TEXT;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;

-- Globally-unique email. SQLite treats NULLs as DISTINCT, so the many
-- null-email agent rows never collide on this index.
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- ── memberships: which tenants a user can access, and their role ──
CREATE TABLE memberships (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',
  created_at  INTEGER NOT NULL,
  UNIQUE(tenant_id, user_id)
);
CREATE INDEX idx_memberships_user   ON memberships(user_id);
CREATE INDEX idx_memberships_tenant ON memberships(tenant_id);

-- ── password reset: store only the sha256 of a random single-use token ──
CREATE TABLE password_reset_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);

-- ── Behavior-preserving backfill for the live tenant (idempotent) ──
-- A membership for EVERY current t_lala user so no one vanishes when the
-- tenant's user reads move to `users JOIN memberships`. leif/joe are the
-- human owners → admin; claude is the agent → member.
INSERT OR IGNORE INTO memberships (id, tenant_id, user_id, role, created_at) VALUES
  ('m_lala_leif',   't_lala', 'u_leif',   'admin',  1751328000000),
  ('m_lala_joe',    't_lala', 'u_joe',    'admin',  1751328000000),
  ('m_lala_claude', 't_lala', 'u_claude', 'member', 1751328000000);

-- Backfill human emails with NULL passwords: leif/joe set a password via
-- forgot-password, or keep using their existing bearer token. Claude (agent)
-- stays email-less and token-only. Guarded on `email IS NULL` for idempotency.
UPDATE users SET email = 'leif@lalalimited.com', email_verified_at = 1751328000000
  WHERE id = 'u_leif' AND email IS NULL;
UPDATE users SET email = 'joe@lalalimited.com',  email_verified_at = 1751328000000
  WHERE id = 'u_joe'  AND email IS NULL;
