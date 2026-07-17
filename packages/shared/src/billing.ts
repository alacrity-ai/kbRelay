import { z } from 'zod';

/**
 * Billing (v0.23.0, KBR-135): per-human-seat subscriptions for kbRelay Cloud.
 * Seats are counted, not bought — each renewal charges current human seats ×
 * the per-seat price. Agents are never metered. Self-host never sees billing
 * (the API reports `enabled: false` and the SPA renders nothing).
 */

export type BillingPlan = 'monthly' | 'annual';

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'delinquent'
  | 'expired'
  | 'canceling'
  | 'canceled'
  | 'exempt';

/** Statuses in which the tenant is locked: writes 402, reads stay open. */
export const LOCKED_BILLING_STATUSES: readonly BillingStatus[] = ['expired', 'delinquent', 'canceled'];

/** List per-seat monthly price in cents. Annual per-seat = ×10 ($50/yr shape). */
export const LIST_UNIT_MONTHLY_CENTS = 500;
export const ANNUAL_MONTHS_MULTIPLIER = 10;
export const TRIAL_DAYS = 30;
export const DUNNING_RETRY_DAYS = [3, 7] as const;
export const DUNNING_GRACE_DAYS = 14;

/** Per-seat price in cents for a plan given the (possibly overridden) monthly unit. */
export function unitPriceCents(plan: BillingPlan, unitMonthlyCents: number | null | undefined): number {
  const monthly = unitMonthlyCents ?? LIST_UNIT_MONTHLY_CENTS;
  return plan === 'annual' ? monthly * ANNUAL_MONTHS_MULTIPLIER : monthly;
}

export const billingPlanSchema = z.enum(['monthly', 'annual']);

export const subscribeInput = z.object({
  plan: billingPlanSchema,
  /** Web Payments SDK card token. */
  sourceId: z.string().min(1, 'sourceId is required').max(200),
});
export type SubscribeInput = z.infer<typeof subscribeInput>;

export const updateCardInput = z.object({
  sourceId: z.string().min(1, 'sourceId is required').max(200),
});
export type UpdateCardInput = z.infer<typeof updateCardInput>;

export const changePlanInput = z.object({
  plan: billingPlanSchema,
});
export type ChangePlanInput = z.infer<typeof changePlanInput>;

export interface BillingCard {
  brand: string | null;
  last4: string | null;
  exp: string | null;
}

export interface BillingSummary {
  /** False on self-host / unconfigured deployments — hide all billing UI. */
  enabled: boolean;
  status: BillingStatus | null;
  plan: BillingPlan | null;
  pendingPlan: BillingPlan | null;
  /** Current human seats (agents never count). */
  seats: number;
  /** Per-seat price in cents for the effective plan (list unless overridden). */
  unitPriceCents: number;
  /** seats × unitPriceCents — what the next renewal would charge today. */
  nextBillCents: number;
  trialEndsAt: number | null;
  paidThrough: number | null;
  graceUntil: number | null;
  card: BillingCard | null;
}

export interface BillingConfig {
  enabled: boolean;
  appId: string | null;
  locationId: string | null;
  environment: 'sandbox' | 'production' | null;
}

export interface BillingInvoice {
  id: string;
  periodStart: number;
  periodEnd: number;
  seats: number;
  unitPriceCents: number;
  amountCents: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: number;
}
