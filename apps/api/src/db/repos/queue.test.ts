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
 * Actionable-queue repo tests (v0.15.0, KBR-11; two sections since v0.17.0,
 * KBR-61). `work` = cards assigned to the caller in a `ready`-role column;
 * `review` = cards where the caller is the reviewer in a `review`-role column.
 * Covers: section membership, moving out of the lane, reviewer set/clear with
 * its system event, the projectId scope, and reviewer access validation.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let projectId: string;
let readyColId: string;
let backlogColId: string;
let reviewColId: string;

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
  reviewColId = cols.find((c) => c.role === 'review')!.id;
});

describe('my queue — work section', () => {
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

    const { work } = await listMyQueue(env, tenantId, ownerId, { isAdmin: true });
    expect(work.map((c) => c.id)).toEqual([inReady.id]);
    // Enriched with project code/name so agents need no follow-up lookup.
    expect(work[0]!.projectCode).toBe('QUE');
    expect(work[0]!.projectName).toBe('Board');
    expect(work[0]!.key).toBe(`QUE-${work[0]!.seq}`);
  });

  it('drops a card when it moves out of the ready column', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Transient',
      columnId: readyColId,
      assigneeUserId: ownerId,
    });
    expect((await listMyQueue(env, tenantId, ownerId, { isAdmin: true })).work.some((c) => c.id === card.id)).toBe(true);

    await patchCard(env, tenantId, card.id, ownerId, { columnId: backlogColId });
    expect((await listMyQueue(env, tenantId, ownerId, { isAdmin: true })).work.some((c) => c.id === card.id)).toBe(false);
  });

  it('projectId scope narrows to the one project', async () => {
    const other = await createProject(env, tenantId, ownerId, { name: 'Other', code: 'OTH' });
    const inQue = await listMyQueue(env, tenantId, ownerId, { isAdmin: true, projectId });
    expect(inQue.work.every((c) => c.projectId === projectId)).toBe(true);
    const otherQueue = await listMyQueue(env, tenantId, ownerId, { isAdmin: true, projectId: other.id });
    expect(otherQueue.work).toEqual([]);
    expect(otherQueue.review).toEqual([]);
  });
});

describe('my queue — review section (v0.17.0, KBR-61)', () => {
  it('returns only cards where I am the reviewer in a review-role column', async () => {
    // Reviewer = me, in In Review → in the review section.
    const forReview = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Please verify',
      columnId: reviewColId,
      reviewerUserId: ownerId,
    });
    // Reviewer = me, but still in Ready → NOT in the review section.
    await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Reviewer set early',
      columnId: readyColId,
      reviewerUserId: ownerId,
    });
    // In In Review, but no reviewer → NOT in the review section.
    await createCard(env, tenantId, projectId, ownerId, {
      summary: 'In review, unowned',
      columnId: reviewColId,
    });

    const { work, review } = await listMyQueue(env, tenantId, ownerId, { isAdmin: true });
    expect(review.some((c) => c.id === forReview.id)).toBe(true);
    expect(review.every((c) => c.reviewerUserId === ownerId)).toBe(true);
    // An assigned-to-me review card doesn't leak into work (wrong lane).
    expect(work.some((c) => c.id === forReview.id)).toBe(false);
  });

  it('setting/clearing the reviewer via patch emits a `reviewer` system event', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, {
      summary: 'Handback flow',
      columnId: readyColId,
      assigneeUserId: ownerId,
    });
    // Hand back: move to review + set reviewer.
    const patched = await patchCard(env, tenantId, card.id, ownerId, {
      columnId: reviewColId,
      reviewerUserId: ownerId,
    });
    expect(patched.reviewerUserId).toBe(ownerId);
    expect((await listMyQueue(env, tenantId, ownerId, { isAdmin: true })).review.some((c) => c.id === card.id)).toBe(true);

    const events = await env.db.prepare(
      "SELECT event_type, meta_json FROM card_events WHERE card_id = ? AND event_type = 'reviewer'",
    ).bind(card.id).all<{ event_type: string; meta_json: string }>();
    expect(events.results!).toHaveLength(1);
    expect(JSON.parse(events.results![0]!.meta_json)).toEqual({ from: null, to: ownerId });

    // Clear it → gone from the review queue + a second event.
    const cleared = await patchCard(env, tenantId, card.id, ownerId, { reviewerUserId: null });
    expect(cleared.reviewerUserId).toBeNull();
    expect((await listMyQueue(env, tenantId, ownerId, { isAdmin: true })).review.some((c) => c.id === card.id)).toBe(false);
  });

  it('rejects a reviewer without project access (same rule as assignee)', async () => {
    const outsider = await registerTenant(env, {
      email: 'outsider@queue.example',
      password: 'outsiderpassword',
      name: 'Outsider',
      tenantName: 'Elsewhere Co',
    });
    await expect(
      createCard(env, tenantId, projectId, ownerId, {
        summary: 'Bad reviewer',
        reviewerUserId: outsider.userId, // different tenant → no access
      }),
    ).rejects.toThrow(/reviewer has no access/);
  });
});
