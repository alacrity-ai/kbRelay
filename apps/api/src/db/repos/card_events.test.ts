import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { listColumns } from './columns';
import { createCard, patchCard } from './cards';
import { addComment, redactComment, listProjectEvents } from './card_events';

/**
 * Project activity feed tests (v0.17.0, KBR-67). The feed = newest-first union
 * of a project's card events, enriched with cardKey/cardSummary. Covers:
 * ordering + enrichment, since filter, cursor pagination, redaction tombstones,
 * and cross-project isolation.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let projectId: string;
let otherProjectId: string;
let cardId: string;
let backlogColId: string;
let readyColId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@feed.example',
    password: 'ownerpassword',
    name: 'Feed Owner',
    tenantName: 'Feed Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;

  const project = await createProject(env, tenantId, ownerId, { name: 'Feed Board', code: 'FEED' });
  projectId = project.id;
  const cols = await listColumns(env, tenantId, projectId);
  backlogColId = cols.find((c) => c.role === null)!.id;
  readyColId = cols.find((c) => c.role === 'ready')!.id;

  const other = await createProject(env, tenantId, ownerId, { name: 'Other', code: 'OTH' });
  otherProjectId = other.id;
  await createCard(env, tenantId, otherProjectId, ownerId, { summary: 'Other-board card' });

  // One card with a life: created → commented → moved.
  const card = await createCard(env, tenantId, projectId, ownerId, {
    summary: 'Watched card',
    columnId: backlogColId,
  });
  cardId = card.id;
  await addComment(env, tenantId, cardId, ownerId, { type: 'note', body: 'first note' });
  await patchCard(env, tenantId, cardId, ownerId, { columnId: readyColId });
});

describe('project activity feed', () => {
  it('returns newest-first events enriched with cardKey + cardSummary', async () => {
    const { events } = await listProjectEvents(env, tenantId, projectId);
    expect(events.length).toBeGreaterThanOrEqual(3); // created, note, moved
    // Newest-first.
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1]!.createdAt).toBeGreaterThanOrEqual(events[i]!.createdAt);
    }
    const note = events.find((e) => e.kind === 'note');
    expect(note?.body).toBe('first note');
    expect(note?.cardKey).toMatch(/^FEED-\d+$/);
    expect(note?.cardSummary).toBe('Watched card');
    // Cross-project isolation: nothing from the OTH board leaks in.
    expect(events.every((e) => e.cardKey?.startsWith('FEED'))).toBe(true);
  });

  it('since= lower-bounds the feed', async () => {
    const { events: all } = await listProjectEvents(env, tenantId, projectId);
    const oldest = all[all.length - 1]!;
    const { events } = await listProjectEvents(env, tenantId, projectId, {
      since: oldest.createdAt + 1,
    });
    expect(events.some((e) => e.id === oldest.id)).toBe(false);
  });

  it('cursor pages older without overlap or gaps', async () => {
    const page1 = await listProjectEvents(env, tenantId, projectId, { limit: 2 });
    expect(page1.events).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await listProjectEvents(env, tenantId, projectId, {
      limit: 200,
      cursor: page1.nextCursor!,
    });
    const ids1 = new Set(page1.events.map((e) => e.id));
    expect(page2.events.every((e) => !ids1.has(e.id))).toBe(true);
    const { events: all } = await listProjectEvents(env, tenantId, projectId);
    expect(page1.events.length + page2.events.length).toBe(all.length);
    expect(page2.nextCursor).toBeNull();
  });

  it('a redacted comment appears as a tombstone (no body/meta)', async () => {
    const c = await addComment(env, tenantId, cardId, ownerId, { type: 'note', body: 'oops secret' });
    await redactComment(env, tenantId, cardId, c.id, ownerId);
    const { events } = await listProjectEvents(env, tenantId, projectId);
    const tomb = events.find((e) => e.id === c.id);
    expect(tomb).toBeDefined();
    expect(tomb!.body).toBeNull();
    expect(tomb!.deletedAt).not.toBeNull();
    expect(tomb!.deletedBy).toBe(ownerId);
  });

  it('a malformed cursor is ignored (starts from the top)', async () => {
    const { events } = await listProjectEvents(env, tenantId, projectId, { cursor: 'garbage' });
    const { events: all } = await listProjectEvents(env, tenantId, projectId);
    expect(events.length).toBe(all.length);
  });
});
