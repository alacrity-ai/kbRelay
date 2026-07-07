import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant, createTenantForUser } from './auth';
import { tenantOwnerId } from './users';
import { listTeam, setMemberRole, removeMember, inviteMember, acceptInvite } from './team';

/**
 * Tenant owner (KBR-114). The owner is a pointer on the tenant, not a third
 * membership role: stamped at registration, backfilled by 0025 for existing
 * tenants, un-demotable and un-removable. Runs against an in-memory libsql DB
 * with the full prod migration tree (incl. the 0002 lala seed, so the backfill
 * pin is asserted here too).
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let ownerId: string;
let secondAdminId: string;

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
    email: 'owner@tenant-owner.example',
    password: 'ownerpassword',
    name: 'Olive Owner',
    tenantName: 'Owner Co',
  });
  tenantId = reg.tenantId;
  ownerId = reg.userId;

  // A second admin so owner guards are exercised separately from last-admin guards.
  const { cleartext } = await inviteMember(env, tenantId, ownerId, 'adam@tenant-owner.example', 'admin');
  const accepted = await acceptInvite(env, cleartext, { name: 'Adam Admin', password: 'adminpassword' });
  secondAdminId = accepted!.userId;
});

describe('tenant owner (KBR-114)', () => {
  it('the 0025 backfill resolves the seeded lala tenant to Leif (tie pinned)', async () => {
    expect(await tenantOwnerId(env, 't_lala')).toBe('u_leif');
  });

  it('registerTenant stamps the registrant as owner', async () => {
    expect(await tenantOwnerId(env, tenantId)).toBe(ownerId);
  });

  it('createTenantForUser stamps the creating user as owner of the new workspace', async () => {
    const { tenantId: newTenant } = await createTenantForUser(env, secondAdminId, 'Adams Annex');
    expect(await tenantOwnerId(env, newTenant)).toBe(secondAdminId);
  });

  it('listTeam marks exactly the owner with isOwner', async () => {
    const { members } = await listTeam(env, tenantId);
    const flagged = members.filter((m) => m.isOwner);
    expect(flagged.map((m) => m.id)).toEqual([ownerId]);
  });

  it("the owner's role can't be changed, even with another admin present", async () => {
    await expect(setMemberRole(env, tenantId, ownerId, 'member')).rejects.toMatchObject({ status: 409 });
    // No-op re-assert of admin is harmless (not a role change).
    await expect(setMemberRole(env, tenantId, ownerId, 'admin')).resolves.toBeUndefined();
    // The guard is owner-specific: the second admin CAN be demoted…
    await expect(setMemberRole(env, tenantId, secondAdminId, 'member')).resolves.toBeUndefined();
    await setMemberRole(env, tenantId, secondAdminId, 'admin'); // restore
  });

  it("the owner can't be removed", async () => {
    await expect(removeMember(env, tenantId, ownerId)).rejects.toMatchObject({ status: 409 });
    const { members } = await listTeam(env, tenantId);
    expect(members.some((m) => m.id === ownerId)).toBe(true);
  });
});
