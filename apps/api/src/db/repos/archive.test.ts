import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject, patchProject, getProject } from './projects';
import { listColumns } from './columns';
import { createCard, patchCard, listCards, listMyQueue, autoArchiveDone, countArchivedCards } from './cards';
import { listTimeline, addComment } from './card_events';

/**
 * Card archiving (v0.17.0, KBR-60): a visibility flag, nothing more. Covers
 * archive/restore via patch (+ events), default-list exclusion vs ?archived,
 * queue exclusion, timeline survival across the round trip, restore-to-same-
 * column, and the lazy done-column auto-archive.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let projectId: string;
let readyColId: string;
let doneColId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@arch.example',
    password: 'ownerpassword',
    name: 'Arch Owner',
    tenantName: 'Arch Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'ARC' });
  projectId = project.id;
  const cols = await listColumns(env, tenantId, projectId);
  readyColId = cols.find((c) => c.role === 'ready')!.id;
  doneColId = cols.find((c) => c.role === 'done')!.id;
});

describe('card archiving', () => {
  it('archive + restore round-trip: events, list visibility, same column, timeline survives', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Round tripper', columnId: readyColId,
    });
    await addComment(env, tenantId, card.id, ownerId, { type: 'note', body: 'pre-archive note' });

    const archived = await patchCard(env, tenantId, card.id, ownerId, { archived: true });
    expect(archived.archivedAt).not.toBeNull();

    // Gone from the default list; present in the archived lens.
    const active = await listCards(env, tenantId, projectId);
    expect(active.some((c) => c.id === card.id)).toBe(false);
    const archLens = await listCards(env, tenantId, projectId, { archived: true });
    expect(archLens.some((c) => c.id === card.id)).toBe(true);

    // Re-archiving is idempotent on the timestamp.
    const again = await patchCard(env, tenantId, card.id, ownerId, { archived: true });
    expect(again.archivedAt).toBe(archived.archivedAt);

    const restored = await patchCard(env, tenantId, card.id, ownerId, { archived: false });
    expect(restored.archivedAt).toBeNull();
    expect(restored.columnId).toBe(readyColId); // back where it left

    const events = await listTimeline(env, tenantId, card.id);
    expect(events.filter((e) => e.eventType === 'archived')).toHaveLength(1);
    expect(events.filter((e) => e.eventType === 'restored')).toHaveLength(1);
    // The comment survived the round trip.
    expect(events.some((e) => e.kind === 'note' && e.body === 'pre-archive note')).toBe(true);
  });

  it('archived cards leave the queue', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Queued then archived', columnId: readyColId, assigneeUserId: ownerId,
    });
    let { work } = await listMyQueue(env, tenantId, ownerId, { isAdmin: true, projectId });
    expect(work.some((c) => c.id === card.id)).toBe(true);

    await patchCard(env, tenantId, card.id, ownerId, { archived: true });
    ({ work } = await listMyQueue(env, tenantId, ownerId, { isAdmin: true, projectId }));
    expect(work.some((c) => c.id === card.id)).toBe(false);
  });

  it('lazy auto-archive sweeps only stale done-column cards, with a null-author event', async () => {
    const stale = await createCard(env, tenantId, projectId, ownerId, { summary: 'Old done', columnId: doneColId });
    const freshDone = await createCard(env, tenantId, projectId, ownerId, { summary: 'New done', columnId: doneColId });
    const staleReady = await createCard(env, tenantId, projectId, ownerId, { summary: 'Old but not done', columnId: readyColId });
    // Age the stale cards well past the 30-day policy.
    const old = Date.now() - 40 * 86_400_000;
    await env.db.prepare('UPDATE cards SET updated_at = ? WHERE id IN (?, ?)').bind(old, stale.id, staleReady.id).run();

    const n = await autoArchiveDone(env, tenantId, projectId, 30);
    expect(n).toBe(1);

    const active = await listCards(env, tenantId, projectId);
    expect(active.some((c) => c.id === stale.id)).toBe(false);
    expect(active.some((c) => c.id === freshDone.id)).toBe(true);
    expect(active.some((c) => c.id === staleReady.id)).toBe(true); // not a done column

    const events = await listTimeline(env, tenantId, stale.id);
    const ev = events.find((e) => e.eventType === 'archived');
    expect(ev?.authorUserId).toBeNull();
    expect(ev?.meta).toMatchObject({ auto: true, days: 30 });
  });

  it('the autoArchiveDoneDays knob round-trips through project patch', async () => {
    await patchProject(env, tenantId, projectId, { autoArchiveDoneDays: 14 });
    expect((await getProject(env, tenantId, projectId))?.autoArchiveDoneDays).toBe(14);
    await patchProject(env, tenantId, projectId, { autoArchiveDoneDays: null });
    expect((await getProject(env, tenantId, projectId))?.autoArchiveDoneDays).toBeNull();
  });

  it('countArchivedCards is project-scoped and tracks archive/restore (KBR-75)', async () => {
    const proj = await createProject(env, tenantId, ownerId, { name: 'Counting', code: 'CNT' });
    expect(await countArchivedCards(env, tenantId, proj.id)).toBe(0);

    const a = await createCard(env, tenantId, proj.id, ownerId, { summary: 'a' });
    const b = await createCard(env, tenantId, proj.id, ownerId, { summary: 'b' });
    // A card in a DIFFERENT project must not leak into this project's count.
    const other = await createCard(env, tenantId, projectId, ownerId, { summary: 'elsewhere' });
    await patchCard(env, tenantId, other.id, ownerId, { archived: true });

    await patchCard(env, tenantId, a.id, ownerId, { archived: true });
    await patchCard(env, tenantId, b.id, ownerId, { archived: true });
    expect(await countArchivedCards(env, tenantId, proj.id)).toBe(2);

    await patchCard(env, tenantId, a.id, ownerId, { archived: false });
    expect(await countArchivedCards(env, tenantId, proj.id)).toBe(1);
  });
});
