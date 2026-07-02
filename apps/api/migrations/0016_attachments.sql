-- 0016_attachments.sql — file attachments on cards (v0.16.0, KBR-22 → KBR-25).
--
-- A file hung off a card's description (event_id NULL) or a specific timeline
-- comment — a note or handoff (event_id set). Bytes live in blob storage (R2 on
-- Cloudflare, filesystem when self-hosted); this row is the metadata + the blob
-- key. `kind` is classified server-side (image/document/archive/misc) for the
-- board badge row. Additive + a brand-new table: existing rows/tenants are
-- untouched, so the live t_lala tenant simply has zero attachments until one is
-- created. See docs/v0.16.0/0-ATTACHMENTS_DESIGN.md §2.
CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id       TEXT NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,
  event_id      TEXT REFERENCES card_events(id)      ON DELETE CASCADE,
  blob_key      TEXT NOT NULL,
  filename      TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  kind          TEXT NOT NULL,
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_attachments_card  ON attachments(tenant_id, card_id);
CREATE INDEX idx_attachments_event ON attachments(event_id);
