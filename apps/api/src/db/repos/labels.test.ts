import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { MAX_LABELS_PER_PROJECT } from '@kbrelay/shared';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { createCard, patchCard, listCards } from './cards';
import { listTimeline } from './card_events';
import { createLabel, listLabels, patchLabel, deleteLabel, labelsForCards } from './labels';

/**
 * Labels (v0.17.0, KBR-62): flat + capped palette. Covers CRUD, the 12-cap and
 * case-insensitive uniqueness (409s), set-by-ids and set-by-names on cards,
 * unknown-name 400, the `labels` system event diff, the ?label filter, and
 * delete-unlinks.
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
    email: 'owner@labels.example',
    password: 'ownerpassword',
    name: 'Label Owner',
    tenantName: 'Label Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'LBL' });
  projectId = project.id;
});

describe('labels', () => {
  it('creates, renames, recolors; duplicate names 409 case-insensitively', async () => {
    const bug = await createLabel(env, tenantId, projectId, { name: 'bug', color: '#dc2626' });
    expect(bug.name).toBe('bug');
    await expect(createLabel(env, tenantId, projectId, { name: 'BUG', color: '#000000' }))
      .rejects.toThrow(/already exists/);

    const renamed = await patchLabel(env, tenantId, bug.id, { name: 'defect' });
    expect(renamed.name).toBe('defect');
    const recolored = await patchLabel(env, tenantId, bug.id, { color: '#16a34a' });
    expect(recolored.color).toBe('#16a34a');
  });

  it('caps at 12 per project with a 409', async () => {
    const proj = await createProject(env, tenantId, ownerId, { name: 'Cap', code: 'CAP' });
    for (let i = 0; i < MAX_LABELS_PER_PROJECT; i++) {
      await createLabel(env, tenantId, proj.id, { name: `l${i}`, color: '#123456' });
    }
    await expect(createLabel(env, tenantId, proj.id, { name: 'overflow', color: '#123456' }))
      .rejects.toThrow(/cap/i);
  });

  it('sets labels on a card by ids and by names; unknown name is a 400', async () => {
    const ui = await createLabel(env, tenantId, projectId, { name: 'ui', color: '#7c3aed' });
    const chore = await createLabel(env, tenantId, projectId, { name: 'chore', color: '#64748b' });

    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Labeled at birth', labelNames: ['UI'], // case-insensitive resolve
    });
    let labels = await labelsForCards(env, tenantId, [card.id]);
    expect(labels[card.id]?.map((l) => l.id)).toEqual([ui.id]);

    await patchCard(env, tenantId, card.id, ownerId, { labelIds: [ui.id, chore.id] });
    labels = await labelsForCards(env, tenantId, [card.id]);
    expect(labels[card.id]?.map((l) => l.name).sort()).toEqual(['chore', 'ui']);

    await expect(
      patchCard(env, tenantId, card.id, ownerId, { labelNames: ['nope'] }),
    ).rejects.toThrow(/Unknown label/);

    // The diff event logs names, added and removed.
    await patchCard(env, tenantId, card.id, ownerId, { labelNames: ['chore'] });
    const events = await listTimeline(env, tenantId, card.id);
    const labelEvents = events.filter((e) => e.eventType === 'labels');
    // create carries no event; the two successful patches each do.
    expect(labelEvents).toHaveLength(2);
    expect(labelEvents[1]!.meta).toMatchObject({ added: [], removed: ['ui'] });
  });

  it('?label filters the card list; deleting a label unlinks it', async () => {
    const perf = await createLabel(env, tenantId, projectId, { name: 'perf', color: '#d97706' });
    const tagged = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Tagged', labelIds: [perf.id],
    });
    await createCard(env, tenantId, projectId, ownerId, { summary: 'Untagged' });

    const filtered = await listCards(env, tenantId, projectId, { label: perf.id });
    expect(filtered.map((c) => c.id)).toEqual([tagged.id]);

    await deleteLabel(env, tenantId, perf.id);
    expect((await listLabels(env, tenantId, projectId)).some((l) => l.id === perf.id)).toBe(false);
    const after = await labelsForCards(env, tenantId, [tagged.id]);
    expect(after[tagged.id] ?? []).toEqual([]);
  });

  it('rejects labelIds and labelNames together', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, { summary: 'Both' });
    await expect(
      patchCard(env, tenantId, card.id, ownerId, { labelIds: [], labelNames: [] }),
    ).rejects.toThrow(/not both/);
  });
});
