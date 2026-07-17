import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import type { Env } from '../env';
import { registerTenant } from '../db/repos/auth';
import { getBillingState, patchBillingState, listInvoices } from '../db/repos/billing';
import { trialEndsAtFrom, subscribe, cancelSubscription, runBillingSweep } from './billing';

/**
 * LIVE Square-sandbox E2E (v0.23.0, KBR-141). Runs the real billing lifecycle
 * against connect.squareupsandbox.com using the sandbox test nonce
 * `cnon:card-nonce-ok` — real customer, real stored card, real (sandbox)
 * charges. Skipped unless SQUARE_SANDBOX_TOKEN is set, so CI stays hermetic:
 *
 *   SQUARE_SANDBOX_TOKEN=$(agentsecrets get square_sandbox_access_token) \
 *   SQUARE_SANDBOX_LOCATION=<location id> \
 *     npx vitest run src/services/billing.sandbox.test.ts
 */
const TOKEN = process.env.SQUARE_SANDBOX_TOKEN;
const LOCATION = process.env.SQUARE_SANDBOX_LOCATION;

const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let tenantId: string;

describe.skipIf(!TOKEN || !LOCATION)('LIVE sandbox: subscribe → renew → cancel', () => {
  beforeAll(async () => {
    const { db, client } = createLibsqlDb(':memory:');
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
    env = {
      db,
      ALLOWED_ORIGINS: '*',
      PUBLIC_BASE_URL: 'http://localhost:8080',
      JWT_SECRET: 'test-secret',
      SQUARE_ACCESS_TOKEN: TOKEN,
      SQUARE_ENVIRONMENT: 'sandbox',
      SQUARE_LOCATION_ID: LOCATION,
      SQUARE_APP_ID: 'unused-here',
    } as Env;

    const reg = await registerTenant(
      env,
      {
        email: 'sandbox-e2e@kbrelay.com',
        password: 'sandboxpass1',
        name: 'Sandbox E2E',
        tenantName: `E2E ${Date.now()}`,
      },
      { trialEndsAt: trialEndsAtFrom(Date.now()) },
    );
    tenantId = reg.tenantId;
  });

  it('subscribes with the sandbox test nonce — real customer, card, and charge', async () => {
    await subscribe(env, {
      tenantId,
      plan: 'monthly',
      sourceId: 'cnon:card-nonce-ok',
      adminEmail: 'sandbox-e2e@kbrelay.com',
      adminName: 'Sandbox E2E',
    });
    const state = await getBillingState(env, tenantId);
    expect(state?.status).toBe('active');
    expect(state?.square_customer_id).toMatch(/^[A-Z0-9]/i);
    expect(state?.square_card_id).toMatch(/^ccof:/);
    const [invoice] = await listInvoices(env, tenantId);
    expect(invoice?.status).toBe('paid');
    expect(invoice?.amount_cents).toBe(500);
    expect(invoice?.square_payment_id).toBeTruthy();

    // The payment is verifiable in the sandbox itself.
    const res = await fetch(
      `https://connect.squareupsandbox.com/v2/payments/${invoice!.square_payment_id}`,
      { headers: { Authorization: `Bearer ${TOKEN}`, 'Square-Version': '2025-01-23' } },
    );
    const json = (await res.json()) as { payment?: { status?: string; amount_money?: { amount?: number } } };
    expect(json.payment?.status).toBe('COMPLETED');
    expect(json.payment?.amount_money?.amount).toBe(500);
  });

  it('renews idempotently off the stored card via the sweep', async () => {
    const before = await getBillingState(env, tenantId);
    const now = before!.paid_through! + 1000;
    await runBillingSweep(env, now);
    await runBillingSweep(env, now); // idempotency against the real API
    const invoices = await listInvoices(env, tenantId);
    expect(invoices.filter((i) => i.status === 'paid')).toHaveLength(2);
    const after = await getBillingState(env, tenantId);
    expect(after?.paid_through).toBeGreaterThan(before!.paid_through!);
  });

  it('cancels at period end without charging', async () => {
    await cancelSubscription(env, tenantId);
    const state = await getBillingState(env, tenantId);
    await runBillingSweep(env, state!.paid_through! + 1000);
    const after = await getBillingState(env, tenantId);
    expect(after?.status).toBe('canceled');
    expect((await listInvoices(env, tenantId)).filter((i) => i.status === 'paid')).toHaveLength(2);
    // Leave the tenant unlocked-irrelevant: this DB is in-memory and discarded.
    await patchBillingState(env, tenantId, { status: 'canceled' });
  });
});
