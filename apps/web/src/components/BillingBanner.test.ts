import { describe, it, expect } from 'vitest';
import type { BillingSummary } from '@kbrelay/shared';
import { billingBannerInfo } from './BillingBanner';

/** Banner decision logic (v0.23.0, KBR-135). */

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function summary(over: Partial<BillingSummary>): BillingSummary {
  return {
    enabled: true,
    status: 'trialing',
    plan: null,
    pendingPlan: null,
    seats: 2,
    unitPriceCents: 500,
    nextBillCents: 1000,
    trialEndsAt: null,
    paidThrough: null,
    graceUntil: null,
    card: null,
    ...over,
  };
}

describe('billingBannerInfo', () => {
  it('renders nothing on self-host or without a summary', () => {
    expect(billingBannerInfo(null, true, NOW)).toBeNull();
    expect(billingBannerInfo(summary({ enabled: false }), true, NOW)).toBeNull();
  });

  it('renders nothing for active, canceling, or exempt tenants', () => {
    for (const status of ['active', 'canceling', 'exempt'] as const) {
      expect(billingBannerInfo(summary({ status }), true, NOW)).toBeNull();
    }
  });

  it('stays quiet early in a trial, then counts down the last 14 days', () => {
    const early = summary({ trialEndsAt: NOW + 20 * DAY });
    expect(billingBannerInfo(early, true, NOW)).toBeNull();

    const late = summary({ trialEndsAt: NOW + 3 * DAY });
    const info = billingBannerInfo(late, true, NOW);
    expect(info?.kind).toBe('trial');
    expect(info?.text).toContain('3 days left');
    expect(info?.cta).toBe('Subscribe');
    // Members get no CTA — subscribing is an admin action.
    expect(billingBannerInfo(late, false, NOW)?.cta).toBeNull();
  });

  it('flags past_due with an admin CTA', () => {
    const info = billingBannerInfo(summary({ status: 'past_due' }), true, NOW);
    expect(info?.kind).toBe('past_due');
    expect(info?.cta).toBe('Fix card');
    expect(billingBannerInfo(summary({ status: 'past_due' }), false, NOW)?.text).toContain('admin');
  });

  it('marks every locked status read-only', () => {
    for (const status of ['expired', 'delinquent', 'canceled'] as const) {
      const info = billingBannerInfo(summary({ status }), true, NOW);
      expect(info?.kind).toBe('locked');
      expect(info?.text).toContain('read-only');
    }
  });
});
