import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import type { Env } from '../env';
import { registerTenant } from '../db/repos/auth';
import { getBillingState, patchBillingState, countHumanSeats, listInvoices } from '../db/repos/billing';
import {
  addMonths,
  trialEndsAtFrom,
  isTenantLocked,
  getBillingSummary,
  subscribe,
  cancelSubscription,
  resumeSubscription,
  changePlan,
  runBillingSweep,
} from './billing';
import { verifyWebhookSignature } from './square';

/**
 * Billing lifecycle (v0.23.0, KBR-135): state machine, seat math, sweep
 * idempotency, dunning, trials — Square stubbed at the fetch boundary.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

const DAY = 24 * 60 * 60 * 1000;

let env: Env;
let tenantId: string;

/** Square fetch stub: routes by path; counts payment attempts; can decline. */
const square = {
  paymentCalls: 0,
  decline: false,
  lastAmount: 0,
};
const realFetch = globalThis.fetch;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = {
    db,
    ALLOWED_ORIGINS: '*',
    PUBLIC_BASE_URL: 'http://localhost:8080',
    JWT_SECRET: 'test-secret',
    SQUARE_ACCESS_TOKEN: 'test-square-token',
    SQUARE_ENVIRONMENT: 'sandbox',
    SQUARE_LOCATION_ID: 'LTEST',
    SQUARE_APP_ID: 'sq0idp-test',
    SQUARE_WEBHOOK_SIGNATURE_KEY: 'test-signature-key',
  } as Env;

  vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes('squareupsandbox.com')) return realFetch(input as never, init);
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.endsWith('/v2/customers')) return ok({ customer: { id: 'CUST1' } });
    if (url.endsWith('/v2/cards')) {
      return ok({ card: { id: 'CARD1', card_brand: 'VISA', last_4: '1111', exp_month: 12, exp_year: 2030 } });
    }
    if (url.includes('/v2/cards/') && url.endsWith('/disable')) return ok({ card: { id: 'CARD0' } });
    if (url.endsWith('/v2/payments')) {
      square.paymentCalls += 1;
      const parsed = JSON.parse(String(init?.body ?? '{}')) as { amount_money?: { amount?: number } };
      square.lastAmount = parsed.amount_money?.amount ?? 0;
      if (square.decline) {
        return new Response(
          JSON.stringify({ errors: [{ category: 'PAYMENT_METHOD_ERROR', code: 'CARD_DECLINED', detail: 'Card declined' }] }),
          { status: 402 },
        );
      }
      return ok({ payment: { id: `PAY${square.paymentCalls}`, status: 'COMPLETED' } });
    }
    throw new Error(`unstubbed square call: ${url}`);
  }) as typeof fetch);

  const reg = await registerTenant(
    env,
    { email: 'owner@bill.example', password: 'billpass1', name: 'Owner', tenantName: 'BillCo' },
    { trialEndsAt: trialEndsAtFrom(Date.now()) },
  );
  tenantId = reg.tenantId;
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  square.paymentCalls = 0;
  square.decline = false;
});

describe('period math', () => {
  it('advances months with day clamping', () => {
    const jan31 = Date.UTC(2026, 0, 31);
    expect(new Date(addMonths(jan31, 1)).toISOString().slice(0, 10)).toBe('2026-02-28');
    const mar15 = Date.UTC(2026, 2, 15);
    expect(new Date(addMonths(mar15, 12)).toISOString().slice(0, 10)).toBe('2027-03-15');
  });
});

