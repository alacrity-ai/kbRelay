import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { createCard } from './cards';
import { searchTenant } from './search';

/** These assertions predate pagination (KBR-133) — unwrap to the hits array. */
const searchHits = async (...args: Parameters<typeof searchTenant>) =>
  (await searchTenant(...args)).hits;
import { SNIPPET_MARK } from '@kbrelay/shared';

/**
 * Quick-find repo tests (v0.17.0, KBR-68). Covers: exact-key-above-prefix
 * ranking, project name/code hits, summary substring, LIKE-wildcard escaping,
 * and — the important one — member RBAC applied inside the query.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let alphaId: string; // project ALPHA (granted to the member)
let betaId: string; // project BETA (admin-only)
let card3Id: string;
let card30Id: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@find.example',
    password: 'ownerpassword',
    name: 'Find Owner',
    tenantName: 'Find Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;

  const alpha = await createProject(env, tenantId, ownerId, { name: 'Alpha Widgets', code: 'ALW' });
  alphaId = alpha.id;
  const beta = await createProject(env, tenantId, ownerId, { name: 'Beta Secrets', code: 'BSC' });
  betaId = beta.id;

  // Seed enough ALW cards that seq 3 and 30 both exist.
  for (let i = 1; i <= 30; i++) {
    const c = await createCard(env, tenantId, alphaId, ownerId, { summary: `Widget task ${i}` });
    if (c.seq === 3) card3Id = c.id;
    if (c.seq === 30) card30Id = c.id;
  }
  await createCard(env, tenantId, alphaId, ownerId, { summary: 'Tune the 100% flux capacitor' });
  await createCard(env, tenantId, betaId, ownerId, { summary: 'Widget task hidden in beta' });

  // KBR-130 fixtures: body-only matches + an archived card.
  await createCard(env, tenantId, alphaId, ownerId, {
    summary: 'Plain card',
    description: 'The quick brown zebra jumps over the lazy dog',
  });
  await createCard(env, tenantId, alphaId, ownerId, {
    summary: 'Criteria card',
    acceptanceCriteria: 'Given a pangolin, when it curls, then it is safe',
  });
  const archived = await createCard(env, tenantId, alphaId, ownerId, {
    summary: 'Archived aardvark card',
  });
  await env.db.prepare('UPDATE cards SET archived_at = ? WHERE id = ?')
    .bind(Date.now(), archived.id).run();
});

describe('quick-find', () => {
  it('ranks the exact key above its prefix matches', async () => {
    const hits = await searchHits(env, tenantId, 'ALW-3', { userId: ownerId, isAdmin: true });
    const cardHits = hits.filter((h) => h.kind === 'card');
    expect(cardHits[0]!.id).toBe(card3Id);
    expect(cardHits.map((h) => h.id)).toContain(card30Id);
    expect(cardHits[0]!.key).toBe('ALW-3');
    expect(cardHits[0]!.kind === 'card' && cardHits[0]!.columnName).toBeTruthy();
  });

  it('matches projects by name and by code prefix', async () => {
    const byName = await searchHits(env, tenantId, 'alpha wid', { userId: ownerId, isAdmin: true });
    expect(byName.some((h) => h.kind === 'project' && h.id === alphaId)).toBe(true);
    const byCode = await searchHits(env, tenantId, 'BS', { userId: ownerId, isAdmin: true });
    expect(byCode.some((h) => h.kind === 'project' && h.id === betaId)).toBe(true);
  });

  it('matches card summaries by substring, capped by limit', async () => {
    const hits = await searchHits(env, tenantId, 'Widget task', { userId: ownerId, isAdmin: true }, { limit: 5 });
    expect(hits.length).toBeLessThanOrEqual(5);
    expect(hits.every((h) => h.kind === 'card')).toBe(true);
  });

  it('escapes LIKE wildcards in the query', async () => {
    const hits = await searchHits(env, tenantId, '100%', { userId: ownerId, isAdmin: true });
    expect(hits.some((h) => h.kind === 'card' && h.summary.includes('100%'))).toBe(true);
    // A bare % must NOT act as match-everything.
    const wild = await searchHits(env, tenantId, '%%', { userId: ownerId, isAdmin: true });
    expect(wild.filter((h) => h.kind === 'card')).toHaveLength(0);
  });

  it('matches inside descriptions and acceptance criteria (KBR-130)', async () => {
    const desc = await searchHits(env, tenantId, 'zebra', { userId: ownerId, isAdmin: true });
    const dHit = desc.find((h) => h.kind === 'card' && h.summary === 'Plain card');
    expect(dHit && dHit.kind === 'card' && dHit.matchedField).toBe('description');
    expect(dHit && dHit.kind === 'card' && dHit.snippet).toContain(SNIPPET_MARK);

    const ac = await searchHits(env, tenantId, 'pangolin', { userId: ownerId, isAdmin: true });
    const aHit = ac.find((h) => h.kind === 'card' && h.summary === 'Criteria card');
    expect(aHit && aHit.kind === 'card' && aHit.matchedField).toBe('acceptanceCriteria');
    expect(aHit && aHit.kind === 'card' && aHit.snippet).toContain('pangolin');
  });

  it('ranks a summary match above a body match; summary hits have no snippet', async () => {
    // "card" appears in many summaries AND in bodies — summary must win, no snippet.
    const hits = await searchHits(env, tenantId, 'Plain card', { userId: ownerId, isAdmin: true });
    const hit = hits.find((h) => h.kind === 'card' && h.summary === 'Plain card');
    expect(hit && hit.kind === 'card' && hit.matchedField).toBe('summary');
    expect(hit && hit.kind === 'card' && hit.snippet).toBeNull();
  });

  it('excludes archived cards by default, includes them only when asked (KBR-130)', async () => {
    const off = await searchHits(env, tenantId, 'aardvark', { userId: ownerId, isAdmin: true });
    expect(off.filter((h) => h.kind === 'card')).toHaveLength(0);

    const on = await searchHits(
      env, tenantId, 'aardvark', { userId: ownerId, isAdmin: true, includeArchived: true },
    );
    const hit = on.find((h) => h.kind === 'card');
    expect(hit && hit.kind === 'card' && hit.archived).toBe(true);
  });

  it('the key probe also respects the archived filter', async () => {
    // Archive ALW-3, then a key search must not surface it unless opted in.
    await env.db.prepare('UPDATE cards SET archived_at = ? WHERE id = ?')
      .bind(Date.now(), card3Id).run();
    try {
      const off = await searchHits(env, tenantId, 'ALW-3', { userId: ownerId, isAdmin: true });
      expect(off.some((h) => h.kind === 'card' && h.id === card3Id)).toBe(false);
      const on = await searchHits(
        env, tenantId, 'ALW-3', { userId: ownerId, isAdmin: true, includeArchived: true },
      );
      expect(on.some((h) => h.kind === 'card' && h.id === card3Id)).toBe(true);
    } finally {
      await env.db.prepare('UPDATE cards SET archived_at = NULL WHERE id = ?').bind(card3Id).run();
    }
  });

  it('member RBAC: only granted projects are searched', async () => {
    // A member of this tenant, granted ALPHA only (raw rows — membership
    // plumbing is exercised elsewhere; this test is about the search clause).
    const memberId = 'u_member_search';
    const now = Date.now();
    await env.db.prepare(
      "INSERT INTO users (id, tenant_id, name, kind, role, handle, created_at) VALUES (?, ?, 'Member', 'human', 'member', 'membersearch', ?)",
    ).bind(memberId, tenantId, now).run();
    await env.db.prepare(
      "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES ('mem_search', ?, ?, 'member', ?)",
    ).bind(tenantId, memberId, now).run();
    await env.db.prepare(
      'INSERT INTO project_access (tenant_id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)',
    ).bind(tenantId, alphaId, memberId, now).run();

    const hits = await searchHits(env, tenantId, 'Widget task', { userId: memberId, isAdmin: false }, { limit: 50 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.kind === 'card' && h.projectId === alphaId)).toBe(true);
    // The beta project is invisible by name too.
    const beta = await searchHits(env, tenantId, 'Beta Secrets', { userId: memberId, isAdmin: false });
    expect(beta).toHaveLength(0);
  });
});
