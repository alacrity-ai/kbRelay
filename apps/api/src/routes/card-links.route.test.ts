import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AuthContext, CardLinkDto, CardLinkMatch } from '@kbrelay/shared';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import type { Env } from '../env';
import type { RouteContext } from '../router';
import { registerTenant } from '../db/repos/auth';
import { createProject } from '../db/repos/projects';
import { createCard } from '../db/repos/cards';
import { handleAddCardLink, handleDeleteCardLink, handleFindCardLinks } from './card-links';
import { handleGetCard, handleListCards } from './cards';

/**
 * Card link route integration. Drives the real handlers against an in-memory
 * libsql (all migrations applied): add → list-on-card → find-by-external-key →
 * delete, plus card-DTO enrichment and the creator-or-admin 403.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let auth: AuthContext;
let projectId: string;
let cardId: string;

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
    email: 'owner@links.example',
    password: 'ownerpassword',
    name: 'Link Owner',
    tenantName: 'Link Co',
  });
  auth = {
    tenantId: reg.tenantId,
    userId: reg.userId,
    userName: 'Link Owner',
    userKind: 'human',
    role: 'admin',
    color: '#000000',
    tokenId: null,
  };
  const project = await createProject(env, reg.tenantId, reg.userId, { name: 'Board', code: 'LNK' });
  projectId = project.id;
  const card = await createCard(env, reg.tenantId, projectId, reg.userId, { summary: 'Card' });
  cardId = card.id;
});

function ctx(request: Request, params: Record<string, string>, as: AuthContext = auth): RouteContext {
  return { request, env, url: new URL(request.url), params, cors: {}, auth: as, waitUntil: () => {} };
}

async function attempt(p: Promise<Response>): Promise<{ status: number }> {
  try {
    return { status: (await p).status };
  } catch (e) {
    return { status: (e as { status?: number }).status ?? 500 };
  }
}

async function addLink(body: unknown, cid = cardId): Promise<{ status: number; body: { link: CardLinkDto } }> {
  const req = new Request(`http://x/api/v1/cards/${cid}/links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await handleAddCardLink(ctx(req, { id: cid }));
  return { status: res.status, body: (await res.json()) as { link: CardLinkDto } };
}

describe('card link routes', () => {
  it('adds a link and returns a DTO', async () => {
    const { status, body } = await addLink({
      provider: 'jira', url: 'https://jira.example/OBL-1', externalKey: 'OBL-1', title: 'The ticket',
    });
    expect(status).toBe(201);
    expect(body.link.provider).toBe('jira');
    expect(body.link.externalKey).toBe('OBL-1');
    expect(body.link.url).toBe('https://jira.example/OBL-1');
    expect(body.link.id).toMatch(/^lnk_/);
  });

  it('rejects an invalid url (400) and a missing provider (400)', async () => {
    const bad = new Request(`http://x/api/v1/cards/${cardId}/links`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'jira', url: 'not-a-url' }),
    });
    expect((await attempt(handleAddCardLink(ctx(bad, { id: cardId })))).status).toBe(400);
    const noProvider = new Request(`http://x/api/v1/cards/${cardId}/links`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://x.example/a' }),
    });
    expect((await attempt(handleAddCardLink(ctx(noProvider, { id: cardId })))).status).toBe(400);
  });

  it('enriches the single-card GET with links[] and the board list with linkCount', async () => {
    const card = await createCard(env, auth.tenantId, projectId, auth.userId, { summary: 'Enrich' });
    await addLink({ provider: 'github', url: 'https://github.com/o/r/pull/1', externalKey: 'o/r#1' }, card.id);

    const getRes = await handleGetCard(ctx(new Request(`http://x/api/v1/cards/${card.id}`), { id: card.id }));
    const getBody = (await getRes.json()) as { card: { links: CardLinkDto[] } };
    expect(getBody.card.links.map((l) => l.provider)).toEqual(['github']);

    const listRes = await handleListCards(ctx(new Request(`http://x/api/v1/projects/${projectId}/cards`), { id: projectId }));
    const listBody = (await listRes.json()) as { cards: Array<{ id: string; linkCount: number }> };
    const enriched = listBody.cards.find((c) => c.id === card.id);
    expect(enriched?.linkCount).toBe(1);
  });

  it('finds cards in a project by provider + externalKey', async () => {
    const card = await createCard(env, auth.tenantId, projectId, auth.userId, { summary: 'Findable' });
    await addLink({ provider: 'notion', url: 'https://notion.so/abc', externalKey: 'DOC-42' }, card.id);

    const res = await handleFindCardLinks(
      ctx(new Request(`http://x/api/v1/projects/${projectId}/card-links?provider=notion&externalKey=DOC-42`), { id: projectId }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: CardLinkMatch[] };
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]!.cardId).toBe(card.id);
    expect(body.matches[0]!.cardSummary).toBe('Findable');
    expect(body.matches[0]!.link.externalKey).toBe('DOC-42');
  });

  it('requires both provider and externalKey (400)', async () => {
    const res = handleFindCardLinks(
      ctx(new Request(`http://x/api/v1/projects/${projectId}/card-links?provider=notion`), { id: projectId }),
    );
    expect((await attempt(res)).status).toBe(400);
  });

  it('deletes a link (creator); then it 404s to delete again', async () => {
    const { body } = await addLink({ provider: 'jira', url: 'https://jira.example/OBL-9' });
    const id = body.link.id;
    const del = await handleDeleteCardLink(ctx(new Request(`http://x/api/v1/card-links/${id}`, { method: 'DELETE' }), { id }));
    expect(del.status).toBe(200);
    expect((await attempt(handleDeleteCardLink(ctx(new Request(`http://x/api/v1/card-links/${id}`, { method: 'DELETE' }), { id })))).status).toBe(404);
  });

  it('forbids a non-creator non-admin from deleting (403)', async () => {
    const { body } = await addLink({ provider: 'jira', url: 'https://jira.example/OBL-77' });
    const id = body.link.id;
    const stranger: AuthContext = { ...auth, userId: 'usr_stranger', role: 'member' };
    const res = handleDeleteCardLink(ctx(new Request(`http://x/api/v1/card-links/${id}`, { method: 'DELETE' }), { id }, stranger));
    expect((await attempt(res)).status).toBe(403);
  });
});
