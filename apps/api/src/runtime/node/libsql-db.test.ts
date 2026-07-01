import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from './libsql-db';
import type { Env } from '../../env';
import { registerTenant } from '../../db/repos/auth';
import { createProject, listProjects, getProject } from '../../db/repos/projects';
import { createCard, patchCard, getCard } from '../../db/repos/cards';
import { addComment, listTimeline, redactComment } from '../../db/repos/card_events';
import { replaceMemberProjectAccess } from '../../db/repos/team';
import { listMentions } from '../../db/repos/mentions';

/**
 * libsql adapter parity test (v0.12.0). Runs a real slice of repo logic against
 * an in-memory libsql DB and asserts the SQLite features kbRelay relies on behave
 * exactly as on D1: RETURNING (per-project card seq), atomic batch groups
 * (card + timeline event + mentions land together), correlated subqueries
 * (live mention excerpt), and redaction tombstones.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let agentId: string;
let agentHandle: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  // Apply the SAME migration files used on D1 — no per-file changes.
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
    email: 'owner@example.com',
    password: 'ownerpassword',
    name: 'Olive Owner',
    tenantName: 'Libsql Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;

  const users = await db
    .prepare("SELECT id, handle, kind FROM users WHERE tenant_id = ? AND kind = 'agent'")
    .bind(tenantId)
    .first<{ id: string; handle: string }>();
  agentId = users!.id;
  agentHandle = users!.handle;
});

describe('libsql adapter — repo parity', () => {
  it('registers a tenant atomically (owner + agent + memberships)', async () => {
    const rows = await env.db
      .prepare('SELECT COUNT(*) AS n FROM memberships WHERE tenant_id = ?')
      .bind(tenantId)
      .first<{ n: number }>();
    expect(rows!.n).toBe(2); // owner (admin) + agent (member)
  });

  it('RETURNING: per-project card seq increments monotonically', async () => {
    const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'LSB' });
    // Grant the agent access so it can be @-mentioned in this project.
    await replaceMemberProjectAccess(env, tenantId, agentId, [project.id]);

    const c1 = await createCard(env, tenantId, project.id, ownerId, { summary: 'first' });
    const c2 = await createCard(env, tenantId, project.id, ownerId, { summary: 'second' });
    expect(c1.key).toBe('LSB-1');
    expect(c2.key).toBe('LSB-2');

    // KBR-6: listProjects reports a per-project card count (browser badges).
    const listed = await listProjects(env, tenantId);
    expect(listed.find((p) => p.id === project.id)!.cardCount).toBe(2);
    // Single-project fetch leaves it undefined (correlated subquery is list-only).
    expect((await getProject(env, tenantId, project.id))!.cardCount).toBeUndefined();
    return { projectId: project.id };
  });

  it('batch atomicity + correlated subquery: card mention, then comment mention, then redact', async () => {
    const project = await createProject(env, tenantId, ownerId, { name: 'Mentions', code: 'LSM' });
    await replaceMemberProjectAccess(env, tenantId, agentId, [project.id]);

    // Card whose description @-mentions the agent → one mention (batch: card+event+mention).
    const card = await createCard(env, tenantId, project.id, ownerId, {
      summary: 'ping the agent',
      description: `hey @${agentHandle}, take a look`,
    });
    let agentMentions = await listMentions(env, tenantId, agentId, 'all', false);
    expect(agentMentions.mentions.length).toBe(1);
    expect(agentMentions.mentions[0]!.excerpt).toContain(`@${agentHandle}`); // live correlated excerpt

    // A comment mentioning the agent → a second mention keyed to the comment.
    const comment = await addComment(env, tenantId, card.id, ownerId, {
      type: 'note',
      body: `@${agentHandle} what do you think?`,
    });
    agentMentions = await listMentions(env, tenantId, agentId, 'all', false);
    expect(agentMentions.mentions.length).toBe(2);

    // Timeline has: created event + the comment.
    const timeline = await listTimeline(env, tenantId, card.id);
    expect(timeline.some((e) => e.eventType === 'created')).toBe(true);
    expect(timeline.some((e) => e.kind === 'note')).toBe(true);

    // Redact the comment → its mention retracts, tombstone remains.
    const redacted = await redactComment(env, tenantId, card.id, comment.id, ownerId);
    expect(redacted.deletedAt).not.toBeNull();
    expect(redacted.body).toBeNull();
    agentMentions = await listMentions(env, tenantId, agentId, 'all', false);
    expect(agentMentions.mentions.length).toBe(1); // comment mention gone, card mention stays
  });

  it('patch moves a card and stamps updated_by (batch parity)', async () => {
    const project = await createProject(env, tenantId, ownerId, { name: 'Move', code: 'LMV' });
    const cols = await env.db
      .prepare('SELECT id, name FROM columns WHERE project_id = ? ORDER BY position ASC')
      .bind(project.id)
      .all<{ id: string; name: string }>();
    const card = await createCard(env, tenantId, project.id, ownerId, { summary: 'mover' });
    const target = cols.results[1]!; // second column
    const moved = await patchCard(env, tenantId, card.id, agentId, { columnId: target.id });
    expect(moved.columnId).toBe(target.id);
    expect(moved.updatedBy).toBe(agentId);
    const fresh = await getCard(env, tenantId, card.id);
    expect(fresh!.columnId).toBe(target.id);
  });
});
