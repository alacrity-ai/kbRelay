import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { listColumns } from './columns';
import { createCard, patchCard, listMyQueue } from './cards';

/**
 * Actionable-queue repo tests (v0.15.0, KBR-11). The queue = cards assigned to
 * the caller that sit in a `ready`-role column. Covers: only ready+assigned
 * cards appear; a ready card assigned to someone else does not; moving out of
 * ready removes it; the projectId scope narrows results.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let projectId: string;
let readyColId: string;
let backlogColId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@queue.example',
    password: 'ownerpassword',
    name: 'Queue Owner',
    tenantName: 'Queue Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'QUE' });
  projectId = project.id;
  const cols = await listColumns(env, tenantId, projectId);
  readyColId = cols.find((c) => c.role === 'ready')!.id;
  backlogColId = cols.find((c) => c.role === null)!.id;
});

describe('my queue', () => {
  it('returns only cards assigned to me that are in a ready-role column', async () => {
    // Assigned to me, in Ready → in queue.
    const inReady = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Do the thing',
      columnId: readyColId,
      assigneeUserId: ownerId,
    });
    // Assigned to me, but in Backlog → NOT in queue.
    await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Not ready yet',
      columnId: backlogColId,
      assigneeUserId: ownerId,
    });
    // In Ready, but unassigned → NOT in queue.
    await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Ready but nobody assigned',
      columnId: readyColId,
      assigneeUserId: null,
    });

    const queue = await listMyQueue(env, tenantId, ownerId, { isAdmin: true });
    expect(queue.map((c) => c.id)).toEqual([inReady.id]);
    // Enriched with project code/name so agents need no follow-up lookup.
    expect(queue[0]!.projectCode).toBe('QUE');
    expect(queue[0]!.projectName).toBe('Board');
    expect(queue[0]!.key).toBe(`QUE-${queue[0]!.seq}`);
  });

  it('drops a card when it moves out of the ready column', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Transient',
      columnId: readyColId,
      assigneeUserId: ownerId,
    });
    expect((await listMyQueue(env, tenantId, ownerId, { isAdmin: true })).some((c) => c.id === card.id)).toBe(true);

    await patchCard(env, tenantId, card.id, ownerId, { columnId: backlogColId });
    expect((await listMyQueue(env, tenantId, ownerId, { isAdmin: true })).some((c) => c.id === card.id)).toBe(false);
  });

  it('projectId scope narrows to the one project', async () => {
    const other = await createProject(env, tenantId, ownerId, { name: 'Other', code: 'OTH' });
    const inQue = await listMyQueue(env, tenantId, ownerId, { isAdmin: true, projectId });
    expect(inQue.every((c) => c.projectId === projectId)).toBe(true);
    expect(await listMyQueue(env, tenantId, ownerId, { isAdmin: true, projectId: other.id })).toEqual([]);
  });
});
