import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DUE_SOON_WINDOW_MS } from '@kbrelay/shared';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { listColumns } from './columns';
import { createCard, patchCard, listCards, listMyQueue } from './cards';
import { listTimeline } from './card_events';

/**
 * Due dates (v0.17.0, KBR-63): set/clear through create+patch with a `due`
 * system event, the ?due=overdue|soon filters, ?sort=due ordering (undated
 * last), and due-first queue ordering.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let projectId: string;
let readyColId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@due.example',
    password: 'ownerpassword',
    name: 'Due Owner',
    tenantName: 'Due Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'DUE' });
  projectId = project.id;
  const cols = await listColumns(env, tenantId, projectId);
  readyColId = cols.find((c) => c.role === 'ready')!.id;
});

describe('due dates on cards', () => {
  it('round-trips through create, emits a due event on change, and clears with null', async () => {
    const due = Date.now() + 3 * 24 * 3600 * 1000;
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Dated at birth',
      dueAt: due,
    });
    expect(card.dueAt).toBe(due);

    const moved = await patchCard(env, tenantId, card.id, ownerId, { dueAt: due + 1000 });
    expect(moved.dueAt).toBe(due + 1000);

    const cleared = await patchCard(env, tenantId, card.id, ownerId, { dueAt: null });
    expect(cleared.dueAt).toBeNull();

    const events = await listTimeline(env, tenantId, card.id);
    const dueEvents = events.filter((e) => e.eventType === 'due');
    expect(dueEvents).toHaveLength(2);
    expect(dueEvents[0]!.meta).toMatchObject({ from: due, to: due + 1000 });
    expect(dueEvents[1]!.meta).toMatchObject({ from: due + 1000, to: null });
  });

  it('a patch that does not mention dueAt leaves it alone (no due event)', async () => {
    const due = Date.now() + 24 * 3600 * 1000;
    const card = await createCard(env, tenantId, projectId, ownerId, { summary: 'Stable', dueAt: due });
    const patched = await patchCard(env, tenantId, card.id, ownerId, { summary: 'Stable v2' });
    expect(patched.dueAt).toBe(due);
    const events = await listTimeline(env, tenantId, card.id);
    expect(events.some((e) => e.eventType === 'due')).toBe(false);
  });

  it('filters ?due=overdue and ?due=soon; both exclude undated cards', async () => {
    const now = Date.now();
    const proj = await createProject(env, tenantId, ownerId, { name: 'Filters', code: 'DUF' });
    const overdue = await createCard(env, tenantId, proj.id, ownerId, { summary: 'Late', dueAt: now - 3600_000 });
    const soon = await createCard(env, tenantId, proj.id, ownerId, { summary: 'Imminent', dueAt: now + 3600_000 });
    const far = await createCard(env, tenantId, proj.id, ownerId, { summary: 'Distant', dueAt: now + DUE_SOON_WINDOW_MS + 3600_000 });
    await createCard(env, tenantId, proj.id, ownerId, { summary: 'Undated' });

    const late = await listCards(env, tenantId, proj.id, { due: 'overdue' });
    expect(late.map((c) => c.id)).toEqual([overdue.id]);

    const imminent = await listCards(env, tenantId, proj.id, { due: 'soon' });
    expect(imminent.map((c) => c.id)).toEqual([soon.id]);
    expect(imminent.some((c) => c.id === far.id)).toBe(false);
  });

  it('?sort=due orders due-soonest first with undated cards last', async () => {
    const now = Date.now();
    const proj = await createProject(env, tenantId, ownerId, { name: 'Sorting', code: 'DUS' });
    const later = await createCard(env, tenantId, proj.id, ownerId, { summary: 'B', dueAt: now + 2000 });
    const undated = await createCard(env, tenantId, proj.id, ownerId, { summary: 'C' });
    const sooner = await createCard(env, tenantId, proj.id, ownerId, { summary: 'A', dueAt: now + 1000 });

    const sorted = await listCards(env, tenantId, proj.id, { sort: 'due' });
    expect(sorted.map((c) => c.id)).toEqual([sooner.id, later.id, undated.id]);
  });

  it('my queue orders work due-first, undated last', async () => {
    const now = Date.now();
    const undated = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Queue undated', columnId: readyColId, assigneeUserId: ownerId,
    });
    const dated = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Queue dated', columnId: readyColId, assigneeUserId: ownerId, dueAt: now + 1000,
    });
    // The undated card is newer-updated; without due-first it would sort first.
    await patchCard(env, tenantId, undated.id, ownerId, { summary: 'Queue undated v2' });

    const { work } = await listMyQueue(env, tenantId, ownerId, { isAdmin: true, projectId });
    const ids = work.map((c) => c.id);
    expect(ids.indexOf(dated.id)).toBeLessThan(ids.indexOf(undated.id));
  });
});
