-- 0026: billing (KBR-135 / KBR-138).
-- Per-human-seat subscription billing for kbRelay Cloud. App-driven recurring
-- billing on Square (Customers + Cards-on-file + Payments) with a daily Worker
-- cron sweep — see docs/v0.23.0/0-BILLING_DESIGN.md. The FEATURE is config-
-- gated (enabled iff SQUARE_ACCESS_TOKEN is set), so this schema is inert on
-- self-host installs; migrations stay shared between D1 and libsql.

-- One row per tenant (hosted only in practice). status:
--   trialing | active | past_due | delinquent | expired | canceling | canceled | exempt
CREATE TABLE billing_state (
  tenant_id          TEXT PRIMARY KEY REFERENCES tenants(id),
  status             TEXT NOT NULL,
  plan               TEXT,                      -- 'monthly' | 'annual' (null until subscribed)
  -- Per-seat MONTHLY price in cents (annual per-seat = x10, the "$50/yr" shape).
  -- Null = list price. Setting it is the founding-customer / custom-deal lever.
  unit_monthly_cents INTEGER,
  trial_ends_at      INTEGER,
  paid_through       INTEGER,                   -- renewal anchor (ms epoch)
  pending_plan       TEXT,                      -- plan switch applied at next renewal
  square_customer_id TEXT,
  square_card_id     TEXT,
  card_brand         TEXT,
  card_last4         TEXT,
  card_exp           TEXT,                      -- 'MM/YYYY', display only
  grace_until        INTEGER,                   -- past_due deadline before delinquent
  retry_count        INTEGER NOT NULL DEFAULT 0,
  trial_notice_7_at  INTEGER,                   -- T-7 reminder sent (dedupe)
  trial_notice_1_at  INTEGER,                   -- T-1 reminder sent (dedupe)
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

-- One row per (tenant, billing period) — the double-charge guard. The invoice
-- id seeds the Square payment idempotency key.
CREATE TABLE billing_invoices (
  id                 TEXT PRIMARY KEY,          -- inv_*
  tenant_id          TEXT NOT NULL REFERENCES tenants(id),
  period_start       INTEGER NOT NULL,
  period_end         INTEGER NOT NULL,
  seats              INTEGER NOT NULL,
  unit_price_cents   INTEGER NOT NULL,          -- per-seat price actually charged (plan cadence applied)
  amount_cents       INTEGER NOT NULL,
  status             TEXT NOT NULL,             -- pending | paid | failed | refunded
  square_payment_id  TEXT,
  failure_reason     TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  UNIQUE (tenant_id, period_start)
);

CREATE INDEX idx_billing_invoices_tenant ON billing_invoices (tenant_id, created_at DESC);

-- Backfill: every tenant that exists when this migration lands predates
-- billing and is grandfathered forever — including t_lala, the live founding
-- tenant. New tenants get 'trialing' rows at registration (when enabled).
INSERT INTO billing_state (tenant_id, status, created_at, updated_at)
SELECT id, 'exempt', COALESCE(created_at, 0), COALESCE(created_at, 0) FROM tenants;
