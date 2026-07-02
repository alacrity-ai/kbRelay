import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { createCard, patchCard } from './cards';
import { listTimeline } from './card_events';

/**
 * Checkbox-only edits log a compact `task` event, not `edited` (KBR-72) —
 * a run of checklist clicks no longer spams the activity feed. Anything
 * beyond a toggle still logs `edited` with its field list.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let projectId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@tasks.example',
    password: 'ownerpassword',
    name: 'Task Owner',
    tenantName: 'Task Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'TSK' });
  projectId = project.id;
});

describe('task events (KBR-72)', () => {
  it('a checkbox-only patch emits `task` with final counts, not `edited`', async () => {
    const ac = '- [ ] one\n- [ ] two\n- [x] three';
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Checklist card', acceptanceCriteria: ac,
    });
    await patchCard(env, tenantId, card.id, ownerId, {
      acceptanceCriteria: ac.replace('- [ ] one', '- [x] one'),
    });
    const events = await listTimeline(env, tenantId, card.id);
    expect(events.some((e) => e.eventType === 'edited')).toBe(false);
    const task = events.find((e) => e.eventType === 'task');
    expect(task?.meta).toMatchObject({ fields: ['acceptanceCriteria'], done: 2, total: 3 });
  });

  it('a text change (even alongside a toggle) still emits `edited`', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Prose card', description: '- [ ] item\nprose',
    });
    await patchCard(env, tenantId, card.id, ownerId, {
      description: '- [x] item\nreworded prose',
    });
    const events = await listTimeline(env, tenantId, card.id);
    expect(events.some((e) => e.eventType === 'task')).toBe(false);
    expect(events.find((e) => e.eventType === 'edited')?.meta).toMatchObject({ fields: ['description'] });
  });

  it('toggles in both fields in one patch still classify as `task`', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Two-field card', description: '- [ ] d1', acceptanceCriteria: '- [ ] a1',
    });
    await patchCard(env, tenantId, card.id, ownerId, {
      description: '- [x] d1', acceptanceCriteria: '- [x] a1',
    });
    const events = await listTimeline(env, tenantId, card.id);
    const task = events.find((e) => e.eventType === 'task');
    expect(task?.meta).toMatchObject({ fields: ['description', 'acceptanceCriteria'], done: 2, total: 2 });
    expect(events.some((e) => e.eventType === 'edited')).toBe(false);
  });
});
