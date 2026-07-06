import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AuthContext, AuthMeResponse, MembershipDto } from '@kbrelay/shared';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import type { Env } from '../env';
import type { RouteContext } from '../router';
import { registerTenant, loginUser, setLastTenant } from '../db/repos/auth';
import { signSession } from '../lib/jwt';
import { SESSION_COOKIE } from '../lib/cookies';
import { handleSwitchTenant, handleCreateTenant } from './auth';
import { handleListMyMemberships } from './me';

/**
 * Multi-workspace routes (v0.18.0, KBR-96): membership listing, session
 * tenant-switching (cookie-only), workspace creation for existing users, and
 * the last-active-tenant login preference.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let auth: AuthContext;
let tenant1: string;
let userId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'test-secret' } as Env;

  const reg = await registerTenant(env, {
    email: 'multi@ws.example', password: 'wspassword1', name: 'Multi User', tenantName: 'First Co',
  });
  tenant1 = reg.tenantId;
  userId = reg.userId;
  auth = {
    tenantId: tenant1, userId, userName: 'Multi User',
    userKind: 'human', role: 'admin', color: '#000000', tokenId: null,
  };
});

function ctx(body: unknown | undefined, opts: { cookie?: boolean; method?: string } = {}): RouteContext {
  return {
    // Cookie value is attached per-call in tests that need a session.
    request: new Request('http://test.local/api', {
      method: opts.method ?? 'POST',
      headers: { 'content-type': 'application/json', ...(opts.cookie ? { cookie: `${SESSION_COOKIE}=__set_by_test__` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env, url: new URL('http://test.local/api'), params: {}, cors: {}, auth, waitUntil: () => {},
  };
}

async function sessionCtx(body: unknown): Promise<RouteContext> {
  const jwt = await signSession(env.JWT_SECRET!, { uid: userId, tid: tenant1 }, 3600);
  const request = new Request('http://test.local/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=${encodeURIComponent(jwt)}` },
    body: JSON.stringify(body),
  });
  return { request, env, url: new URL('http://test.local/api'), params: {}, cors: {}, auth, waitUntil: () => {} };
}

async function status(p: Promise<Response>): Promise<number> {
  try {
    return (await p).status;
  } catch (e) {
    return (e as { status?: number }).status ?? 500;
  }
}

describe('KBR-96: multi-workspace', () => {
  let tenant2: string;

  it('POST /tenants creates a second workspace with the caller as admin', async () => {
    const res = await handleCreateTenant(ctx({ tenantName: 'Second Co' }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as AuthMeResponse;
    expect(body.tenant.name).toBe('Second Co');
    expect(body.user.role).toBe('admin');
    tenant2 = body.tenant.id;
    expect(tenant2).not.toBe(tenant1);
    // Bearer-style call (no cookie) must NOT try to set a session cookie.
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('GET /me/memberships lists both workspaces', async () => {
    const res = await handleListMyMemberships(ctx(undefined, { method: 'GET' }));
    expect(res.status).toBe(200);
    const { memberships } = (await res.json()) as { memberships: MembershipDto[] };
    expect(memberships.map((m) => m.tenant.id).sort()).toEqual([tenant1, tenant2].sort());
    expect(memberships.every((m) => m.role === 'admin')).toBe(true);
  });

  it('switch-tenant on an API key (no cookie) is rejected with 400', async () => {
    expect(await status(handleSwitchTenant(ctx({ tenantId: tenant2 })))).toBe(400);
  });

  it('switch-tenant on a session re-issues the cookie for the new tenant', async () => {
    const res = await handleSwitchTenant(await sessionCtx({ tenantId: tenant2 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as AuthMeResponse;
    expect(body.tenant.id).toBe(tenant2);
    expect(res.headers.get('Set-Cookie')).toContain(SESSION_COOKIE);
  });

  it('switch-tenant to a workspace without membership is a 404', async () => {
    expect(await status(handleSwitchTenant(await sessionCtx({ tenantId: 't_nonexistent' })))).toBe(404);
  });

  it('login lands on the last-active workspace (then falls back when stale)', async () => {
    // The switch above recorded tenant2 as last-active.
    const landed = await loginUser(env, 'multi@ws.example', 'wspassword1');
    expect(landed?.tenantId).toBe(tenant2);
    // Reset preference to tenant1 and confirm it's honored too.
    await setLastTenant(env, userId, tenant1);
    const landed2 = await loginUser(env, 'multi@ws.example', 'wspassword1');
    expect(landed2?.tenantId).toBe(tenant1);
  });

  it('register still 409s for an existing email (unchanged)', async () => {
    await expect(
      registerTenant(env, { email: 'multi@ws.example', password: 'whatever123', name: 'X', tenantName: 'Nope' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