describe('registration + seats', () => {
  it('starts hosted tenants trialing, atomically', async () => {
    const state = await getBillingState(env, tenantId);
    expect(state?.status).toBe('trialing');
    expect(state?.trial_ends_at).toBeGreaterThan(Date.now());
  });

  it('counts human seats only — the starter agent is unmetered', async () => {
    expect(await countHumanSeats(env, tenantId)).toBe(1);
  });

  it('grandfathers pre-billing tenants as exempt (t_lala from the seed)', async () => {
    const state = await getBillingState(env, 't_lala');
    expect(state?.status).toBe('exempt');
    expect(await isTenantLocked(env, 't_lala')).toBe(false);
  });

  it('creates no billing row when billing is disabled', async () => {
    const bare = { ...env, SQUARE_ACCESS_TOKEN: undefined } as Env;
    const reg = await registerTenant(bare, {
      email: 'selfhost@bill.example', password: 'billpass1', name: 'SH', tenantName: 'SelfHost Co',
    });
    expect(await getBillingState(env, reg.tenantId)).toBeNull();
    expect(await isTenantLocked(env, reg.tenantId)).toBe(false); // no row ⇒ never locked
    const summary = await getBillingSummary(bare, reg.tenantId);
    expect(summary.enabled).toBe(false);
  });
});

describe('subscribe → renew → cancel', () => {
  it('subscribes: stores card, charges seats × unit, activates', async () => {
    await subscribe(env, {
      tenantId, plan: 'monthly', sourceId: 'cnon:test-token',
      adminEmail: 'owner@bill.example', adminName: 'Owner',
    });
    const state = await getBillingState(env, tenantId);
    expect(state?.status).toBe('active');
    expect(state?.plan).toBe('monthly');
    expect(state?.card_last4).toBe('1111');
    expect(square.lastAmount).toBe(500); // 1 seat × $5
    const invoices = await listInvoices(env, tenantId);
    expect(invoices[0]?.status).toBe('paid');
  });

  it('summary reflects the active subscription', async () => {
    const s = await getBillingSummary(env, tenantId);
    expect(s.enabled).toBe(true);
    expect(s.status).toBe('active');
    expect(s.nextBillCents).toBe(500);
    expect(s.card?.brand).toBe('VISA');
  });

  it('renews when paid_through elapses — idempotently', async () => {
    const before = await getBillingState(env, tenantId);
    const due = before!.paid_through!;
    const now = due + 1000;
    await runBillingSweep(env, now);
    const after = await getBillingState(env, tenantId);
    expect(after?.status).toBe('active');
    expect(after?.paid_through).toBeGreaterThan(due);
    expect(square.paymentCalls).toBe(1);

    // Second sweep at the same instant: nothing left to charge.
    await runBillingSweep(env, now);
    expect(square.paymentCalls).toBe(1);
    expect((await listInvoices(env, tenantId)).filter((i) => i.status === 'paid')).toHaveLength(2);
  });

  it('queues a plan switch and applies it at the next renewal', async () => {
    await changePlan(env, tenantId, 'annual');
    let state = await getBillingState(env, tenantId);
    expect(state?.pending_plan).toBe('annual');
    await runBillingSweep(env, state!.paid_through! + 1000);
    state = await getBillingState(env, tenantId);
    expect(state?.plan).toBe('annual');
    expect(state?.pending_plan).toBeNull();
    expect(square.lastAmount).toBe(5000); // 1 seat × $50/yr
  });

  it('cancel runs to period end, then locks; resume undoes it', async () => {
    await cancelSubscription(env, tenantId);
    expect((await getBillingState(env, tenantId))?.status).toBe('canceling');
    await resumeSubscription(env, tenantId);
    expect((await getBillingState(env, tenantId))?.status).toBe('active');

    await cancelSubscription(env, tenantId);
    const state = await getBillingState(env, tenantId);
    await runBillingSweep(env, state!.paid_through! + 1000);
    const after = await getBillingState(env, tenantId);
    expect(after?.status).toBe('canceled');
    expect(square.paymentCalls).toBe(0); // canceling never charges
    expect(await isTenantLocked(env, tenantId)).toBe(true);
  });

  it('re-subscribes from canceled', async () => {
    await subscribe(env, {
      tenantId, plan: 'monthly', sourceId: 'cnon:test-token-2',
      adminEmail: 'owner@bill.example', adminName: 'Owner',
    });
    expect((await getBillingState(env, tenantId))?.status).toBe('active');
    expect(await isTenantLocked(env, tenantId)).toBe(false);
  });
});

