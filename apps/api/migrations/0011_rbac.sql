-- 0011_rbac.sql — team management + binary project RBAC (v0.11.0).
--
-- ADDITIVE-ONLY. See docs/v0.10.0/0-ROADMAP_PLAN.md §3a: the live `t_lala`
-- tenant's 6 projects must survive intact. This migration writes NO
-- project/card/column data — only two new tables and a behavior-preserving
-- backfill into the new project_access table.
--
-- Access is BINARY: a project_access row = full read+write access to that
-- project; no row = none. Admins bypass (see everything). Members default-deny.

-- ── invites: hashed single-use tokens, same pattern as password resets ──
CREATE TABLE invites (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'member',
  token_hash         TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at         INTEGER NOT NULL,
  accepted_at        INTEGER,
  accepted_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  revoked_at         INTEGER,
  created_at         INTEGER NOT NULL
);
CREATE INDEX idx_invites_tenant ON invites(tenant_id);

-- ── project_access: row present = access; absent = none (no level column) ──
CREATE TABLE project_access (
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_access_user ON project_access(user_id);

-- ── Behavior-preserving backfill (critical for the live tenant) ──
-- Grant every existing member access to every existing project in their tenant,
-- so turning enforcement on hides nothing anyone can see today. Admins bypass
-- regardless. Pure INSERT — projects/cards are never read-modified. Idempotent.
INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
SELECT p.tenant_id, p.id, m.user_id, 1751328000000
  FROM projects p
  JOIN memberships m ON m.tenant_id = p.tenant_id;
