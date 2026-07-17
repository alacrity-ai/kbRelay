import type { Env } from '../env';
import type { BillingPlan, BillingSummary } from '@kbrelay/shared';
import {
  LOCKED_BILLING_STATUSES,
  TRIAL_DAYS,
  DUNNING_RETRY_DAYS,
  DUNNING_GRACE_DAYS,
  unitPriceCents,
} from '@kbrelay/shared';
import { HttpError } from '../http';
import {
  getBillingState,
  patchBillingState,
  countHumanSeats,
  ensureInvoice,
  markInvoice,
  listRenewalsDue,
  listPastDue,
  listTrialing,
  listAdminEmails,
  getTenantName,
  type BillingStateRow,
} from '../db/repos/billing';
import { billingEnabled, createCustomer, createCard, disableCard, chargeCard } from './square';
import { sendMailgun } from './mailgun';
import {
  receiptEmail,
  chargeFailedEmail,
  accountLockedEmail,
  trialReminderEmail,
  trialExpiredEmail,
} from '../email/templates';

/**
 * Billing lifecycle (v0.23.0, KBR-135) — the state machine + the daily sweep.
 * Storage is db/repos/billing.ts; Square transport is services/square.ts.
 * Design: docs/v0.23.0/0-BILLING_DESIGN.md. Everything here is hosted-only:
 * callers gate on billingEnabled(env) (self-host: no SQUARE_ACCESS_TOKEN).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar-aware period advance (day-of-month clamped, e.g. Jan 31 → Feb 28). */
export function addMonths(fromMs: number, months: number): number {
  const d = new Date(fromMs);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, maxDay));
  return d.getTime();
}

function periodEnd(startMs: number, plan: BillingPlan): number {
  return addMonths(startMs, plan === 'annual' ? 12 : 1);
}

/** Is this tenant locked (writes 402)? No row / disabled billing ⇒ never locked. */
export async function isTenantLocked(env: Env, tenantId: string): Promise<boolean> {
  if (!billingEnabled(env)) return false;
  const state = await getBillingState(env, tenantId);
  if (!state) return false;
  return (LOCKED_BILLING_STATUSES as readonly string[]).includes(state.status);
}

/** Trial length exported for the registration path. */
export function trialEndsAtFrom(nowMs: number): number {
  return nowMs + TRIAL_DAYS * DAY_MS;
}

export async function getBillingSummary(env: Env, tenantId: string): Promise<BillingSummary> {
  const enabled = billingEnabled(env);
  const state = enabled ? await getBillingState(env, tenantId) : null;
  const seats = enabled ? await countHumanSeats(env, tenantId) : 0;
  const plan = state?.plan ?? 'monthly';
  const unit = unitPriceCents(plan, state?.unit_monthly_cents);
  return {
    enabled,
    status: state?.status ?? null,
    plan: state?.plan ?? null,
    pendingPlan: state?.pending_plan ?? null,
    seats,
    unitPriceCents: unit,
    nextBillCents: seats * unit,
    trialEndsAt: state?.trial_ends_at ?? null,
    paidThrough: state?.paid_through ?? null,
    graceUntil: state?.grace_until ?? null,
    card: state?.square_card_id
      ? { brand: state.card_brand, last4: state.card_last4, exp: state.card_exp }
      : null,
  };
}

async function requireState(env: Env, tenantId: string): Promise<BillingStateRow> {
  const state = await getBillingState(env, tenantId);
  if (!state) throw new HttpError(409, 'This workspace has no billing record');
  return state;
}

/**
 * Subscribe (or re-subscribe): store the card, charge the first period for
 * current seats, activate. Allowed from trialing / expired / canceled.
 */
export async function subscribe(
  env: Env,
  args: { tenantId: string; plan: BillingPlan; sourceId: string; adminEmail: string; adminName: string },
): Promise<void> {
  const state = await requireState(env, args.tenantId);
  if (!['trialing', 'expired', 'canceled'].includes(state.status)) {
    throw new HttpError(409, `Cannot subscribe from status "${state.status}"`);
  }

  const customerId = state.square_customer_id
    ?? (await createCustomer(env, {
      email: args.adminEmail,
      name: await getTenantName(env, args.tenantId),
      tenantId: args.tenantId,
    }));

  const card = await createCard(env, {
    customerId,
    sourceId: args.sourceId,
    idempotencyKey: `kbrelay-card-${args.tenantId}-${Date.now()}`,
  });
  if (state.square_card_id) {
    await disableCard(env, state.square_card_id).catch(() => undefined);
  }

  const now = Date.now();
  const seats = await countHumanSeats(env, args.tenantId);
  const unit = unitPriceCents(args.plan, state.unit_monthly_cents);
  const invoice = await ensureInvoice(env, {
    tenantId: args.tenantId,
    periodStart: now,
    periodEnd: periodEnd(now, args.plan),
    seats,
    unitPriceCents: unit,
  });

  const charge = await chargeCard(env, {
    customerId,
    cardId: card.id,
    amountCents: invoice.amount_cents,
    idempotencyKey: `${invoice.id}:0`,
    note: `kbRelay Cloud · ${seats} seat${seats === 1 ? '' : 's'} · ${args.plan}`,
  });
  if (!charge.ok) {
    await markInvoice(env, invoice.id, 'failed', { failureReason: charge.failureReason });
    throw new HttpError(402, `Card charge failed: ${charge.failureReason ?? 'declined'}`);
  }

  await markInvoice(env, invoice.id, 'paid', { squarePaymentId: charge.paymentId });
  await patchBillingState(env, args.tenantId, {
    status: 'active',
    plan: args.plan,
    pending_plan: null,
    paid_through: invoice.period_end,
    square_customer_id: customerId,
    square_card_id: card.id,
    card_brand: card.brand,
    card_last4: card.last4,
    card_exp: card.exp,
    grace_until: null,
    retry_count: 0,
  });
}

