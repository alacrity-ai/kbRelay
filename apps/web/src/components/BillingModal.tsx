import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillingSummary, BillingInvoice, BillingPlan } from '@kbrelay/shared';
import * as api from '../lib/api';
import { useDialog } from './Dialog';

/**
 * Billing (v0.23.0, KBR-135). Admin-only modal: subscription state, seats ×
 * price, card on file, plan switch, cancel/resume, invoice history — and the
 * Square Web Payments SDK card form for subscribe / replace-card. Card data
 * never touches our servers: the SDK tokenizes in an iframe and we submit the
 * token. Renders nothing meaningful on self-host (callers gate on `enabled`).
 */

/** Minimal typings for the bits of Square's Web Payments SDK we use. */
interface SquareCard {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }>;
  destroy(): Promise<void>;
}
interface SquareSdk {
  payments(appId: string, locationId: string): { card(): Promise<SquareCard> };
}
declare global {
  interface Window { Square?: SquareSdk }
}

/** Load the (sandbox|production) Web Payments script once. */
async function loadSquareSdk(environment: 'sandbox' | 'production'): Promise<SquareSdk> {
  if (window.Square) return window.Square;
  const src = environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js';
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the Square payments SDK'));
    document.head.appendChild(s);
  });
  if (!window.Square) throw new Error('Square payments SDK unavailable');
  return window.Square;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const day = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '—');

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Payment problem',
  delinquent: 'Read-only — payment overdue',
  expired: 'Trial ended — read-only',
  canceling: 'Cancels at period end',
  canceled: 'Canceled — read-only',
  exempt: 'Complimentary',
};

