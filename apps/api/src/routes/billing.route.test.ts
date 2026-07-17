import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import type { Env } from '../env';
import { registerTenant } from '../db/repos/auth';
import { patchBillingState } from '../db/repos/billing';
import { signSession } from '../lib/jwt';
import { SESSION_COOKIE } from '../lib/cookies';
import { dispatch } from '../runtime/shared/dispatch';
import { trialEndsAtFrom } from '../services/billing';

/**
 * Billing routes + the dispatch-level lock gate (v0.23.0, KBR-135), exercised
 * through the real dispatcher with a session cookie — the same path prod
 * requests take.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let userId: string;
let cookie: string;

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const request = new Request(`http://localhost:8080${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatch(request, env, () => {});
}

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

  const reg = await registerTenant(
    env,
    { email: 'gate@bill.example', password: 'billpass1', name: 'Gate', tenantName: 'Gate Co' },
    { trialEndsAt: trialEndsAtFrom(Date.now()) },
  );
  tenantId = reg.tenantId;
  userId = reg.userId;
  const jwt = await signSession(env.JWT_SECRET!, { uid: userId, tid: tenantId }, 3600);
  cookie = `${SESSION_COOKIE}=${encodeURIComponent(jwt)}`;
});

describe('billing routes', () => {
  it('GET /billing reports the trial to admins', async () => {
    const res = await call('GET', '/api/v1/billing');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enabled: boolean; status: string; seats: number; nextBillCents: number };
    expect(body.enabled).toBe(true);
    expect(body.status).toBe('trialing');
    expect(body.seats).toBe(1);
    expect(body.nextBillCents).toBe(500);
  });

  it('GET /billing/config serves the Web Payments bootstrap', async () => {
    const res = await call('GET', '/api/v1/billing/config');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      enabled: true,
      appId: 'sq0idp-test',
      locationId: 'LTEST',
      environment: 'sandbox',
    });
  });

  it('reports enabled:false when billing is unconfigured (self-host)', async () => {
    const bare = { ...env, SQUARE_ACCESS_TOKEN: undefined } as Env;
    const request = new Request('http://localhost:8080/api/v1/billing', {
      method: 'GET',
      headers: { cookie },
    });
    const res = await dispatch(request, bare, () => {});
    expect(res.status).toBe(200);
    expect(((await res.json()) as { enabled: boolean }).enabled).toBe(false);
  });

  it('rejects the Square webhook without a valid signature', async () => {
    const res = await call('POST', '/api/square/webhook', { type: 'payment.updated' });
    expect(res.status).toBe(401);
  });
});

describe('the lock gate (writes 402, reads open)', () => {
  it('trialing tenants pass writes', async () => {
    const res = await call('POST', '/api/v1/projects', { name: 'While Trialing', code: 'WT1' });
    expect(res.status).toBe(201);
  });

  it('locked tenants get 402 on writes but 200 on reads', async () => {
    await patchBillingState(env, tenantId, { status: 'expired' });

    const write = await call('POST', '/api/v1/projects', { name: 'Locked Out', code: 'LO1' });
    expect(write.status).toBe(402);
    expect(((await write.json()) as { error: string }).error).toMatch(/read-only/);

    const read = await call('GET', '/api/v1/projects');
    expect(read.status).toBe(200);

    // Billing + auth stay open so admins can pay their way out.
    const billing = await call('GET', '/api/v1/billing');
    expect(billing.status).toBe(200);
    const logout = await call('POST', '/api/v1/auth/logout');
    expect(logout.status).toBe(200);

    await patchBillingState(env, tenantId, { status: 'trialing' });
  });

  it('never gates when billing is disabled, even with a locked row', async () => {
    await patchBillingState(env, tenantId, { status: 'expired' });
    const bare = { ...env, SQUARE_ACCESS_TOKEN: undefined } as Env;
    const request = new Request('http://localhost:8080/api/v1/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Selfhost Free', code: 'SF1' }),
    });
    const res = await dispatch(request, bare, () => {});
    expect(res.status).toBe(201);
    await patchBillingState(env, tenantId, { status: 'trialing' });
  });
});