describe('dunning', () => {
  it('failed renewal → past_due; day-3 retry; grace elapse → delinquent; card fix recovers', async () => {
    const state = await getBillingState(env, tenantId);
    const due = state!.paid_through!;

    square.decline = true;
    await runBillingSweep(env, due + 1000);
    const s = await getBillingState(env, tenantId);
    expect(s?.status).toBe('past_due');
    expect(s?.grace_until).toBe(due + 1000 + 14 * DAY);
    expect(await isTenantLocked(env, tenantId)).toBe(false); // grace ≠ locked
    const failed = (await listInvoices(env, tenantId)).find((i) => i.status === 'failed');
    expect(failed?.failure_reason).toBe('Card declined');

    // Day 1: no retry due yet.
    square.paymentCalls = 0;
    await runBillingSweep(env, due + 1000 + 1 * DAY);
    expect(square.paymentCalls).toBe(0);

    // Day 3: first retry fires (still declining).
    await runBillingSweep(env, due + 1000 + 3 * DAY);
    expect(square.paymentCalls).toBe(1);
    expect((await getBillingState(env, tenantId))?.retry_count).toBe(1);

    // Same day again: no duplicate retry.
    await runBillingSweep(env, due + 1000 + 3 * DAY);
    expect(square.paymentCalls).toBe(1);

    // Grace elapsed → delinquent (locked).
    await runBillingSweep(env, due + 1000 + 15 * DAY);
    expect((await getBillingState(env, tenantId))?.status).toBe('delinquent');
    expect(await isTenantLocked(env, tenantId)).toBe(true);
  });
});

describe('trials', () => {
  it('reminds at T-7 and T-1 (deduped) and expires at T-0', async () => {
    const reg = await registerTenant(
      env,
      { email: 'trial@bill.example', password: 'billpass1', name: 'T', tenantName: 'Trial Co' },
      { trialEndsAt: Date.now() + 30 * DAY },
    );
    const ends = (await getBillingState(env, reg.tenantId))!.trial_ends_at!;

    await runBillingSweep(env, ends - 6 * DAY);
    let s = await getBillingState(env, reg.tenantId);
    expect(s?.trial_notice_7_at).not.toBeNull();
    const stamp7 = s!.trial_notice_7_at;

    await runBillingSweep(env, ends - 5 * DAY); // dedupe
    expect((await getBillingState(env, reg.tenantId))?.trial_notice_7_at).toBe(stamp7);

    await runBillingSweep(env, ends - 0.5 * DAY);
    s = await getBillingState(env, reg.tenantId);
    expect(s?.trial_notice_1_at).not.toBeNull();

    await runBillingSweep(env, ends + 1000);
    s = await getBillingState(env, reg.tenantId);
    expect(s?.status).toBe('expired');
    expect(await isTenantLocked(env, reg.tenantId)).toBe(true);
  });
});

describe('webhook signature', () => {
  it('accepts a valid HMAC and rejects tampered bodies', async () => {
    const key = 'test-signature-key';
    const url = 'http://localhost:8080/api/square/webhook';
    const body = JSON.stringify({ type: 'payment.updated' });
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(url + body));
    const sig = btoa(String.fromCharCode(...new Uint8Array(mac)));

    expect(await verifyWebhookSignature(body, sig, url, key)).toBe(true);
    expect(await verifyWebhookSignature(body + 'x', sig, url, key)).toBe(false);
    expect(await verifyWebhookSignature(body, sig, url + 'x', key)).toBe(false);
    expect(await verifyWebhookSignature(body, null, url, key)).toBe(false);
  });
});

describe('exempt tenants never bill', () => {
  it('sweep ignores exempt tenants entirely', async () => {
    await patchBillingState(env, 't_lala', {});
    await runBillingSweep(env, Date.now() + 400 * DAY);
    expect((await getBillingState(env, 't_lala'))?.status).toBe('exempt');
    expect(await isTenantLocked(env, 't_lala')).toBe(false);
  });
});
