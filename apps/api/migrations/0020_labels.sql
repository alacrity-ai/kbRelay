-- Labels (v0.17.0, KBR-62): flat, per-project, capped at 12 (enforced in the
-- repo). Unique name per project, case-insensitive. Additive only.
CREATE TABLE labels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_labels_project_name ON labels(project_id, lower(name));
CREATE INDEX idx_labels_project ON labels(tenant_id, project_id);

CREATE TABLE card_labels (
  tenant_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (card_id, label_id)
);
CREATE INDEX idx_card_labels_label ON card_labels(label_id);
