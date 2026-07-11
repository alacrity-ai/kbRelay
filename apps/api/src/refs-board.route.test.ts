import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AuthContext, CardDto, ColumnDto, ProjectDto } from '@kbrelay/shared';
import { createLibsqlDb } from './runtime/node/libsql-db';
import type { Env } from './env';
import type { RouteContext } from './router';
import { registerTenant } from './db/repos/auth';
import { createProject } from './db/repos/projects';
import { createCard } from './db/repos/cards';
import { normalizeRefParams, enforceProjectAccess } from './auth/access';
import { handleGetBoard, handleCreateCard, handlePatchCard } from './routes/cards';

/**
 * KBR-128 route integration: human refs (ticket keys / project codes) resolve
 * to canonical ids with RBAC/404 semantics intact; the one-call board snapshot
 * returns digests (no spec bodies); `columnRole` targets lanes without ids.
 */
const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

let env: Env;
let auth: AuthContext;
let projectId: string;
let cardId: string;
let otherTenantAuth: AuthContext;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = {
    db,
    ALLOWED_ORIGINS: '*',
    PUBLIC_BASE_URL: 'http://localhost:8080',
    JWT_SECRET: 'test-secret',
  } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@refs.example',
    password: 'ownerpassword',
    name: 'Ref Owner',
    tenantName: 'Ref Co',
  });
  auth = {
    tenantId: reg.tenantId,
    userId: reg.userId,
    userName: 'Ref Owner',
    userKind: 'human',
    role: 'admin',
    color: '#000000',
    tokenId: null,
  };
  const project = await createProject(env, reg.tenantId, reg.userId, { name: 'Board', code: 'REF' });
  projectId = project.id;
  const card = await createCard(env, reg.tenantId, projectId, reg.userId, {
    summary: 'First card',
    description: 'has a spec body',
  });
  cardId = card.id;

  // A second tenant with the SAME project code + card seq — refs must never
  // resolve across the tenant boundary.
  const reg2 = await registerTenant(env, {
    email: 'owner@other.example',
    password: 'ownerpassword',
    name: 'Other Owner',
    tenantName: 'Other Co',
  });
  otherTenantAuth = { ...auth, tenantId: reg2.tenantId, userId: reg2.userId, userName: 'Other Owner' };
  const p2 = await createProject(env, reg2.tenantId, reg2.userId, { name: 'Board2', code: 'REF' });
  await createCard(env, reg2.tenantId, p2.id, reg2.userId, { summary: 'Other tenant card' });
});

function ctx(request: Request, params: Record<string, string>, as: AuthContext = auth): RouteContext {
  return { request, env, url: new URL(request.url), params, cors: {}, auth: as, waitUntil: () => {} };
}

describe('ref normalization (keys + codes → ids)', () => {
  it('resolves a ticket key to the card id (case-insensitive code)', async () => {
    for (const ref of ['REF-1', 'ref-1']) {
      const params = { id: ref };
      await normalizeRefParams(env, auth.tenantId, { kind: 'card', param: 'id' }, params);
      expect(params.id).toBe(cardId);
    }
  });

  it('resolves a project code to the project id', async () => {
    const params = { id: 'ref' };
    await normalizeRefParams(env, auth.tenantId, { kind: 'project', param: 'id' }, params);
    expect(params.id).toBe(projectId);
  });

  it('leaves canonical ids and unresolvable refs untouched', async () => {
    for (const [kind, ref] of [
      ['card', cardId],
      ['card', 'REF-999'],
      ['card', 'not a ref'],
      ['project', projectId],
      ['project', 'NOPE'],
    ] as const) {
      const params = { id: ref };
      await normalizeRefParams(env, auth.tenantId, { kind, param: 'id' }, params);
      expect(params.id).toBe(ref);
    }
  });

  it('never resolves across the tenant boundary; RBAC 404 is intact', async () => {
    // The other tenant also has REF-1 — each tenant resolves to its OWN card.
    const mine = { id: 'REF-1' };
    await normalizeRefParams(env, auth.tenantId, { kind: 'card', param: 'id' }, mine);
    const theirs = { id: 'REF-1' };
    await normalizeRefParams(env, otherTenantAuth.tenantId, { kind: 'card', param: 'id' }, theirs);
    expect(mine.id).toBe(cardId);
    expect(theirs.id).not.toBe(cardId);
    expect(theirs.id).toMatch(/^card_/);
    // An unresolvable ref falls through to enforceProjectAccess's 404.
    const bad = { id: 'REF-999' };
    await normalizeRefParams(env, auth.tenantId, { kind: 'card', param: 'id' }, bad);
    await expect(
      enforceProjectAccess(env, auth, { kind: 'card', param: 'id' }, bad),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('GET /projects/:id/board (snapshot) + columnRole', () => {
  it('returns project + columns + digests without spec bodies', async () => {
    const req = new Request(`http://x/api/v1/projects/${projectId}/board`);
    const res = await handleGetBoard(ctx(req, { id: projectId }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      project: ProjectDto;
      columns: ColumnDto[];
      cards: Array<Record<string, unknown>>;
    };
    expect(body.project.id).toBe(projectId);
    expect(body.columns.length).toBeGreaterThanOrEqual(6);
    expect(body.columns.some((c) => c.role === 'in_progress')).toBe(true);
    const digest = body.cards.find((c) => c.id === cardId)!;
    expect(digest).toBeDefined();
    expect(digest.key).toBe('REF-1');
    expect(digest.hasDescription).toBe(true);
    expect(digest.hasAcceptanceCriteria).toBe(false);
    expect('description' in digest).toBe(false);
    expect('acceptanceCriteria' in digest).toBe(false);
  });

  it('create with columnRole lands the card in that lane', async () => {
    const req = new Request(`http://x/api/v1/projects/${projectId}/cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ summary: 'Role-routed', columnRole: 'ready' }),
    });
    const res = await handleCreateCard(ctx(req, { id: projectId }));
    expect(res.status).toBe(201);
    const { card } = (await res.json()) as { card: CardDto };
    const board = await handleGetBoard(ctx(new Request('http://x/board'), { id: projectId }));
    const { columns } = (await board.json()) as { columns: ColumnDto[] };
    expect(card.columnId).toBe(columns.find((c) => c.role === 'ready')!.id);
  });

  it('patch with columnRole moves the card; missing role is a 400', async () => {
    const move = new Request(`http://x/api/v1/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ columnRole: 'in_progress' }),
    });
    const res = await handlePatchCard(ctx(move, { id: cardId }));
    expect(res.status).toBe(200);
    const { card } = (await res.json()) as { card: CardDto };
    const board = await handleGetBoard(ctx(new Request('http://x/board'), { id: projectId }));
    const { columns } = (await board.json()) as { columns: ColumnDto[] };
    expect(card.columnId).toBe(columns.find((c) => c.role === 'in_progress')!.id);

    // Strip the done role, then targeting it must 400 with a clear message.
    await env.db.prepare("UPDATE columns SET role = NULL WHERE project_id = ? AND role = 'done'")
      .bind(projectId)
      .run();
    const bad = new Request(`http://x/api/v1/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ columnRole: 'done' }),
    });
    await expect(handlePatchCard(ctx(bad, { id: cardId }))).rejects.toMatchObject({ status: 400 });
  });
});
