import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { WebhookTrigger } from '@kbrelay/shared';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createAgent } from './agents';
import { createProject } from './projects';
import { listColumns } from './columns';
import { createCard, patchCard } from './cards';
import { addComment } from './card_events';

/**
 * Callback trigger collection (KBR-16 + KBR-14). The card/comment repos push
 * WebhookTriggers into an optional collector; the route handler dispatches them.
 * Covers: assign-into-ready fires (create + move + reassign), and only for an
 * agent in a `ready` lane; a pure edit fires nothing; @-mentioning an agent
 * fires card.mention (a human mention does not).
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let agentId: string;
let projectId: string;
let readyCol: string;
let backlogCol: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@wh.example', password: 'ownerpassword', name: 'WH Owner', tenantName: 'WH Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'WHK' });
  projectId = project.id;
  const agent = await createAgent(env, tenantId, { userId: ownerId, isAdmin: true, isOwner: true }, 'Claude', [projectId]);
  agentId = agent.id;
  const cols = await listColumns(env, tenantId, projectId);
  readyCol = cols.find((c) => c.role === 'ready')!.id;
  backlogCol = cols.find((c) => c.role === null)!.id;
});

describe('assign-into-ready trigger', () => {
  it('fires on a card CREATED into ready assigned to an agent', async () => {
    const t: WebhookTrigger[] = [];
    await createCard(env, tenantId, projectId, ownerId,
      { summary: 'go', columnId: readyCol, assigneeUserId: agentId }, t);
    expect(t).toEqual([{ event: 'card.ready', recipientUserId: agentId, source: { kind: 'assign' } }]);
  });

  it('does NOT fire for a card created into a non-ready lane', async () => {
    const t: WebhookTrigger[] = [];
    await createCard(env, tenantId, projectId, ownerId,
      { summary: 'later', columnId: backlogCol, assigneeUserId: agentId }, t);
    expect(t).toEqual([]);
  });

  it('does NOT fire when the ready card is assigned to a human', async () => {
    const t: WebhookTrigger[] = [];
    await createCard(env, tenantId, projectId, ownerId,
      { summary: 'human work', columnId: readyCol, assigneeUserId: ownerId }, t);
    expect(t).toEqual([]);
  });

  it('fires when an agent-assigned card is MOVED into ready', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId,
      { summary: 'draft', columnId: backlogCol, assigneeUserId: agentId });
    const t: WebhookTrigger[] = [];
    await patchCard(env, tenantId, card.id, ownerId, { columnId: readyCol }, t);
    expect(t).toEqual([{ event: 'card.ready', recipientUserId: agentId, source: { kind: 'assign' } }]);
  });

  it('fires when an agent is ASSIGNED to a card already in ready', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId,
      { summary: 'unassigned ready', columnId: readyCol, assigneeUserId: null });
    const t: WebhookTrigger[] = [];
    await patchCard(env, tenantId, card.id, ownerId, { assigneeUserId: agentId }, t);
    expect(t.map((x) => x.event)).toEqual(['card.ready']);
  });

  it('does NOT fire on a pure edit of an already-actionable card', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId,
      { summary: 'live', columnId: readyCol, assigneeUserId: agentId });
    const t: WebhookTrigger[] = [];
    await patchCard(env, tenantId, card.id, ownerId, { summary: 'live (edited)' }, t);
    expect(t).toEqual([]);
  });
});

describe('agent @-mention trigger (KBR-14)', () => {
  it('fires card.mention when a comment @-mentions an agent', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, { summary: 'chat', columnId: backlogCol });
    const t: WebhookTrigger[] = [];
    await addComment(env, tenantId, card.id, ownerId, { type: 'note', body: 'hey @claude take a look' }, t);
    expect(t).toEqual([
      { event: 'card.mention', recipientUserId: agentId, source: { kind: 'mention', location: 'comment', commentId: expect.any(String) } },
    ]);
  });

  it('does NOT fire for a mention of a human', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, { summary: 'chat2', columnId: backlogCol });
    const t: WebhookTrigger[] = [];
    // owner has no @handle set by default → not mentionable; assert no agent mention fired.
    await addComment(env, tenantId, card.id, ownerId, { type: 'note', body: 'just a note, no agent' }, t);
    expect(t).toEqual([]);
  });
});
