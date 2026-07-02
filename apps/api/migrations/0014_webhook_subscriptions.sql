-- 0014_webhook_subscriptions.sql — callback events / push transport (KBR-16).
--
-- Outbound webhooks that fire when a card becomes actionable (enters a `ready`
-- column while assigned to an agent) or an agent is @-mentioned, so a Claude
-- Code channel / routine can react without waiting for the /loop poll.
--
-- `webhook_subscriptions` is tenant infra (the delivery target: url + signing
-- secret + optional target agent), admin-managed. The per-project
-- `agent_events_enabled` valve mutes a board without tearing down the tenant
-- subscription. Additive + behavior-preserving: no subscription ⇒ nothing fires
-- (the service short-circuits, like mailgun when unconfigured), so the live
-- t_lala tenant is unaffected until an admin opts in.
--
-- See docs/v0.15.0/4-CALLBACK_EVENTS_DESIGN.md.

CREATE TABLE webhook_subscriptions (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label                TEXT NOT NULL,
  url                  TEXT NOT NULL,
  secret               TEXT NOT NULL,          -- HMAC signing secret (see design §9)
  target_agent_user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = any agent
  enabled              INTEGER NOT NULL DEFAULT 1,
  created_by           TEXT NOT NULL REFERENCES users(id),
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX idx_webhooks_tenant ON webhook_subscriptions(tenant_id);

-- Per-project mute valve. Default ON: once a tenant subscription exists, every
-- board participates unless explicitly muted. Additive; existing rows read as 1.
ALTER TABLE projects ADD COLUMN agent_events_enabled INTEGER NOT NULL DEFAULT 1;
