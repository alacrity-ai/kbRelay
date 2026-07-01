-- 0001_init.sql — kbRelay core schema.
--
-- Single tenancy dimension: `tenant_id` on every scoped row. Cards and
-- columns also carry tenant_id denormalized so every query filters on it
-- directly. All timestamps are unix milliseconds (INTEGER), matching
-- Date.now() on the Worker.
--
-- See docs/v0.0.0/0-HIGH_LEVEL_DESIGN.md §4–5.

CREATE TABLE tenants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

-- Actors within a tenant. `kind` = 'human' | 'agent' (the "was it Claude?"
-- provenance signal). `role` is a nullable forward-compat hook — unenforced
-- until RBAC lands.
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'human',
  role        TEXT,
  created_at  INTEGER NOT NULL,
  UNIQUE(tenant_id, name)
);

-- Bearer credentials. We store only the sha256 hash of the plaintext token,
-- never the token itself. A user may hold several tokens.
CREATE TABLE api_tokens (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  label         TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  revoked_at    INTEGER
);

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE columns (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  position    REAL NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE cards (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_id           TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  acceptance_criteria TEXT,
  color               TEXT,
  position            REAL NOT NULL,
  assignee_user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by          TEXT NOT NULL REFERENCES users(id),
  updated_by          TEXT NOT NULL REFERENCES users(id),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

-- Auth hot path.
CREATE INDEX idx_api_tokens_hash    ON api_tokens(token_hash);
CREATE INDEX idx_users_tenant       ON users(tenant_id);
-- Scoped list queries.
CREATE INDEX idx_projects_tenant    ON projects(tenant_id);
CREATE INDEX idx_columns_project    ON columns(project_id);
CREATE INDEX idx_cards_project      ON cards(project_id);
CREATE INDEX idx_cards_column       ON cards(column_id);
CREATE INDEX idx_cards_assignee     ON cards(assignee_user_id);
