import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AuthContext } from '@kbrelay/shared';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import type { Env } from '../env';
import type { RouteContext } from '../router';
import { registerTenant } from '../db/repos/auth';
import { createProject } from '../db/repos/projects';
import { listColumns } from '../db/repos/columns';
import { createCard, patchCard } from '../db/repos/cards';
import { addComment } from '../db/repos/card_events';
import { createAgent } from '../db/repos/agents';
import { projectAnalytics, tenantAnalytics, valueAsOf } from '../db/repos/analytics';
import { handleProjectAnalytics, handleTenantAnalytics } from './analytics';

/**
 * Analytics aggregates (v0.19.0, KBR-103). Fixture: one board with cards
 * walked through real column moves (so `moved` events carry the done-role
 * target), a second board the member can't see, then assertions over totals,
 * throughput, cycle time, leaderboards, member scoping, and days validation.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let memberId: string;
let p1: string;
let p2: string;
let cols: Record<string, string>; // role → column id (project 1)

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@ana.example', password: 'ownerpassword', name: 'Owner', tenantName: 'Ana Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;

  const project = await createProject(env, tenantId, ownerId, { name: 'Board One', code: 'ANA' });
  p1 = project.id;
  cols = {};
  for (const c of await listColumns(env, tenantId, p1)) if (c.role) cols[c.role] = c.id;

  // Member-roled agent with access to p1 ONLY.
  const agent = await createAgent(env, tenantId, ownerId, 'Worker', [p1]);
  memberId = agent.id;

  // A: owner's card, assigned to owner, worked properly (ready → in_progress →
  // done), member reviews. Completion credit → owner (assignee), review → member.
  const a = await createCard(env, tenantId, p1, ownerId, { summary: 'A', columnId: cols.ready, assigneeUserId: ownerId });
  await patchCard(env, tenantId, a.id, ownerId, { reviewerUserId: memberId });
  await patchCard(env, tenantId, a.id, ownerId, { columnId: cols.in_progress });
  await patchCard(env, tenantId, a.id, ownerId, { columnId: cols.done });

  // B: member's card, assigned to member, jumps straight to done (cycle falls
  // back to creation). Completion credit → member.
  const b = await createCard(env, tenantId, p1, memberId, { summary: 'B', columnId: cols.ready, assigneeUserId: memberId });
  await patchCard(env, tenantId, b.id, memberId, { columnId: cols.done });

  // C: still open, and overdue.
  const c = await createCard(env, tenantId, p1, ownerId, { summary: 'C', columnId: cols.ready });
  await patchCard(env, tenantId, c.id, ownerId, { dueAt: Date.now() - 60_000 });

  // D: assigned to owner, completed, reopened, completed again — must count ONCE.
  const d = await createCard(env, tenantId, p1, ownerId, { summary: 'D', columnId: cols.ready, assigneeUserId: ownerId });
  await patchCard(env, tenantId, d.id, ownerId, { columnId: cols.done });
  await patchCard(env, tenantId, d.id, ownerId, { columnId: cols.in_progress });
  await patchCard(env, tenantId, d.id, ownerId, { columnId: cols.done });

  await addComment(env, tenantId, a.id, ownerId, { type: 'note', body: 'shipping note' });

  // Second board, NOT granted to the member.
  const other = await createProject(env, tenantId, ownerId, { name: 'Board Two', code: 'ANB' });
  p2 = other.id;
  const otherCols: Record<string, string> = {};
  for (const oc of await listColumns(env, tenantId, p2)) if (oc.role) otherCols[oc.role] = oc.id;
  const e = await createCard(env, tenantId, p2, ownerId, { summary: 'E', columnId: otherCols.ready! });
  await patchCard(env, tenantId, e.id, ownerId, { columnId: otherCols.done! });
});

describe('projectAnalytics', () => {
  it('computes totals, cycle time, leaderboard, reviewers, and columns', async () => {
    const dto = await projectAnalytics(env, tenantId, p1, 30, Date.now());
    expect(dto.projectId).toBe(p1);
    expect(dto.totals).toEqual({ created: 4, completed: 3, activeCards: 1, overdue: 1, comments: 1 });

    // First activity is stamped (denominator for rate stats, KBR-105).
    expect(dto.firstActivityAt).not.toBeNull();
    expect(dto.firstActivityAt!).toBeLessThanOrEqual(Date.now());
    expect(dto.firstActivityAt!).toBeGreaterThanOrEqual(dto.since);

    // Throughput buckets zero-fill the window and sum to the totals.
    expect(dto.bucket).toBe('day');
    expect(dto.throughput.length).toBeGreaterThanOrEqual(30);
    expect(dto.throughput.reduce((s, t) => s + t.created, 0)).toBe(4);
    expect(dto.throughput.reduce((s, t) => s + t.completed, 0)).toBe(3);

    // Cycle time: A (in_progress → done), B (creation fallback), D (once).
    expect(dto.cycleTime.samples).toBe(3);
    expect(dto.cycleTime.avgMs).not.toBeNull();
    expect(dto.cycleTime.medianMs).not.toBeNull();

    // Leaderboard: owner completed A + D, member completed B.
    expect(dto.leaderboard[0]).toMatchObject({ userId: ownerId, completed: 2, created: 3, comments: 1 });
    expect(dto.leaderboard[1]).toMatchObject({ userId: memberId, kind: 'agent', completed: 1, created: 1 });

    // Reviewer credit: member reviewed A.
    expect(dto.reviewers).toEqual([expect.objectContaining({ userId: memberId, reviewed: 1 })]);

    // Column distribution: every column present; done holds A/B/D, ready holds C.
    const byRole = new Map(dto.columns.map((col) => [col.role, col.count]));
    expect(dto.columns.length).toBeGreaterThanOrEqual(6);
    expect(byRole.get('done')).toBe(3);
    expect(byRole.get('ready')).toBe(1);
  });

  it('uses weekly buckets at 90 days', async () => {
    const dto = await projectAnalytics(env, tenantId, p1, 90, Date.now());
    expect(dto.bucket).toBe('week');
    expect(dto.throughput.length).toBeGreaterThanOrEqual(13);
    expect(dto.throughput.reduce((s, t) => s + t.completed, 0)).toBe(3);
  });
});

describe('tenantAnalytics', () => {
  it('admin sees both boards, breakdown sorted by completions', async () => {
    const dto = await tenantAnalytics(env, tenantId, { userId: ownerId, isAdmin: true }, 30, Date.now());
    expect(dto.totals.created).toBe(5);
    expect(dto.totals.completed).toBe(4);
    expect(dto.projects.map((p) => p.projectId)).toEqual([p1, p2]);
    expect(dto.projects[0]).toMatchObject({ completed: 3, created: 4, activeCards: 1 });
    expect(dto.projects[1]).toMatchObject({ completed: 1, created: 1, activeCards: 0 });
  });

  it('member is scoped to granted projects only', async () => {
    const dto = await tenantAnalytics(env, tenantId, { userId: memberId, isAdmin: false }, 30, Date.now());
    expect(dto.totals.created).toBe(4); // board two invisible
    expect(dto.totals.completed).toBe(3);
    expect(dto.projects.map((p) => p.projectId)).toEqual([p1]);
  });

  it('a member with no grants gets an empty (not erroring) payload', async () => {
    const lurker = await createAgent(env, tenantId, ownerId, 'Lurker', []);
    const dto = await tenantAnalytics(env, tenantId, { userId: lurker.id, isAdmin: false }, 30, Date.now());
    expect(dto.totals).toEqual({ created: 0, completed: 0, activeCards: 0, overdue: 0, comments: 0 });
    expect(dto.projects).toEqual([]);
    expect(dto.leaderboard).toEqual([]);
    expect(dto.throughput.reduce((s, t) => s + t.created + t.completed, 0)).toBe(0);
  });
});

describe('route handlers', () => {
  function ctx(auth: AuthContext, params: Record<string, string>, query = ''): RouteContext {
    const request = new Request(`http://test.local/api${query}`);
    return { request, env, url: new URL(request.url), params, cors: {}, auth, waitUntil: () => {} };
  }
  const auth = (): AuthContext => ({
    tenantId, userId: ownerId, userName: 'Owner', userKind: 'human', role: 'admin', color: '#000', tokenId: null,
  });

  it('defaults to 30 days and accepts the allowed windows', async () => {
    const res = await handleTenantAnalytics(ctx(auth(), {}));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { analytics: { windowDays: number } };
    expect(body.analytics.windowDays).toBe(30);
    expect((await handleProjectAnalytics(ctx(auth(), { id: p1 }, '?days=7'))).status).toBe(200);
    expect((await handleTenantAnalytics(ctx(auth(), {}, '?days=90'))).status).toBe(200);
  });

  it('rejects out-of-menu windows with 400', async () => {
    for (const bad of ['15', '0', '-7', 'month']) {
      try {
        await handleTenantAnalytics(ctx(auth(), {}, `?days=${bad}`));
        expect.unreachable(`days=${bad} should 400`);
      } catch (err) {
        expect((err as { status?: number }).status).toBe(400);
      }
    }
  });
});

describe('valueAsOf (point-in-time role reconstruction)', () => {
  const ch = (createdAt: number, from: string | null, to: string | null) =>
    ({ card_id: 'x', event_type: 'assigned' as const, created_at: createdAt, from_id: from, to_id: to });

  it('returns the current value when the field never changed', () => {
    expect(valueAsOf([], 100, 'u_current')).toBe('u_current');
    expect(valueAsOf([], 100, null)).toBeNull();
  });

  it('uses the latest change at or before t', () => {
    const changes = [ch(10, null, 'u_a'), ch(20, 'u_a', 'u_b')];
    expect(valueAsOf(changes, 25, 'u_b')).toBe('u_b'); // after both
    expect(valueAsOf(changes, 15, 'u_b')).toBe('u_a'); // between the two
  });

  it('rolls back to the first change’s `from` when every change is after t', () => {
    // Card was assigned to u_a at done, then reassigned to u_b/u_c afterwards.
    const changes = [ch(30, 'u_a', 'u_b'), ch(40, 'u_b', 'u_c')];
    expect(valueAsOf(changes, 20, 'u_c')).toBe('u_a'); // ignores the later current value
  });
});

describe('attribution credits the role-holder, not the mover (KBR-105)', () => {
  it('completion → assignee@done, review → reviewer@done', async () => {
    const proj = await createProject(env, tenantId, ownerId, { name: 'Attrib', code: 'ATR' });
    const worker = await createAgent(env, tenantId, ownerId, 'Attr Worker', [proj.id]);
    const acols: Record<string, string> = {};
    for (const ac of await listColumns(env, tenantId, proj.id)) if (ac.role) acols[ac.role] = ac.id;

    // Assigned to the worker, reviewed by the owner; the OWNER drags it to Done.
    const card = await createCard(env, tenantId, proj.id, ownerId, {
      summary: 'X', columnId: acols.ready!, assigneeUserId: worker.id, reviewerUserId: ownerId,
    });
    await patchCard(env, tenantId, card.id, ownerId, { columnId: acols.done! });

    const dto = await projectAnalytics(env, tenantId, proj.id, 30, Date.now());
    expect(dto.totals.completed).toBe(1);
    // Credit the assignee (worker), NOT the mover (owner).
    expect(dto.leaderboard.find((e) => e.userId === worker.id)?.completed).toBe(1);
    expect(dto.leaderboard.find((e) => e.userId === ownerId)?.completed ?? 0).toBe(0);
    // Review credit to the reviewer at completion.
    expect(dto.reviewers).toEqual([expect.objectContaining({ userId: ownerId, reviewed: 1 })]);
  });

  it('unassigned/unreviewed completions still count in totals but credit nobody', async () => {
    const proj = await createProject(env, tenantId, ownerId, { name: 'NoAssign', code: 'NAS' });
    const ncols: Record<string, string> = {};
    for (const nc of await listColumns(env, tenantId, proj.id)) if (nc.role) ncols[nc.role] = nc.id;
    const card = await createCard(env, tenantId, proj.id, ownerId, { summary: 'Y', columnId: ncols.ready! });
    await patchCard(env, tenantId, card.id, ownerId, { columnId: ncols.done! });

    const dto = await projectAnalytics(env, tenantId, proj.id, 30, Date.now());
    expect(dto.totals.completed).toBe(1);
    expect(dto.leaderboard.every((e) => e.completed === 0)).toBe(true);
    expect(dto.reviewers).toEqual([]);
  });
});

// KEEP LAST: mutates the fixture tenant at volume. D1 caps bound parameters
// at 100/statement (libsql doesn't), so the completed-card IN(...) lookups
// must chunk — this crosses the 80-id chunk boundary and would have caught
// the prod 500 on the first tenant-wide call.
describe('bind-limit chunking', () => {
  it('handles >80 completions in one window', async () => {
    const bulk = await createProject(env, tenantId, ownerId, { name: 'Bulk', code: 'BLK' });
    const bulkCols: Record<string, string> = {};
    for (const bc of await listColumns(env, tenantId, bulk.id)) if (bc.role) bulkCols[bc.role] = bc.id;
    for (let i = 0; i < 85; i++) {
      const card = await createCard(env, tenantId, bulk.id, ownerId, { summary: `bulk-${i}`, columnId: bulkCols.ready!, assigneeUserId: ownerId });
      await patchCard(env, tenantId, card.id, ownerId, { columnId: bulkCols.done! });
    }
    const dto = await projectAnalytics(env, tenantId, bulk.id, 30, Date.now());
    expect(dto.totals.completed).toBe(85);
    expect(dto.cycleTime.samples).toBe(85);
    expect(dto.leaderboard[0]).toMatchObject({ userId: ownerId, completed: 85 });
  });
});
