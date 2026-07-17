import type { Env } from '../../env';
import type { BillingPlan, BillingStatus } from '@kbrelay/shared';
import { newId } from '../ids';

/**
 * Billing repo (v0.23.0, KBR-135) — all SQL for billing_state /
 * billing_invoices. Lifecycle orchestration (Square calls, state machine,
 * the cron sweep) lives in services/billing.ts; this module is pure storage.
 */

export interface BillingStateRow {
  tenant_id: string;
  status: BillingStatus;
  plan: BillingPlan | null;
  unit_monthly_cents: number | null;
  trial_ends_at: number | null;
  paid_through: number | null;
  pending_plan: BillingPlan | null;
  square_customer_id: string | null;
  square_card_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp: string | null;
  grace_until: number | null;
  retry_count: number;
  trial_notice_7_at: number | null;
  trial_notice_1_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface BillingInvoiceRow {
  id: string;
  tenant_id: string;
  period_start: number;
  period_end: number;
  seats: number;
  unit_price_cents: number;
  amount_cents: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  square_payment_id: string | null;
  failure_reason: string | null;
  created_at: number;
  updated_at: number;
}

export async function getBillingState(env: Env, tenantId: string): Promise<BillingStateRow | null> {
  return env.db.prepare('SELECT * FROM billing_state WHERE tenant_id = ?')
    .bind(tenantId)
    .first<BillingStateRow>();
}

/** Current human seats — memberships joined to human users. Agents never count. */
export async function countHumanSeats(env: Env, tenantId: string): Promise<number> {
  const row = await env.db.prepare(
    `SELECT COUNT(*) AS n FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND u.kind = 'human'`,
  )
    .bind(tenantId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Patch billing_state fields. Only the provided keys are written; every write
 * bumps updated_at. Column allowlist keeps this injection-safe.
 */
const PATCHABLE = new Set([
  'status', 'plan', 'unit_monthly_cents', 'trial_ends_at', 'paid_through', 'pending_plan',
  'square_customer_id', 'square_card_id', 'card_brand', 'card_last4', 'card_exp',
  'grace_until', 'retry_count', 'trial_notice_7_at', 'trial_notice_1_at',
]);

export async function patchBillingState(
  env: Env,
  tenantId: string,
  patch: Partial<Omit<BillingStateRow, 'tenant_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const keys = Object.keys(patch).filter((k) => PATCHABLE.has(k));
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
  await env.db.prepare(`UPDATE billing_state SET ${sets}, updated_at = ? WHERE tenant_id = ?`)
    .bind(...values, Date.now(), tenantId)
    .run();
}

/** Tenants whose renewal is due (active/canceling with paid_through elapsed). */
export async function listRenewalsDue(env: Env, now: number): Promise<BillingStateRow[]> {
  const res = await env.db.prepare(
    `SELECT * FROM billing_state
      WHERE status IN ('active','canceling') AND paid_through IS NOT NULL AND paid_through <= ?`,
  )
    .bind(now)
    .all<BillingStateRow>();
  return res.results ?? [];
}

export async function listPastDue(env: Env): Promise<BillingStateRow[]> {
  const res = await env.db.prepare(`SELECT * FROM billing_state WHERE status = 'past_due'`)
    .all<BillingStateRow>();
  return res.results ?? [];
}

export async function listTrialing(env: Env): Promise<BillingStateRow[]> {
  const res = await env.db.prepare(`SELECT * FROM billing_state WHERE status = 'trialing'`)
    .all<BillingStateRow>();
  return res.results ?? [];
}

/**
 * Create the invoice row for a period if it doesn't exist (the double-charge
 * guard: UNIQUE(tenant_id, period_start)), then return the row either way.
 */
export async function ensureInvoice(
  env: Env,
  args: {
    tenantId: string;
    periodStart: number;
    periodEnd: number;
    seats: number;
    unitPriceCents: number;
  },
): Promise<BillingInvoiceRow> {
  const now = Date.now();
  await env.db.prepare(
    `INSERT INTO billing_invoices
       (id, tenant_id, period_start, period_end, seats, unit_price_cents, amount_cents, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT (tenant_id, period_start) DO NOTHING`,
  )
    .bind(
      newId('inv'),
      args.tenantId,
      args.periodStart,
      args.periodEnd,
      args.seats,
      args.unitPriceCents,
      args.seats * args.unitPriceCents,
      now,
      now,
    )
    .run();
  const row = await env.db.prepare(
    'SELECT * FROM billing_invoices WHERE tenant_id = ? AND period_start = ?',
  )
    .bind(args.tenantId, args.periodStart)
    .first<BillingInvoiceRow>();
  if (!row) throw new Error('ensureInvoice: row missing after insert');
  return row;
}

export async function markInvoice(
  env: Env,
  invoiceId: string,
  status: BillingInvoiceRow['status'],
  fields: { squarePaymentId?: string | null; failureReason?: string | null } = {},
): Promise<void> {
  await env.db.prepare(
    `UPDATE billing_invoices
        SET status = ?,
            square_payment_id = COALESCE(?, square_payment_id),
            failure_reason = ?,
            updated_at = ?
      WHERE id = ?`,
  )
    .bind(status, fields.squarePaymentId ?? null, fields.failureReason ?? null, Date.now(), invoiceId)
    .run();
}

export async function listInvoices(env: Env, tenantId: string, limit = 24): Promise<BillingInvoiceRow[]> {
  const res = await env.db.prepare(
    'SELECT * FROM billing_invoices WHERE tenant_id = ? ORDER BY period_start DESC LIMIT ?',
  )
    .bind(tenantId, limit)
    .all<BillingInvoiceRow>();
  return res.results ?? [];
}

export async function findInvoiceBySquarePayment(
  env: Env,
  squarePaymentId: string,
): Promise<BillingInvoiceRow | null> {
  return env.db.prepare('SELECT * FROM billing_invoices WHERE square_payment_id = ?')
    .bind(squarePaymentId)
    .first<BillingInvoiceRow>();
}

/** Admin emails for a tenant (for receipts / dunning / trial notices). */
export async function listAdminEmails(env: Env, tenantId: string): Promise<string[]> {
  const res = await env.db.prepare(
    `SELECT u.email AS email FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND m.role = 'admin' AND u.kind = 'human' AND u.email IS NOT NULL`,
  )
    .bind(tenantId)
    .all<{ email: string }>();
  return (res.results ?? []).map((r) => r.email);
}

export async function getTenantName(env: Env, tenantId: string): Promise<string> {
  const row = await env.db.prepare('SELECT name FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first<{ name: string }>();
  return row?.name ?? tenantId;
}
