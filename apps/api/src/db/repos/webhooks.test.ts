import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createAgent } from './agents';
import { createProject, patchProject } from './projects';
import { listColumns } from './columns';
import { createCard } from './cards';
import {
  listSubscriptions, createSubscription, patchSubscription, deleteSubscription,
  activeSubscriptionsForAgent, agentEventsEnabled,
} from './webhooks';
import { dispatchTriggers } from '../../services/webhooks';

/**
 * Webhook subscriptions (KBR-16): repo CRUD, the agent-targeting query, the
 * per-project mute valve, and the dispatcher (signed POST via a stubbed fetch;
 * no-op when muted / unsubscribed).
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let agentId: string;
let projectId: string;
let readyCol: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'x' } as Env;
  const reg = await registerTenant(env, {
    email: 'o@whr.example', password: 'ownerpassword', name: 'O', tenantName: 'WHR Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'B', code: 'WHR' });
  projectId = project.id;
  agentId = (await createAgent(env, tenantId, { userId: ownerId, isAdmin: true, isOwner: true }, 'Claude', [projectId])).id;
  readyCol = (await listColumns(env, tenantId, projectId)).find((c) => c.role === 'ready')!.id;
});

afterEach(() => vi.unstubAllGlobals());

describe('webhook subscription repo', () => {
  it('creates (secret once), lists (no secret), patches, and deletes', async () => {
    const { subscription, secret } = await createSubscription(env, tenantId, ownerId,
      { label: 'my bridge', url: 'https://example.com/hook', targetAgentUserId: agentId });
    expect(secret.length).toBeGreaterThan(20);
    expect(subscription).toMatchObject({ label: 'my bridge', enabled: true, targetAgentUserId: agentId });
    expect((subscription as Record<string, unknown>).secret).toBeUndefined();

    const list = await listSubscriptions(env, tenantId);
    expect(list.map((s) => s.id)).toContain(subscription.id);

    const patched = await patchSubscription(env, tenantId, subscription.id, { enabled: false, label: 'renamed' });
    expect(patched).toMatchObject({ enabled: false, label: 'renamed' });

    await deleteSubscription(env, tenantId, subscription.id);
    expect((await listSubscriptions(env, tenantId)).map((s) => s.id)).not.toContain(subscription.id);
  });

  it('activeSubscriptionsForAgent honors target + enabled', async () => {
    const anyAgent = await createSubscription(env, tenantId, ownerId, { label: 'any', url: 'https://a/1' });
    const forAgent = await createSubscription(env, tenantId, ownerId, { label: 'mine', url: 'https://a/2', targetAgentUserId: agentId });
    const disabled = await createSubscription(env, tenantId, ownerId, { label: 'off', url: 'https://a/3', enabled: false });

    const active = await activeSubscriptionsForAgent(env, tenantId, agentId);
    const ids = active.map((s) => s.id);
    expect(ids).toContain(anyAgent.subscription.id);   // null target → any agent
    expect(ids).toContain(forAgent.subscription.id);   // explicit target
    expect(ids).not.toContain(disabled.subscription.id); // disabled excluded

    // A subscription targeted at a different user is not delivered here.
    const other = await createSubscription(env, tenantId, ownerId, { label: 'other', url: 'https://a/4', targetAgentUserId: ownerId });
    expect((await activeSubscriptionsForAgent(env, tenantId, agentId)).map((s) => s.id)).not.toContain(other.subscription.id);

    // cleanup
    for (const s of [anyAgent, forAgent, disabled, other]) await deleteSubscription(env, tenantId, s.subscription.id);
  });

  it('agentEventsEnabled reflects the per-project valve', async () => {
    expect(await agentEventsEnabled(env, tenantId, projectId)).toBe(true); // default
    await patchProject(env, tenantId, projectId, { agentEventsEnabled: false });
    expect(await agentEventsEnabled(env, tenantId, projectId)).toBe(false);
    await patchProject(env, tenantId, projectId, { agentEventsEnabled: true }); // restore
  });
});

describe('dispatchTriggers', () => {
  it('POSTs a signed payload whose HMAC matches the body', async () => {
    const { subscription, secret } = await createSubscription(env, tenantId, ownerId,
      { label: 'bridge', url: 'https://sink.example/hook', targetAgentUserId: agentId });
    const card = await createCard(env, tenantId, projectId, ownerId, { summary: 'x', columnId: readyCol, assigneeUserId: agentId });

    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('ok'); });

    await dispatchTriggers(env, tenantId, card, ownerId, [{ event: 'card.ready', recipientUserId: agentId, source: { kind: 'assign' } }]);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://sink.example/hook');
    const hdrs = calls[0]!.init.headers as Record<string, string>;
    expect(hdrs['X-KBRelay-Event']).toBe('card.ready');
    expect(hdrs['X-KBRelay-Delivery']).toBeTruthy();
    // Recompute HMAC over the exact body sent → must equal the signature header.
    const body = calls[0]!.init.body as string;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hdrs['X-KBRelay-Signature']).toBe(`sha256=${hex}`);
    expect(JSON.parse(body)).toMatchObject({ event: 'card.ready', recipient: agentId, card: { id: card.id } });

    await deleteSubscription(env, tenantId, subscription.id);
  });

  it('is a no-op when the project valve is off', async () => {
    const { subscription } = await createSubscription(env, tenantId, ownerId, { label: 'b', url: 'https://sink/x', targetAgentUserId: agentId });
    const card = await createCard(env, tenantId, projectId, ownerId, { summary: 'y', columnId: readyCol, assigneeUserId: agentId });
    await patchProject(env, tenantId, projectId, { agentEventsEnabled: false });

    const calls: unknown[] = [];
    vi.stubGlobal('fetch', async () => { calls.push(1); return new Response('ok'); });
    await dispatchTriggers(env, tenantId, card, ownerId, [{ event: 'card.ready', recipientUserId: agentId, source: { kind: 'assign' } }]);
    expect(calls).toHaveLength(0);

    await patchProject(env, tenantId, projectId, { agentEventsEnabled: true });
    await deleteSubscription(env, tenantId, subscription.id);
  });

  it('is a no-op when there is no matching subscription', async () => {
    const card = await createCard(env, tenantId, projectId, ownerId, { summary: 'z', columnId: readyCol, assigneeUserId: agentId });
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', async () => { calls.push(1); return new Response('ok'); });
    await dispatchTriggers(env, tenantId, card, ownerId, [{ event: 'card.ready', recipientUserId: agentId, source: { kind: 'assign' } }]);
    expect(calls).toHaveLength(0);
  });
});
