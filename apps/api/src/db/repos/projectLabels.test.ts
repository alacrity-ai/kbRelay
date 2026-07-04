import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { MAX_PROJECT_LABELS_PER_TENANT } from '@kbrelay/shared';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject, deleteProject } from './projects';
import {
  createProjectLabel,
  listProjectLabels,
  patchProjectLabel,
  deleteProjectLabel,
  labelsForProjects,
  resolveProjectLabelSelection,
  setProjectLabels,
} from './projectLabels';

/**
 * Project labels (KBR-84): tenant-scoped organising buckets. Covers CRUD, the
 * per-tenant cap and case-insensitive uniqueness (409s), attach by ids and by
 * names, unknown-name 400, both-provided 400, the grouped labelsForProjects
 * embed, delete-unlinks, and the project-delete cascade (labels survive).
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
    email: 'owner@plabels.example',
    password: 'ownerpassword',
    name: 'PLabel Owner',
    tenantName: 'PLabel Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'PLB' });
  projectId = project.id;
});

describe('project labels', () => {
  it('creates, renames, recolors; duplicate names 409 case-insensitively', async () => {
    const side = await createProjectLabel(env, tenantId, { name: 'Side gigs', color: '#dc2626' });
    expect(side.name).toBe('Side gigs');
    await expect(createProjectLabel(env, tenantId, { name: 'side GIGS', color: '#000000' }))
      .rejects.toThrow(/already exists/);

    const renamed = await patchProjectLabel(env, tenantId, side.id, { name: 'Moonlighting' });
    expect(renamed.name).toBe('Moonlighting');
    const recolored = await patchProjectLabel(env, tenantId, side.id, { color: '#16a34a' });
    expect(recolored.color).toBe('#16a34a');
  });

  it('caps per tenant with a 409', async () => {
    const { db, client } = createLibsqlDb(':memory:');
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
    const capEnv = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;
    const reg = await registerTenant(capEnv, {
      email: 'cap@plabels.example', password: 'ownerpassword', name: 'Cap', tenantName: 'Cap Co',
    });
    for (let i = 0; i < MAX_PROJECT_LABELS_PER_TENANT; i++) {
      await createProjectLabel(capEnv, reg.tenantId, { name: `bucket${i}`, color: '#123456' });
    }
    await expect(createProjectLabel(capEnv, reg.tenantId, { name: 'overflow', color: '#123456' }))
      .rejects.toThrow(/cap/i);
  });

  it('attaches labels to a project by ids and by names; unknown name is a 400', async () => {
    const day = await createProjectLabel(env, tenantId, { name: 'Day Job', color: '#7c3aed' });
    const home = await createProjectLabel(env, tenantId, { name: 'Home', color: '#64748b' });

    // by names (case-insensitive)
    const byName = await resolveProjectLabelSelection(env, tenantId, { labelNames: ['DAY JOB'] });
    await setProjectLabels(env, tenantId, projectId, byName.map((l) => l.id));
    let embed = await labelsForProjects(env, tenantId, [projectId]);
    expect(embed[projectId]?.map((l) => l.id)).toEqual([day.id]);

    // by ids (replace set)
    const byId = await resolveProjectLabelSelection(env, tenantId, { labelIds: [day.id, home.id] });
    await setProjectLabels(env, tenantId, projectId, byId.map((l) => l.id));
    embed = await labelsForProjects(env, tenantId, [projectId]);
    expect(embed[projectId]?.map((l) => l.name).sort()).toEqual(['Day Job', 'Home']);

    await expect(resolveProjectLabelSelection(env, tenantId, { labelNames: ['nope'] }))
      .rejects.toThrow(/Unknown project-label/);
  });

  it('rejects labelIds and labelNames together', async () => {
    await expect(resolveProjectLabelSelection(env, tenantId, { labelIds: [], labelNames: [] }))
      .rejects.toThrow(/not both/);
  });

  it('empty labelIds clears a project’s labels', async () => {
    await setProjectLabels(env, tenantId, projectId, []);
    const embed = await labelsForProjects(env, tenantId, [projectId]);
    expect(embed[projectId] ?? []).toEqual([]);
  });

  it('deleting a label unlinks it from every project but keeps other labels', async () => {
    const focus = await createProjectLabel(env, tenantId, { name: 'Focus', color: '#d97706' });
    await setProjectLabels(env, tenantId, projectId, [focus.id]);
    expect((await labelsForProjects(env, tenantId, [projectId]))[projectId]?.map((l) => l.id)).toEqual([focus.id]);

    await deleteProjectLabel(env, tenantId, focus.id);
    expect((await listProjectLabels(env, tenantId)).some((l) => l.id === focus.id)).toBe(false);
    expect((await labelsForProjects(env, tenantId, [projectId]))[projectId] ?? []).toEqual([]);
  });

  it('deleting a project unlinks it but leaves the tenant labels intact', async () => {
    const gig = await createProjectLabel(env, tenantId, { name: 'Gig', color: '#0891b2' });
    const temp = await createProject(env, tenantId, ownerId, { name: 'Temp', code: 'TMP' });
    await setProjectLabels(env, tenantId, temp.id, [gig.id]);

    await deleteProject(env, tenantId, temp.id);

    // The link is gone…
    expect((await labelsForProjects(env, tenantId, [temp.id]))[temp.id] ?? []).toEqual([]);
    // …but the label itself survives (it's tenant-owned).
    expect((await listProjectLabels(env, tenantId)).some((l) => l.id === gig.id)).toBe(true);
  });
});
