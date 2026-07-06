-- 0023 — multi-workspace (v0.18.0, KBR-96).
-- Remembers which tenant a multi-membership user last worked in so login
-- lands there (pickActiveTenant: last → origin → oldest membership).
-- Nullable; validated against a live membership at read time, so a stale
-- value (e.g. after removal from that tenant) degrades gracefully.
ALTER TABLE users ADD COLUMN last_tenant_id TEXT;
