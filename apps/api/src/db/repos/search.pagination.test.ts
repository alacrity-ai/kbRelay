import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AuthContext } from '@kbrelay/shared';
import { SEARCH_MAX_RESULTS } from '@kbrelay/shared';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import type { RouteContext } from '../../router';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { createCard } from './cards';
import { searchTenant } from './search';
import { handleSearch } from '../../routes/search';

/**
 * Quick-find pagination (KBR-133). Fixture is deliberately hostile to
 * ordering: ALL matching cards share one `updated_at` (forced ties — the
 * id tie-breaker is what keeps page boundaries reproducible), plus two
 * projects with identical names. 120 matching cards → three pages at 50.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

const TOTAL = 120;

let env: Env;
let tenantId: string;
let ownerId: string;
let pagId: string;

const admin = () => ({ userId: ownerId, isAdmin: true });

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@page.example',
    password: 'ownerpassword',
    name: 'Page Owner',
    tenantName: 'Page Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;

  const pag = await createProject(env, tenantId, ownerId, { name: 'Pagination', code: 'PAG' });
  pagId = pag.id;
  for (let i = 1; i <= TOTAL; i++) {
    await createCard(env, tenantId, pagId, ownerId, { summary: `zzfindme item ${i}` });
  }
  // Force EVERY matching card onto one identical timestamp: the body probe's
  // updated_at ordering ties completely, leaving c.id as the only order.
  await env.db.prepare(
    "UPDATE cards SET updated_at = 1700000000000 WHERE summary LIKE 'zzfindme%'",
  ).run();

  // Two projects with the same name — the project probe's name ordering ties.
  await createProject(env, tenantId, ownerId, { name: 'Twin Board', code: 'TWA' });
  await createProject(env, tenantId, ownerId, { name: 'Twin Board', code: 'TWB' });
});

const key = (h: { kind: string; id: string }) => `${h.kind}:${h.id}`;

describe('pagination: determinism & prefix-extension', () => {
  it('walks all matches across pages: unique rows, exact flags, server cursor', async () => {
    const p1 = await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: 0 });
    expect(p1.hits).toHaveLength(50);
    expect(p1).toMatchObject({ hasMore: true, nextOffset: 50, truncated: false });

    const p2 = await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: p1.nextOffset! });
    expect(p2.hits).toHaveLength(50);
    expect(p2).toMatchObject({ hasMore: true, nextOffset: 100, truncated: false });

    const p3 = await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: p2.nextOffset! });
    expect(p3.hits).toHaveLength(TOTAL - 100);
    expect(p3).toMatchObject({ hasMore: false, nextOffset: null, truncated: false });

    const all = [...p1.hits, ...p2.hits, ...p3.hits];
    expect(new Set(all.map(key)).size).toBe(TOTAL); // no dup, no skip
  });

  it('page boundaries are reproducible under total ties (identical updated_at)', async () => {
    const a = await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: 50 });
    const b = await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: 50 });
    expect(a.hits.map(key)).toEqual(b.hits.map(key));
  });

  it('tied project names page deterministically too', async () => {
    const a = await searchTenant(env, tenantId, 'Twin Board', admin(), { limit: 1, offset: 0 });
    const b = await searchTenant(env, tenantId, 'Twin Board', admin(), { limit: 1, offset: 1 });
    expect(a.hits).toHaveLength(1);
    expect(b.hits).toHaveLength(1);
    expect(a.hits[0]!.id).not.toBe(b.hits[0]!.id); // adjacent, not overlapping
    const again = await searchTenant(env, tenantId, 'Twin Board', admin(), { limit: 1, offset: 0 });
    expect(again.hits[0]!.id).toBe(a.hits[0]!.id);
  });

  it('different page sizes tile the same merged order (prefix-extension)', async () => {
    const big = [
      ...(await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: 0 })).hits,
      ...(await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: 50 })).hits,
    ];
    const small: typeof big = [];
    for (let off = 0; off < 100; off += 25) {
      small.push(...(await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 25, offset: off })).hits);
    }
    expect(small.map(key)).toEqual(big.map(key));
  });

  it('the key probe participates in the offset walk', async () => {
    // 'PAG-1' key-matches seqs 1, 10-19, 100-119 (prefix "1") = 32 cards; no
    // summary contains the literal, so the merged list is key hits only.
    const p1 = await searchTenant(env, tenantId, 'PAG-1', admin(), { limit: 30, offset: 0 });
    expect(p1.hits).toHaveLength(30);
    expect(p1.hits.every((h) => h.kind === 'card' && h.matchedField === 'key')).toBe(true);
    expect(p1.nextOffset).toBe(30);
    const p2 = await searchTenant(env, tenantId, 'PAG-1', admin(), { limit: 30, offset: 30 });
    expect(p2.hits).toHaveLength(2);
    expect(p2).toMatchObject({ hasMore: false, nextOffset: null });
    expect(new Set([...p1.hits, ...p2.hits].map(key)).size).toBe(32);
  });

  it('member RBAC holds at every offset', async () => {
    const memberId = 'u_member_page';
    const now = Date.now();
    await env.db.prepare(
      "INSERT INTO users (id, tenant_id, name, kind, role, handle, created_at) VALUES (?, ?, 'M', 'human', 'member', 'mpage', ?)",
    ).bind(memberId, tenantId, now).run();
    await env.db.prepare(
      "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES ('mem_page', ?, ?, 'member', ?)",
    ).bind(tenantId, memberId, now).run();
    // Granted a project with NO matching cards → every page must be empty.
    const other = await createProject(env, tenantId, ownerId, { name: 'Empty Grant', code: 'EMG' });
    await env.db.prepare(
      'INSERT INTO project_access (tenant_id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)',
    ).bind(tenantId, other.id, memberId, now).run();

    for (const offset of [0, 50, 100]) {
      const page = await searchTenant(env, tenantId, 'zzfindme', { userId: memberId, isAdmin: false }, { limit: 50, offset });
      expect(page.hits).toHaveLength(0);
      expect(page.hasMore).toBe(false);
    }
  });
});

describe('pagination: the result window (truncation)', () => {
  it('distinguishes truncation from exhaustion at the cap', async () => {
    // A dedicated tenant seeded past SEARCH_MAX_RESULTS via bulk SQL (repo
    // createCard per row would dominate the suite's runtime).
    const reg = await registerTenant(env, {
      email: 'owner@cap.example', password: 'ownerpassword', name: 'Cap', tenantName: 'Cap Co',
    });
    const capTenant = reg.tenantId;
    const capOwner = reg.userId;
    const proj = await createProject(env, capTenant, capOwner, { name: 'Cap Board', code: 'CAP' });
    const col = (await env.db.prepare(
      'SELECT id FROM columns WHERE project_id = ? ORDER BY position ASC LIMIT 1',
    ).bind(proj.id).first<{ id: string }>())!;
    const stmt = await env.db.prepare(
      `INSERT INTO cards (id, tenant_id, project_id, column_id, seq, summary, position, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'capfill row', ?, ?, ?, 1700000000000, 1700000000000)`,
    );
    for (let i = 1; i <= SEARCH_MAX_RESULTS + 5; i++) {
      await stmt.bind(`card_cap${i}`, capTenant, proj.id, col.id, i, i * 10, capOwner, capOwner).run();
    }

    const access = { userId: capOwner, isAdmin: true };
    const lastPage = await searchTenant(env, capTenant, 'capfill', access, { limit: 50, offset: 950 });
    expect(lastPage.hits).toHaveLength(50); // rows 950..1000
    expect(lastPage).toMatchObject({ hasMore: false, nextOffset: null, truncated: true });

    // Same window size, fewer matches → exhaustion, not truncation.
    const exhausted = await searchTenant(env, tenantId, 'zzfindme', admin(), { limit: 50, offset: 100 });
    expect(exhausted).toMatchObject({ hasMore: false, nextOffset: null, truncated: false });
  });
});

describe('route validation (reject, never clamp)', () => {
  function ctx(query: string): RouteContext {
    const request = new Request(`http://test.local/api/v1/search${query}`);
    const auth: AuthContext = {
      tenantId, userId: ownerId, userName: 'Page Owner', userKind: 'human',
      role: 'admin', color: '#000', tokenId: null,
    };
    return { request, env, url: new URL(request.url), params: {}, cors: {}, auth, waitUntil: () => {} };
  }

  it('accepts a valid offset and returns the paged shape', async () => {
    const res = await handleSearch(ctx('?q=zzfindme&limit=50&offset=50'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hits: unknown[]; hasMore: boolean; nextOffset: number | null; truncated: boolean };
    expect(body.hits).toHaveLength(50);
    expect(body.hasMore).toBe(true);
    expect(body.nextOffset).toBe(100);
    expect(body.truncated).toBe(false);
  });

  it('rejects negative, fractional, unsafe, and out-of-window offsets with 400', async () => {
    for (const bad of ['-1', '1.5', '9007199254740993', String(SEARCH_MAX_RESULTS), 'abc']) {
      try {
        await handleSearch(ctx(`?q=zzfindme&offset=${bad}`));
        expect.unreachable(`offset=${bad} should 400`);
      } catch (err) {
        expect((err as { status?: number }).status).toBe(400);
      }
    }
  });

  it('limit keeps clamp semantics (back-compat)', async () => {
    const res = await handleSearch(ctx('?q=zzfindme&limit=99999'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hits: unknown[] };
    expect(body.hits).toHaveLength(50); // MAX_LIMIT clamp, not 400
  });
});