/** Replace the card on file; when past_due, immediately retry the open invoice. */
export async function updateCard(
  env: Env,
  args: { tenantId: string; sourceId: string; adminEmail: string },
): Promise<{ retried: boolean; recovered: boolean }> {
  const state = await requireState(env, args.tenantId);
  if (!state.square_customer_id) throw new HttpError(409, 'Subscribe first to add a card');

  const card = await createCard(env, {
    customerId: state.square_customer_id,
    sourceId: args.sourceId,
    idempotencyKey: `kbrelay-card-${args.tenantId}-${Date.now()}`,
  });
  if (state.square_card_id) {
    await disableCard(env, state.square_card_id).catch(() => undefined);
  }
  await patchBillingState(env, args.tenantId, {
    square_card_id: card.id,
    card_brand: card.brand,
    card_last4: card.last4,
    card_exp: card.exp,
  });

  if (state.status !== 'past_due') return { retried: false, recovered: false };
  const fresh = await requireState(env, args.tenantId);
  const recovered = await retryOpenInvoice(env, fresh);
  return { retried: true, recovered };
}

export async function changePlan(env: Env, tenantId: string, plan: BillingPlan): Promise<void> {
  const state = await requireState(env, tenantId);
  if (state.status !== 'active' && state.status !== 'canceling') {
    throw new HttpError(409, 'Plan changes apply to active subscriptions');
  }
  await patchBillingState(env, tenantId, { pending_plan: plan === state.plan ? null : plan });
}

export async function cancelSubscription(env: Env, tenantId: string): Promise<void> {
  const state = await requireState(env, tenantId);
  if (state.status !== 'active') throw new HttpError(409, 'No active subscription to cancel');
  await patchBillingState(env, tenantId, { status: 'canceling' });
}

export async function resumeSubscription(env: Env, tenantId: string): Promise<void> {
  const state = await requireState(env, tenantId);
  if (state.status !== 'canceling') throw new HttpError(409, 'Nothing to resume');
  await patchBillingState(env, tenantId, { status: 'active' });
}

// ── The daily sweep (Worker cron) ─────────────────────────────

async function emailAdmins(
  env: Env,
  tenantId: string,
  mail: { subject: string; text: string; html: string },
  tag: string,
): Promise<void> {
  const emails = await listAdminEmails(env, tenantId);
  await Promise.all(
    emails.map((to) =>
      sendMailgun(env, { to, ...mail, tags: [tag] }).then((r) => {
        if (!r.ok) console.warn(`[billing] ${tag} mail to ${to} failed: ${r.error}`);
      }),
    ),
  );
}

/** Charge the open (pending/failed) invoice for the current period again. */
async function retryOpenInvoice(env: Env, state: BillingStateRow): Promise<boolean> {
  if (!state.square_customer_id || !state.square_card_id || !state.paid_through || !state.plan) {
    return false;
  }
  // A queued plan switch applies to the period being billed now.
  const effectivePlan = state.pending_plan ?? state.plan;
  const invoice = await ensureInvoice(env, {
    tenantId: state.tenant_id,
    periodStart: state.paid_through,
    periodEnd: periodEnd(state.paid_through, effectivePlan),
    seats: await countHumanSeats(env, state.tenant_id),
    unitPriceCents: unitPriceCents(effectivePlan, state.unit_monthly_cents),
  });
  if (invoice.status === 'paid') return true;

  const attempt = state.retry_count + 1;
  const charge = await chargeCard(env, {
    customerId: state.square_customer_id,
    cardId: state.square_card_id,
    amountCents: invoice.amount_cents,
    idempotencyKey: `${invoice.id}:${attempt}`,
    note: `kbRelay Cloud renewal · ${invoice.seats} seat${invoice.seats === 1 ? '' : 's'}`,
  });

  if (charge.ok) {
    await markInvoice(env, invoice.id, 'paid', { squarePaymentId: charge.paymentId });
    await patchBillingState(env, state.tenant_id, {
      status: 'active',
      plan: effectivePlan,
      pending_plan: null,
      paid_through: invoice.period_end,
      grace_until: null,
      retry_count: 0,
    });
    await emailAdmins(
      env,
      state.tenant_id,
      receiptEmail({
        tenantName: await getTenantName(env, state.tenant_id),
        seats: invoice.seats,
        amountCents: invoice.amount_cents,
        periodEnd: invoice.period_end,
        billingUrl: billingUrl(env),
      }),
      'billing-receipt',
    );
    return true;
  }

  await markInvoice(env, invoice.id, 'failed', { failureReason: charge.failureReason });
  await patchBillingState(env, state.tenant_id, { retry_count: attempt });
  return false;
}

