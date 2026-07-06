-- 0022_card_links.sql — external links on cards (Jira/GitHub URLs, etc.).
--
-- A pointer from a card to an external system: a Jira issue, a GitHub PR, a doc.
-- `provider` names the system (free text, e.g. "jira"/"github"); `external_key`
-- is that system's own id when known (e.g. "OBL-1234", "org/repo#42") so a card
-- can be found by it — nullable because a bare URL is fine too. `title` is an
-- optional human label. Additive + a brand-new table: existing rows/tenants are
-- untouched. Same SQLite dialect for D1 and libsql — no per-backend changes.
CREATE TABLE card_links (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id      TEXT NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,
  provider     TEXT NOT NULL,
  external_key TEXT,
  url          TEXT NOT NULL,
  title        TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_card_links_card   ON card_links(tenant_id, card_id);
CREATE INDEX idx_card_links_lookup ON card_links(tenant_id, provider, external_key);
