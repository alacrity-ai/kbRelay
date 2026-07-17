import type { BillingSummary } from '@kbrelay/shared';

/**
 * Billing banner (v0.23.0, KBR-135) — the board-top strip that surfaces trial
 * countdowns, payment problems, and the read-only lock. Pure logic split out
 * for tests; renders nothing on self-host, for exempt/active tenants, or early
 * in a trial (no nagging before the last 14 days).
 */

export interface BannerInfo {
  kind: 'trial' | 'past_due' | 'locked';
  text: string;
  /** Admins get a button into the Billing modal; members get told who to ask. */
  cta: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function billingBannerInfo(
  s: BillingSummary | null,
  isAdmin: boolean,
  now = Date.now(),
): BannerInfo | null {
  if (!s || !s.enabled || !s.status) return null;
  switch (s.status) {
    case 'trialing': {
      if (!s.trialEndsAt) return null;
      const daysLeft = Math.max(0, Math.ceil((s.trialEndsAt - now) / DAY));
      if (daysLeft > 14) return null;
      return {
        kind: 'trial',
        text: `Free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left. $5 per person per month after (agents stay free).`,
        cta: isAdmin ? 'Subscribe' : null,
      };
    }
    case 'past_due':
      return {
        kind: 'past_due',
        text: isAdmin
          ? 'The last renewal charge failed. Update the card to keep the workspace active.'
          : 'The last renewal charge failed — a workspace admin needs to update the card.',
        cta: isAdmin ? 'Fix card' : null,
      };
    case 'expired':
    case 'delinquent':
    case 'canceled':
      return {
        kind: 'locked',
        text: isAdmin
          ? 'This workspace is read-only. Subscribe to pick up where you left off — everything is still here.'
          : 'This workspace is read-only until an admin renews the subscription. Reading and exporting still work.',
        cta: isAdmin ? 'Open billing' : null,
      };
    default:
      return null; // active | canceling | exempt: no banner
  }
}

export default function BillingBanner({
  summary,
  isAdmin,
  onOpenBilling,
}: {
  summary: BillingSummary | null;
  isAdmin: boolean;
  onOpenBilling: () => void;
}) {
  const info = billingBannerInfo(summary, isAdmin);
  if (!info) return null;
  return (
    <div className={`billing-banner ${info.kind}`} role="status">
      <span>{info.text}</span>
      {info.cta && (
        <button className="billing-banner-cta" onClick={onOpenBilling}>{info.cta}</button>
      )}
    </div>
  );
}
