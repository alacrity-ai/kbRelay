import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant, createToken, listTokens } from './auth';
import { createProject } from './projects';
import { authenticate } from '../../auth/authenticate';
import { listAgents, createAgent, patchAgent, removeAgent, assertAgentInTenant } from './agents';
import { setMemberRole } from './team';

/**
 * Agent-user repo tests (v0.14.0, KBR-3). Runs against an in-memory libsql DB
 * with the SAME migration tree as prod (incl. 0012). Covers: the starter agent
 * gets an owner; create → list (owner/handle/access/token count); token mint +
 * count; assertAgentInTenant guards; rename + owner reassignment; deactivate
 * keeps the user row but drops membership/access/tokens.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let projectId: string;

// The registrant is the tenant owner (KBR-114); all ops here act as them.
// Scope-matrix coverage (member/admin/owner visibility) lives in
// agent-ownership.test.ts.
const owner = () => ({ userId: ownerId, isAdmin: true, isOwner: true });

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
    email: 'owner@agents.example',
    password: 'ownerpassword',
    name: 'Ada Admin',
    tenantName: 'Agents Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;
  const project = await createProject(env, tenantId, ownerId, { name: 'Board', code: 'AGT' });
  projectId = project.id;
});

describe('agent users', () => {
  it('the starter Assistant agent is owned by the tenant owner', async () => {
    const agents = await listAgents(env, tenantId, owner());
    expect(agents.length).toBe(1);
    expect(agents[0]!.name).toBe('Assistant');
    expect(agents[0]!.ownerUserId).toBe(ownerId);
    expect(agents[0]!.ownerName).toBe('Ada Admin');
    expect(agents[0]!.tokenCount).toBe(0);
  });

  // KBR-113 — agents carry their workspace role and are promoted/demoted
  // through the same membership path as humans.
  it('agents surface their membership role and can be promoted to admin', async () => {
    const created = await createAgent(env, tenantId, owner(), 'Roley');
    expect(created.role).toBe('member'); // create seeds member; admin is an explicit promotion

    await setMemberRole(env, tenantId, created.id, 'admin');
    let agents = await listAgents(env, tenantId, owner());
    expect(agents.find((a) => a.id === created.id)!.role).toBe('admin');

    // Since KBR-114 the tenant owner is un-demotable, so an admin human always
    // exists and an agent can never become the LAST admin — the owner guard
    // fires before the last-admin guard ever could.
    await expect(setMemberRole(env, tenantId, ownerId, 'member')).rejects.toMatchObject({ status: 409 });

    await setMemberRole(env, tenantId, created.id, 'member');
    agents = await listAgents(env, tenantId, owner());
    expect(agents.find((a) => a.id === created.id)!.role).toBe('member');
    await removeAgent(env, tenantId, owner(), created.id);
  });

  it('create grants a handle, membership, and the requested project access', async () => {
    const created = await createAgent(env, tenantId, owner(), 'Claude', [projectId]);
    expect(created.handle).toBe('claude');
    expect(created.projectIds).toEqual([projectId]);

    const agents = await listAgents(env, tenantId, owner());
    const claude = agents.find((a) => a.id === created.id)!;
    expect(claude.ownerUserId).toBe(ownerId);
    expect(claude.projectIds).toEqual([projectId]);
    expect(claude.tokenCount).toBe(0);
  });

  it('minting a key for an agent shows up in its token list + count', async () => {
    const claude = (await listAgents(env, tenantId, owner())).find((a) => a.name === 'Claude')!;
    const created = await createToken(env, tenantId, claude.id, 'claude-laptop');
    expect(created.secret).toMatch(/^[a-f0-9]{64}$/);

    const tokens = await listTokens(env, tenantId, claude.id);
    expect(tokens.length).toBe(1);
    expect(tokens[0]!.label).toBe('claude-laptop');

    const refreshed = (await listAgents(env, tenantId, owner())).find((a) => a.id === claude.id)!;
    expect(refreshed.tokenCount).toBe(1);
  });

  it('an agent key resolves to the agent identity (provenance crux)', async () => {
    const agent = await createAgent(env, tenantId, owner(), 'Provenance Bot', [projectId]);
    const { secret } = await createToken(env, tenantId, agent.id, 'prov-key');
    const req = new Request('http://x/api/v1/me', {
      headers: { authorization: `Bearer ${secret}` },
    });
    const ctx = await authenticate(req, env);
    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe(agent.id); // work done with this key is attributed to the agent
    expect(ctx!.userKind).toBe('agent');
    expect(ctx!.role).toBe('member');
    await removeAgent(env, tenantId, owner(), agent.id); // clean up so later counts are stable
  });

  it('assertAgentInTenant rejects a human and an unknown id', async () => {
    await expect(assertAgentInTenant(env, tenantId, ownerId)).rejects.toThrow(); // human
    await expect(assertAgentInTenant(env, tenantId, 'u_nope')).rejects.toThrow();
  });

  it('patch renames and reassigns owner (owner must be a member)', async () => {
    const claude = (await listAgents(env, tenantId, owner())).find((a) => a.name === 'Claude')!;
    await patchAgent(env, tenantId, owner(), claude.id, { name: 'Claude Opus' });
    let refreshed = (await listAgents(env, tenantId, owner())).find((a) => a.id === claude.id)!;
    expect(refreshed.name).toBe('Claude Opus');

    // Reassigning to a non-member is rejected.
    await expect(
      patchAgent(env, tenantId, owner(), claude.id, { ownerUserId: 'u_stranger' }),
    ).rejects.toThrow();

    // The starter agent is a member, so it's a valid (if unusual) owner target.
    const assistant = (await listAgents(env, tenantId, owner())).find((a) => a.name === 'Assistant')!;
    await patchAgent(env, tenantId, owner(), claude.id, { ownerUserId: assistant.id });
    refreshed = (await listAgents(env, tenantId, owner())).find((a) => a.id === claude.id)!;
    expect(refreshed.ownerUserId).toBe(assistant.id);
  });

  it('patch recolors an agent; null color means the palette fallback (KBR-74)', async () => {
    const claude = (await listAgents(env, tenantId, owner())).find((a) => a.name === 'Claude Opus')!;
    expect(claude.color).toBeNull(); // never explicitly colored

    await patchAgent(env, tenantId, owner(), claude.id, { color: '#DB2777' });
    const refreshed = (await listAgents(env, tenantId, owner())).find((a) => a.id === claude.id)!;
    expect(refreshed.color).toBe('#DB2777');
  });

  it('deactivate drops membership/access/tokens but keeps the user row', async () => {
    const claude = (await listAgents(env, tenantId, owner())).find((a) => a.name === 'Claude Opus')!;
    await removeAgent(env, tenantId, owner(), claude.id);

    // No longer listed (membership gone).
    expect((await listAgents(env, tenantId, owner())).some((a) => a.id === claude.id)).toBe(false);
    // Tokens revoked.
    expect((await listTokens(env, tenantId, claude.id)).length).toBe(0);
    // project_access gone.
    const acc = await env.db.prepare(
      'SELECT COUNT(*) AS n FROM project_access WHERE user_id = ?',
    ).bind(claude.id).first<{ n: number }>();
    expect(acc!.n).toBe(0);
    // But the user row survives (provenance).
    const row = await env.db.prepare('SELECT id FROM users WHERE id = ?').bind(claude.id).first();
    expect(row).not.toBeNull();
  });
});
