import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject } from './projects';
import { inviteMember, acceptInvite, replaceMemberProjectAccess } from './team';
import {
  listAgents,
  createAgent,
  patchAgent,
  removeAgent,
  replaceAgentProjectAccess,
  assertAgentControl,
  type AgentActor,
} from './agents';
import { createToken, listTokens } from './auth';

/**
 * Agent ownership model (KBR-115): the member/admin/owner visibility matrix,
 * the "an agent never outranks its owner" cap, creator-visible project
 * intersection on create, and the member-scoped project-access replace.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let oliveId: string; // tenant owner
let adamId: string; // second admin
let bettyId: string; // member with access to pA only
let miaId: string; // second member
let pA: string;
let pB: string;

let oBot: string; // owned by Olive (owner)
let aBot: string; // owned by Adam (admin)
let bBot: string; // owned by Betty (member)

const olive = (): AgentActor => ({ userId: oliveId, isAdmin: true, isOwner: true });
const adam = (): AgentActor => ({ userId: adamId, isAdmin: true, isOwner: false });
const betty = (): AgentActor => ({ userId: bettyId, isAdmin: false, isOwner: false });
const mia = (): AgentActor => ({ userId: miaId, isAdmin: false, isOwner: false });

async function invite(email: string, name: string, role: 'admin' | 'member'): Promise<string> {
  const { cleartext } = await inviteMember(env, tenantId, oliveId, email, role);
  const accepted = await acceptInvite(env, cleartext, { name, password: 'password123' });
  return accepted!.userId;
}

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
    email: 'olive@scope.example',
    password: 'ownerpassword',
    name: 'Olive Owner',
    tenantName: 'Scope Co',
  });
  tenantId = reg.tenantId;
  oliveId = reg.userId;

  adamId = await invite('adam@scope.example', 'Adam Admin', 'admin');
  bettyId = await invite('betty@scope.example', 'Betty Member', 'member');
  miaId = await invite('mia@scope.example', 'Mia Member', 'member');

  pA = (await createProject(env, tenantId, oliveId, { name: 'Alpha', code: 'ALF' })).id;
  pB = (await createProject(env, tenantId, oliveId, { name: 'Beta', code: 'BET' })).id;
  await replaceMemberProjectAccess(env, tenantId, bettyId, [pA]); // Betty sees only Alpha

  oBot = (await createAgent(env, tenantId, olive(), 'Olive Bot')).id;
  aBot = (await createAgent(env, tenantId, adam(), 'Adam Bot')).id;
  bBot = (await createAgent(env, tenantId, betty(), 'Betty Bot', [pA, pB])).id;
});

describe('visibility matrix', () => {
  it('a member sees only their own agents', async () => {
    const names = (await listAgents(env, tenantId, betty())).map((a) => a.name);
    expect(names).toEqual(['Betty Bot']);
    // Mia owns nothing — she sees nothing, not Betty's agent.
    expect(await listAgents(env, tenantId, mia())).toEqual([]);
  });

  it("an admin sees own + member-owned agents, never another admin's", async () => {
    const names = (await listAgents(env, tenantId, adam())).map((a) => a.name).sort();
    // Assistant (starter agent) is owned by Olive → hidden from Adam too.
    expect(names).toEqual(['Adam Bot', 'Betty Bot']);
  });

  it('the tenant owner sees every agent', async () => {
    const names = (await listAgents(env, tenantId, olive())).map((a) => a.name).sort();
    expect(names).toEqual(['Adam Bot', 'Assistant', 'Betty Bot', 'Olive Bot']);
  });

  it('out-of-scope mutations 404 — indistinguishable from nonexistent', async () => {
    // Member → someone else's agent (peer member's owner can't see it either).
    await expect(patchAgent(env, tenantId, mia(), bBot, { name: 'X' })).rejects.toMatchObject({ status: 404 });
    await expect(removeAgent(env, tenantId, betty(), aBot)).rejects.toMatchObject({ status: 404 });
    await expect(replaceAgentProjectAccess(env, tenantId, betty(), aBot, [])).rejects.toMatchObject({ status: 404 });
    // Admin → the owner's agent.
    await expect(assertAgentControl(env, tenantId, adam(), oBot)).rejects.toMatchObject({ status: 404 });
    // Owner reaches everything.
    await expect(assertAgentControl(env, tenantId, olive(), aBot)).resolves.toBeTruthy();
  });
});

describe('member self-service', () => {
  it('creation intersects the grant list with the projects the creator can see', async () => {
    const bot = (await listAgents(env, tenantId, betty())).find((a) => a.id === bBot)!;
    expect(bot.projectIds).toEqual([pA]); // pB requested but invisible to Betty
    expect(bot.role).toBe('member');
    expect(bot.ownerRole).toBe('member');
    expect(bot.roleCap).toBe('member');
  });

  it('a member manages their own agent: rename, keys', async () => {
    await patchAgent(env, tenantId, betty(), bBot, { name: 'Betty Bot II' });
    const bot = (await listAgents(env, tenantId, betty())).find((a) => a.id === bBot)!;
    expect(bot.name).toBe('Betty Bot II');

    const { secret } = await createToken(env, tenantId, bBot, 'betty-key');
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    expect((await listTokens(env, tenantId, bBot)).length).toBe(1);
  });

  it("a member's project replace only touches projects they can see", async () => {
    // An admin grants Betty's bot a project Betty can't see…
    await replaceAgentProjectAccess(env, tenantId, adam(), bBot, [pA, pB]);
    // …then Betty clears her agent's projects. Her save revokes pA but the
    // out-of-scope pB grant must survive.
    await replaceAgentProjectAccess(env, tenantId, betty(), bBot, []);
    const bot = (await listAgents(env, tenantId, olive())).find((a) => a.id === bBot)!;
    expect(bot.projectIds).toEqual([pB]);
    // And Betty can re-grant within her scope.
    await replaceAgentProjectAccess(env, tenantId, betty(), bBot, [pA]);
    const again = (await listAgents(env, tenantId, olive())).find((a) => a.id === bBot)!;
    expect(again.projectIds.sort()).toEqual([pA, pB].sort());
  });

  it("a member can't reassign their agent's owner", async () => {
    await expect(
      patchAgent(env, tenantId, betty(), bBot, { ownerUserId: miaId }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('role cap — an agent never outranks its owner', () => {
  it('a member-owned agent is pinned to member for EVERYONE, owner included', async () => {
    await expect(patchAgent(env, tenantId, betty(), bBot, { role: 'admin' })).rejects.toMatchObject({ status: 403 });
    await expect(patchAgent(env, tenantId, adam(), bBot, { role: 'admin' })).rejects.toMatchObject({ status: 403 });
    await expect(patchAgent(env, tenantId, olive(), bBot, { role: 'admin' })).rejects.toMatchObject({ status: 403 });
  });

  it('an admin promotes and demotes their own agent', async () => {
    await patchAgent(env, tenantId, adam(), aBot, { role: 'admin' });
    let bot = (await listAgents(env, tenantId, adam())).find((a) => a.id === aBot)!;
    expect(bot.role).toBe('admin');
    expect(bot.roleCap).toBe('admin');
    await patchAgent(env, tenantId, adam(), aBot, { role: 'member' });
    bot = (await listAgents(env, tenantId, adam())).find((a) => a.id === aBot)!;
    expect(bot.role).toBe('member');
  });

  it('a transfer may not leave an admin agent owned by a member', async () => {
    await patchAgent(env, tenantId, adam(), aBot, { role: 'admin' });
    await expect(
      patchAgent(env, tenantId, adam(), aBot, { ownerUserId: bettyId }),
    ).rejects.toMatchObject({ status: 403 });
    // Demote-and-transfer in one coherent patch is allowed…
    await patchAgent(env, tenantId, adam(), aBot, { ownerUserId: bettyId, role: 'member' });
    const bot = (await listAgents(env, tenantId, betty())).find((a) => a.id === aBot)!;
    expect(bot.ownerUserId).toBe(bettyId);
    expect(bot.role).toBe('member');
    // …and hands visibility to the new owner: Adam still sees it only because
    // it is now member-owned.
    expect((await listAgents(env, tenantId, adam())).some((a) => a.id === aBot)).toBe(true);
    // Hand it back for later tests.
    await patchAgent(env, tenantId, adam(), aBot, { ownerUserId: adamId });
  });

  it('ownerless agents are admin-visible and capped at member', async () => {
    const stray = (await createAgent(env, tenantId, olive(), 'Stray Bot')).id;
    await env.db.prepare('UPDATE users SET owner_user_id = NULL WHERE id = ?').bind(stray).run();

    const seenByAdam = (await listAgents(env, tenantId, adam())).find((a) => a.id === stray);
    expect(seenByAdam).toBeTruthy();
    expect(seenByAdam!.ownerRole).toBeNull();
    expect(seenByAdam!.roleCap).toBe('member');
    await expect(patchAgent(env, tenantId, adam(), stray, { role: 'admin' })).rejects.toMatchObject({ status: 403 });
    // An admin can adopt it (become its owner) and only then promote it.
    await patchAgent(env, tenantId, adam(), stray, { ownerUserId: adamId });
    await patchAgent(env, tenantId, adam(), stray, { role: 'admin' });
    const adopted = (await listAgents(env, tenantId, adam())).find((a) => a.id === stray)!;
    expect(adopted.role).toBe('admin');
    await removeAgent(env, tenantId, adam(), stray);
  });
});