function billingUrl(env: Env): string {
  return `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/app`;
}

/**
 * The daily billing sweep. Every step is idempotent: invoices are unique per
 * (tenant, period), charges key on invoice+attempt, notices dedupe on stamps.
 * Per-tenant failures are isolated so one bad tenant can't stall the fleet.
 */
export async function runBillingSweep(env: Env, now: number): Promise<void> {
  if (!billingEnabled(env)) return;

  // 1. Renewals due: charge active/canceling tenants whose period elapsed.
  for (const state of await listRenewalsDue(env, now)) {
    try {
      if (state.status === 'canceling') {
        await patchBillingState(env, state.tenant_id, { status: 'canceled', grace_until: null });
        continue;
      }
      const paid = await retryOpenInvoice(env, { ...state, retry_count: -1 });
      if (!paid) {
        await patchBillingState(env, state.tenant_id, {
          status: 'past_due',
          grace_until: now + DUNNING_GRACE_DAYS * DAY_MS,
          retry_count: 0,
        });
        await emailAdmins(
          env,
          state.tenant_id,
          chargeFailedEmail({
            tenantName: await getTenantName(env, state.tenant_id),
            graceDays: DUNNING_GRACE_DAYS,
            billingUrl: billingUrl(env),
          }),
          'billing-charge-failed',
        );
      }
    } catch (err) {
      console.error(`[billing] renewal sweep failed for ${state.tenant_id}:`, err);
    }
  }

  // 2. Dunning: retry past_due on the configured day offsets; lock after grace.
  for (const state of await listPastDue(env)) {
    try {
      if (state.grace_until && state.grace_until <= now) {
        await patchBillingState(env, state.tenant_id, { status: 'delinquent' });
        await emailAdmins(
          env,
          state.tenant_id,
          accountLockedEmail({
            tenantName: await getTenantName(env, state.tenant_id),
            billingUrl: billingUrl(env),
          }),
          'billing-locked',
        );
        continue;
      }
      const graceStart = (state.grace_until ?? now) - DUNNING_GRACE_DAYS * DAY_MS;
      const daysIn = Math.floor((now - graceStart) / DAY_MS);
      const due = DUNNING_RETRY_DAYS.filter((d) => d <= daysIn).length;
      if (state.retry_count < due) {
        await retryOpenInvoice(env, state);
      }
    } catch (err) {
      console.error(`[billing] dunning sweep failed for ${state.tenant_id}:`, err);
    }
  }

  // 3. Trials: reminders at T-7 / T-1, expiry lock at T-0.
  for (const state of await listTrialing(env)) {
    try {
      if (!state.trial_ends_at) continue;
      const tenantName = await getTenantName(env, state.tenant_id);
      if (state.trial_ends_at <= now) {
        await patchBillingState(env, state.tenant_id, { status: 'expired' });
        await emailAdmins(
          env,
          state.tenant_id,
          trialExpiredEmail({ tenantName, billingUrl: billingUrl(env) }),
          'billing-trial-expired',
        );
        continue;
      }
      const daysLeft = Math.ceil((state.trial_ends_at - now) / DAY_MS);
      if (daysLeft <= 1 && !state.trial_notice_1_at) {
        await patchBillingState(env, state.tenant_id, { trial_notice_1_at: now });
        await emailAdmins(
          env,
          state.tenant_id,
          trialReminderEmail({ tenantName, daysLeft, billingUrl: billingUrl(env) }),
          'billing-trial-reminder',
        );
      } else if (daysLeft <= 7 && !state.trial_notice_7_at) {
        await patchBillingState(env, state.tenant_id, { trial_notice_7_at: now });
        await emailAdmins(
          env,
          state.tenant_id,
          trialReminderEmail({ tenantName, daysLeft, billingUrl: billingUrl(env) }),
          'billing-trial-reminder',
        );
      }
    } catch (err) {
      console.error(`[billing] trial sweep failed for ${state.tenant_id}:`, err);
    }
  }
}
