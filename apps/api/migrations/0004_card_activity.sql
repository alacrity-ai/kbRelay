-- 0004_card_activity.sql — give each card an append-only timeline (v0.3.0).
--
-- A card carries two kinds of text: a *spec* (description / acceptance_criteria,
-- rewritten in place) and a *log* (what happened, append-only). Until now the log
-- had no home and leaked into the description. This table is the log.
--
-- Two sources of rows:
--   • system events  — auto-emitted on create/move/assign/edit (the durable
--     replacement for lossy cards.updated_by: we KEEP the who-did-what-when
--     stream instead of overwriting last-touch).
--   • comments       — user-authored 'note' or 'handoff' entries.
--
-- Append-only by discipline (no UPDATE/DELETE except cascade on card delete).
-- Conventions match 0001_init.sql: denormalized tenant_id, ms timestamps.
-- NOTE: deletes are cascaded EXPLICITLY in the repo layer (D1 FK enforcement is
-- not reliably on) — the ON DELETE CASCADE below is documentation.

CREATE TABLE card_events (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id        TEXT NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id),   -- the acting user (always set in practice)
  kind           TEXT NOT NULL,               -- 'system' | 'note' | 'handoff'
  event_type     TEXT,                        -- system only: 'created'|'moved'|'assigned'|'edited'
  body           TEXT,                        -- markdown, for note/handoff
  meta_json      TEXT,                        -- JSON: system detail slots OR handoff slots
  created_at     INTEGER NOT NULL
);

-- Timeline read hot path: all events for a card, in order.
CREATE INDEX idx_card_events_card ON card_events(card_id, created_at);
