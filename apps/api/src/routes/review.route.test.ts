import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AuthContext, CardDto, CardEventDto } from '@kbrelay/shared';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import type { Env } from '../env';
import type { RouteContext } from '../router';
import { registerTenant } from '../db/repos/auth';
import { createProject } from '../db/repos/projects';
import { createColumn, listColumns, patchColumn } from '../db/repos/columns';
import { createCard } from '../db/repos/cards';
import { listTimeline } from '../db/repos/card_events';
import { handleReviewCard } from './cards';

/**
 * Reviewer-verdict route (KBR-110). Drives the real handler against an
 * in-memory libsql: reviewer-only 403, review-column-only 400, approve
 * (review event + AC completion + move to done), reject (move to in
 * progress, AC untouched), and the missing-target-column no-move case.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let reviewer: AuthContext;
let projectId: string;
let reviewColId: string;
let doneColId: string;
let inProgressColId: string;

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
    email: 'reviewer@review.example',
    password: 'reviewerpassword',
    name: 'Rev Iewer',
    tenantName: 'Review Co',
  });
  reviewer = {
    tenantId: reg.tenantId,
    userId: reg.userId,
    userName: 'Rev Iewer',
    userKind: 'human',
    role: 'admin',
    color: '#000000',
    tokenId: null,
  };
  const project = await createProject(env, reg.tenantId, reg.userId, { name: 'Board', code: 'REV' });
  projectId = project.id;
  reviewColId = (await createColumn(env, reg.tenantId, projectId, { name: 'In Review', role: 'review' })).id;
  doneColId = (await createColumn(env, reg.tenantId, projectId, { name: 'Done', role: 'done' })).id;
  inProgressColId = (await createColumn(env, reg.tenantId, projectId, { name: 'Doing', role: 'in_progress' })).id;
});

function ctx(body: unknown, cardId: string, as: AuthContext = reviewer): RouteContext {
  const request = new Request(`http://test/api/v1/cards/${cardId}/review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { request, env, url: new URL(request.url), params: { id: cardId }, cors: {}, auth: as, waitUntil: () => {} };
}

async function seedCard(overrides: Partial<{ columnId: string; acceptanceCriteria: string; reviewerUserId: string | null }> = {}): Promise<CardDto> {
  return createCard(env, reviewer.tenantId, projectId, reviewer.userId, {
    summary: 'Reviewable card',
    columnId: overrides.columnId ?? reviewColId,
    acceptanceCriteria: overrides.acceptanceCriteria ?? '- [ ] first\n- [x] second\n- [ ] third',
    reviewerUserId: 'reviewerUserId' in overrides ? overrides.reviewerUserId : reviewer.userId,
  });
}

describe('POST /cards/:id/review', () => {
  it('403 when the caller is not the assigned reviewer', async () => {
    const card = await seedCard();
    const notReviewer: AuthContext = { ...reviewer, userId: 'u_someone_else' };
    await expect(handleReviewCard(ctx({ decision: 'approve' }, card.id, notReviewer)))
      .rejects.toMatchObject({ status: 403 });
    // No reviewer at all → also 403 for everyone.
    const orphan = await seedCard({ reviewerUserId: null });
    await expect(handleReviewCard(ctx({ decision: 'approve' }, orphan.id)))
      .rejects.toMatchObject({ status: 403 });
  });

  it('400 when the card is not in a review-role column', async () => {
    const card = await seedCard({ columnId: inProgressColId });
    await expect(handleReviewCard(ctx({ decision: 'approve' }, card.id)))
      .rejects.toMatchObject({ status: 400 });
  });

  it('approve: review event + AC completion + move to the done column', async () => {
    const card = await seedCard();
    const res = await handleReviewCard(ctx({ decision: 'approve', body: 'Looks great — verified live.' }, card.id));
    expect(res.status).toBe(200);
    const { card: updated, event } = await res.json() as { card: CardDto; event: CardEventDto };

    expect(event.kind).toBe('review');
    expect(event.meta).toMatchObject({ decision: 'approved' });
    expect(event.body).toBe('Looks great — verified live.');

    expect(updated.columnId).toBe(doneColId);
    expect(updated.acceptanceCriteria).toBe('- [x] first\n- [x] second\n- [x] third');

    // Timeline carries the verdict + the quiet task edit + the move.
    const events = await listTimeline(env, reviewer.tenantId, card.id);
    const kinds = events.map((e) => `${e.kind}${e.eventType ? `:${e.eventType}` : ''}`);
    expect(kinds).toContain('review');
    expect(kinds).toContain('system:moved');
  });

  it('reject: review event + move back to in progress, AC untouched', async () => {
    const card = await seedCard();
    const res = await handleReviewCard(ctx({ decision: 'reject', body: 'Needs another pass.' }, card.id));
    const { card: updated, event } = await res.json() as { card: CardDto; event: CardEventDto };

    expect(event.meta).toMatchObject({ decision: 'rejected' });
    expect(updated.columnId).toBe(inProgressColId);
    expect(updated.acceptanceCriteria).toBe('- [ ] first\n- [x] second\n- [ ] third');
  });

  it('body is optional — the verdict still lands', async () => {
    const card = await seedCard();
    const res = await handleReviewCard(ctx({ decision: 'approve' }, card.id));
    const { event } = await res.json() as { event: CardEventDto };
    expect(event.kind).toBe('review');
    expect(event.body).toBeNull();
  });

  it('missing target column: verdict lands, card stays put', async () => {
    // A board with no done-role column — nowhere for approve to move to.
    // createProject seeds DEFAULT_COLUMNS (which include one), so strip the
    // role off every seeded column first.
    const bare = await createProject(env, reviewer.tenantId, reviewer.userId, { name: 'Bare', code: 'BARE' });
    for (const col of await listColumns(env, reviewer.tenantId, bare.id)) {
      if (col.role) await patchColumn(env, reviewer.tenantId, col.id, { role: null });
    }
    const bareReview = await createColumn(env, reviewer.tenantId, bare.id, { name: 'Review', role: 'review' });
    const card = await createCard(env, reviewer.tenantId, bare.id, reviewer.userId, {
      summary: 'No done column',
      columnId: bareReview.id,
      acceptanceCriteria: '- [ ] only',
      reviewerUserId: reviewer.userId,
    });
    const res = await handleReviewCard(ctx({ decision: 'approve', body: 'ok' }, card.id));
    const { card: updated, event } = await res.json() as { card: CardDto; event: CardEventDto };
    expect(event.kind).toBe('review');
    expect(updated.columnId).toBe(bareReview.id); // unmoved
    expect(updated.acceptanceCriteria).toBe('- [x] only'); // AC still completed
  });
});
