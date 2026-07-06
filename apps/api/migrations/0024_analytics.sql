-- 0024_analytics.sql — analytics read path (v0.19.0, KBR-103).
--
-- card_events' only index was (card_id, created_at) — the per-card timeline
-- hot path. Analytics scans events tenant-wide within a time window (completed
-- cards, throughput buckets, leaderboards), so give it a matching index.
CREATE INDEX idx_card_events_tenant_time ON card_events(tenant_id, created_at);
