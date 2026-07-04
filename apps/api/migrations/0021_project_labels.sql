-- Project labels (KBR-84): tenant-wide buckets ("Side gigs", "Day Job",
-- "Home stuff") a project can carry several of. Unlike card `labels` (0020),
-- which are per-project, these are scoped to the whole TENANT. Flat, capped in
-- the repo, unique name per tenant (case-insensitive). Additive only.
CREATE TABLE project_labels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_project_labels_tenant_name ON project_labels(tenant_id, lower(name));
CREATE INDEX idx_project_labels_tenant ON project_labels(tenant_id);

CREATE TABLE project_label_links (
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (project_id, label_id)
);
CREATE INDEX idx_project_label_links_label ON project_label_links(label_id);
