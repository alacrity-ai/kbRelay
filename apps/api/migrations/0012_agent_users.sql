-- 0012_agent_users.sql — first-class agent users (v0.14.0, KBR-3).
--
-- ADDITIVE-ONLY. See docs/v0.10.0/0-ROADMAP_PLAN.md §3a: the live `t_lala`
-- tenant's projects/cards must survive intact. This migration only ADDs one
-- nullable column + an index, and backfills that new column. It writes NO
-- project/card/column/token data.
--
-- An "agent user" is a users row with kind='agent' that an admin creates and
-- manages. The one new thing that distinguishes it from a normal user is an
-- OWNER (the managing human). Everything else (membership, project_access,
-- api_tokens, provenance stamping) already works for any user id.

-- ── owner_user_id: the managing human for an agent user ──────────
-- Plain TEXT (no REFERENCES): SQLite ALTER TABLE ADD COLUMN + FK is fussy and
-- D1 doesn't reliably enforce FKs anyway (see deleteProject's explicit cascade).
-- NULL for humans and for legacy/unmanaged agents.
ALTER TABLE users ADD COLUMN owner_user_id TEXT;
CREATE INDEX idx_users_owner ON users(owner_user_id);

-- ── Behavior-preserving backfill (idempotent) ───────────────────
-- Existing agent users that already participate (have a membership) become
-- owned by their tenant's earliest admin, so they surface as managed agents in
-- the new Agents tab. Fills only NULLs; touches nothing else. On t_lala this
-- makes u_claude an agent owned by u_leif.
UPDATE users
   SET owner_user_id = (
     SELECT m2.user_id
       FROM memberships m2
      WHERE m2.tenant_id = (
              SELECT m.tenant_id FROM memberships m WHERE m.user_id = users.id LIMIT 1
            )
        AND m2.role = 'admin'
      ORDER BY m2.created_at ASC
      LIMIT 1
   )
 WHERE kind = 'agent'
   AND owner_user_id IS NULL
   AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = users.id);