export default function BillingModal({ onClose }: { onClose: () => void }) {
  const dialog = useDialog();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Card form state: which action the tokenized card feeds.
  const [cardMode, setCardMode] = useState<'subscribe' | 'replace' | null>(null);
  const [plan, setPlan] = useState<BillingPlan>('monthly');
  const cardRef = useRef<SquareCard | null>(null);
  const [cardReady, setCardReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, inv] = await Promise.all([api.getBilling(), api.listBillingInvoices()]);
      setSummary(s);
      setInvoices(inv.invoices);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [load, busy, onClose]);

  // Mount the Square card form whenever a card-entry mode opens.
  useEffect(() => {
    if (!cardMode) return;
    let cancelled = false;
    setCardReady(false);
    void (async () => {
      try {
        const config = await api.getBillingConfig();
        if (!config.enabled || !config.appId || !config.locationId || !config.environment) {
          throw new Error('Billing is not configured');
        }
        const sdk = await loadSquareSdk(config.environment);
        const card = await sdk.payments(config.appId, config.locationId).card();
        if (cancelled) { void card.destroy(); return; }
        await card.attach('#billing-card-input');
        cardRef.current = card;
        setCardReady(true);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      if (cardRef.current) { void cardRef.current.destroy(); cardRef.current = null; }
    };
  }, [cardMode]);

  async function tokenizeAndSubmit() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK' || !result.token) {
        throw new Error(result.errors?.[0]?.message ?? 'Card entry failed — check the details');
      }
      if (cardMode === 'subscribe') {
        const s = await api.subscribeBilling(plan, result.token);
        setSummary(s);
      } else {
        const s = await api.updateBillingCard(result.token);
        setSummary(s);
        if (s.retry?.retried && s.retry.recovered) {
          await dialog.alert({ title: 'Payment recovered', message: 'The open invoice was charged successfully — you\'re all set.' });
        }
      }
      setCardMode(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onChangePlan(next: BillingPlan) {
    if (!summary || busy) return;
    setBusy(true);
    setError(null);
    try {
      setSummary(await api.changeBillingPlan(next));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    const yes = await dialog.confirm({
      title: 'Cancel subscription?',
      message: 'The workspace stays active until the end of the period you already paid for, then becomes read-only. Your data stays readable and exportable — nothing is deleted.',
      confirmLabel: 'Cancel subscription',
      danger: true,
    });
    if (!yes) return;
    setBusy(true);
    try {
      setSummary(await api.cancelBilling());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onResume() {
    setBusy(true);
    try {
      setSummary(await api.resumeBilling());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = summary;
  const canSubscribe = s && ['trialing', 'expired', 'canceled'].includes(s.status ?? '');
  // Per-seat monthly base regardless of which plan the summary priced.
  const monthlyUnit = s ? (s.plan === 'annual' ? s.unitPriceCents / 10 : s.unitPriceCents) : 0;
  const subscribeTotal = s ? s.seats * (plan === 'annual' ? monthlyUnit * 10 : monthlyUnit) : 0;

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="bill-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="bill-title">Billing</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          {!s ? (
            <div className="muted-note">Loading…</div>
          ) : !s.enabled ? (
            <p className="muted-note">This deployment has no billing — self-hosted kbRelay is free with unlimited seats.</p>
          ) : (
            <>
              <div className="billing-status-row">
                <span className={`billing-status ${s.status ?? ''}`}>{STATUS_LABEL[s.status ?? ''] ?? s.status}</span>
                {s.status === 'trialing' && s.trialEndsAt && (
                  <span className="muted-note">trial ends {day(s.trialEndsAt)}</span>
                )}
                {(s.status === 'active' || s.status === 'canceling') && s.paidThrough && (
                  <span className="muted-note">
                    {s.status === 'canceling' ? 'read-only after' : 'renews'} {day(s.paidThrough)}
                  </span>
                )}
                {s.status === 'past_due' && s.graceUntil && (
                  <span className="muted-note">update the card before {day(s.graceUntil)}</span>
                )}
              </div>

              <p className="muted-note billing-seats-line">
                <strong>{s.seats}</strong> human seat{s.seats === 1 ? '' : 's'} × {money(s.unitPriceCents)}
                {s.plan === 'annual' || (!s.plan && false) ? '/year' : s.plan ? '/month' : ''} ·
                next bill <strong>{money(s.nextBillCents)}</strong>
                {s.pendingPlan && <> · switching to <strong>{s.pendingPlan}</strong> at renewal</>}
                <br />
                Seats are counted, not bought — inviting a teammate simply changes the next renewal. Agents are always free.
              </p>

              {s.card && (
                <p className="muted-note">Card on file: {s.card.brand ?? 'card'} •••• {s.card.last4} (exp {s.card.exp ?? '—'})</p>
              )}

              {cardMode ? (
                <div className="billing-card-entry">
                  {cardMode === 'subscribe' && (
                    <div className="field">
                      <label>Plan</label>
                      <div className="billing-plan-pick">
                        <button className={plan === 'monthly' ? 'primary' : 'ghost'} onClick={() => setPlan('monthly')} disabled={busy}>
                          $5 / person / month
                        </button>
                        <button className={plan === 'annual' ? 'primary' : 'ghost'} onClick={() => setPlan('annual')} disabled={busy}>
                          $50 / person / year
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="field">
                    <label>Card details</label>
                    <div id="billing-card-input" />
                  </div>
                  <div className="billing-card-actions">
                    <button className="ghost" onClick={() => setCardMode(null)} disabled={busy}>Back</button>
                    <button className="primary" onClick={() => void tokenizeAndSubmit()} disabled={!cardReady || busy}>
                      {busy ? 'Working…' : cardMode === 'subscribe' ? `Subscribe — ${money(subscribeTotal)} today` : 'Save card'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="billing-actions">
                  {canSubscribe && (
                    <button className="primary" onClick={() => { setPlan('monthly'); setCardMode('subscribe'); }}>Subscribe</button>
                  )}
                  {(s.status === 'active' || s.status === 'canceling' || s.status === 'past_due') && (
                    <button className="ghost" onClick={() => setCardMode('replace')}>
                      {s.status === 'past_due' ? 'Update card & retry' : 'Replace card'}
                    </button>
                  )}
                  {s.status === 'active' && (
                    <>
                      <button className="ghost" onClick={() => void onChangePlan(s.plan === 'monthly' ? 'annual' : 'monthly')} disabled={busy}>
                        Switch to {s.plan === 'monthly' ? 'annual ($50/person/yr)' : 'monthly ($5/person/mo)'}
                      </button>
                      <button className="ghost danger-text" onClick={() => void onCancel()} disabled={busy}>Cancel…</button>
                    </>
                  )}
                  {s.status === 'canceling' && (
                    <button className="ghost" onClick={() => void onResume()} disabled={busy}>Resume subscription</button>
                  )}
                </div>
              )}

              {invoices && invoices.length > 0 && (
                <div className="key-list billing-invoices">
                  <label>Invoices</label>
                  {invoices.map((inv) => (
                    <div className="key-row" key={inv.id}>
                      <div className="key-row-main">
                        <span className="key-label">{day(inv.periodStart)} → {day(inv.periodEnd)}</span>
                        <span className="key-meta">{inv.seats} seat{inv.seats === 1 ? '' : 's'} · {money(inv.amountCents)}</span>
                      </div>
                      <span className={`billing-invoice-status ${inv.status}`}>{inv.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {error && <div className="error-text">{error}</div>}
        </div>

        <div className="modal-footer">
          <span className="muted-note billing-footer-note">
            Payments are processed by Square — card numbers never touch kbRelay. <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a> · 14-day refund on request.
          </span>
          <div className="spacer" />
          <button className="primary" onClick={onClose} disabled={busy}>Done</button>
        </div>
      </div>
    </div>
  );
}
