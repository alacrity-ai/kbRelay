import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { listColumns, createColumn, patchColumn } from './columns';

/**
 * Column-role repo tests (v0.15.0, KBR-9 + KBR-10). In-memory libsql with the
 * SAME migration tree as prod (incl. 0013). Covers: new projects seed the
 * 6-lane default board with roles pre-wired; a role is unique per project and
 * reassigning it "yanks" it off the previous holder (via both patch and create);
 * clearing a role touches nothing else.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let projectId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  }
  env = {
    db,
    ALLOWED_ORIGINS: '*',
    PUBLIC_BASE_URL: 'http://localhost:8080',
    JWT_SECRET: 'test-secret',
  } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@cols.example',
    password: 'ownerpassword',
    name: 'Col Owner',
    tenantName: 'Cols Co',
  });
  tenantId = reg.tenantId;
  const project = await createProject(env, tenantId, reg.userId, { name: 'Board', code: 'COL' });
  projectId = project.id;
});

describe('column roles', () => {
  it('seeds the 6-lane default board with roles pre-wired', async () => {
    const cols = await listColumns(env, tenantId, projectId);
    expect(cols.map((c) => [c.name, c.role])).toEqual([
      ['Backlog', null],
      ['Blocked', 'blocked'],
      ['Ready', 'ready'],
      ['In Progress', 'in_progress'],
      ['In Review', 'review'],
      ['Done', 'done'],
    ]);
  });

  it('reassigning a role via patch yanks it off the previous holder', async () => {
    const before = await listColumns(env, tenantId, projectId);
    const backlog = before.find((c) => c.name === 'Backlog')!;
    const ready = before.find((c) => c.role === 'ready')!;

    // Make Backlog the Ready column.
    const patched = await patchColumn(env, tenantId, backlog.id, { role: 'ready' });
    expect(patched.role).toBe('ready');

    const after = await listColumns(env, tenantId, projectId);
    // Exactly one column holds 'ready', and it's Backlog now — old holder cleared.
    expect(after.filter((c) => c.role === 'ready').map((c) => c.id)).toEqual([backlog.id]);
    expect(after.find((c) => c.id === ready.id)!.role).toBeNull();

    // Restore for later assertions.
    await patchColumn(env, tenantId, ready.id, { role: 'ready' });
  });

  it('clearing a role (null) leaves other columns untouched', async () => {
    const before = await listColumns(env, tenantId, projectId);
    const blocked = before.find((c) => c.role === 'blocked')!;
    const readyId = before.find((c) => c.role === 'ready')!.id;

    const cleared = await patchColumn(env, tenantId, blocked.id, { role: null });
    expect(cleared.role).toBeNull();

    const after = await listColumns(env, tenantId, projectId);
    expect(after.find((c) => c.id === readyId)!.role).toBe('ready'); // unaffected
    expect(after.filter((c) => c.role === 'blocked')).toHaveLength(0);

    await patchColumn(env, tenantId, blocked.id, { role: 'blocked' }); // restore
  });

  it('creating a column with a role yanks it off the previous holder', async () => {
    const created = await createColumn(env, tenantId, projectId, { name: 'QA', role: 'review' });
    expect(created.role).toBe('review');

    const after = await listColumns(env, tenantId, projectId);
    expect(after.filter((c) => c.role === 'review').map((c) => c.id)).toEqual([created.id]);
    expect(after.find((c) => c.name === 'In Review')!.role).toBeNull();
  });
});
