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
import { createCard } from '../db/repos/cards';
import { createAgent } from '../db/repos/agents';
import { handleCreateProject, handlePatchProject } from './projects';
import { handleCreateColumn, handlePatchColumn, handleDeleteColumn } from './columns';
import { handleCreateLabel, handlePatchLabel, handleDeleteLabel } from './labels';
import { handleCreateProjectLabel, handlePatchProjectLabel, handleDeleteProjectLabel, handleSetProjectLabels } from './projectLabels';
import { handleCreateCard, handlePatchCard, handleDeleteCard } from './cards';

/**
 * KBR-94: board-shaping surfaces are admin-only. Members (human or agent) keep
 * full card-level workflow but get 403 on project create/patch, column CRUD,
 * label CRUD, tenant project-label CRUD, and archive-RESTORE. Drives the real
 * handlers against in-memory libsql, mirroring attachments.route.test.ts.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let adminAuth: AuthContext;
let memberAuth: AuthContext;
let projectId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = { db, ALLOWED_ORIGINS: '*', PUBLIC_BASE_URL: 'http://localhost:8080', JWT_SECRET: 'test-secret' } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@rbac.example', password: 'ownerpassword', name: 'Owner', tenantName: 'RBAC Co',
  });
  adminAuth = {
    tenantId: reg.tenantId, userId: reg.userId, userName: 'Owner',
    userKind: 'human', role: 'admin', color: '#000000', tokenId: null,
  };
  const project = await createProject(env, reg.tenantId, reg.userId, { name: 'Board', code: 'RBC' });
  projectId = project.id;
  // A member-roled agent user with access to the project — the "worker" persona.
  const agent = await createAgent(env, reg.tenantId, reg.userId, 'Worker', [projectId]);
  memberAuth = {
    tenantId: reg.tenantId, userId: agent.id, userName: 'Worker',
    userKind: 'agent', role: 'member', color: '#111111', tokenId: null,
  };
});

function ctx(auth: AuthContext, params: Record<string, string>, body?: unknown, method = 'POST'): RouteContext {
  const request = new Request('http://test.local/api', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { request, env, url: new URL(request.url), params, cors: {}, auth, waitUntil: () => {} };
}

async function status(p: Promise<Response>): Promise<number> {
  try {
    return (await p).status;
  } catch (e) {
    return (e as { status?: number }).status ?? 500;
  }
}

describe('KBR-94: member gets 403 on board-shaping routes', () => {
  it('project create + patch', async () => {
    expect(await status(handleCreateProject(ctx(memberAuth, {}, { name: 'Rogue', code: 'RGE' })))).toBe(403);
    expect(await status(handlePatchProject(ctx(memberAuth, { id: projectId }, { name: 'Renamed' }, 'PATCH')))).toBe(403);
  });

  it('column create / patch / delete', async () => {
    expect(await status(handleCreateColumn(ctx(memberAuth, { id: projectId }, { name: 'Lane' })))).toBe(403);
    expect(await status(handlePatchColumn(ctx(memberAuth, { id: 'col_x' }, { name: 'Lane2' }, 'PATCH')))).toBe(403);
    expect(await status(handleDeleteColumn(ctx(memberAuth, { id: 'col_x' }, undefined, 'DELETE')))).toBe(403);
  });

  it('label create / patch / delete', async () => {
    expect(await status(handleCreateLabel(ctx(memberAuth, { id: projectId }, { name: 'Bug', color: '#f00' })))).toBe(403);
    expect(await status(handlePatchLabel(ctx(memberAuth, { id: 'lbl_x' }, { name: 'Bug2' }, 'PATCH')))).toBe(403);
    expect(await status(handleDeleteLabel(ctx(memberAuth, { id: 'lbl_x' }, undefined, 'DELETE')))).toBe(403);
  });

  it('tenant project-label CRUD + project attach', async () => {
    expect(await status(handleCreateProjectLabel(ctx(memberAuth, {}, { name: 'Client A' })))).toBe(403);
    expect(await status(handlePatchProjectLabel(ctx(memberAuth, { id: 'plbl_x' }, { name: 'B' }, 'PATCH')))).toBe(403);
    expect(await status(handleDeleteProjectLabel(ctx(memberAuth, { id: 'plbl_x' }, undefined, 'DELETE')))).toBe(403);
    expect(await status(handleSetProjectLabels(ctx(memberAuth, { id: projectId }, { labelIds: [] }, 'PUT')))).toBe(403);
  });

  it('archive RESTORE is admin-only; archiving stays member-allowed', async () => {
    const card = await createCard(env, adminAuth.tenantId, projectId, adminAuth.userId, { summary: 'Archivable' });
    // Member archives — allowed (normal workflow).
    expect(await status(handlePatchCard(ctx(memberAuth, { id: card.id }, { archived: true }, 'PATCH')))).toBe(200);
    // Member tries to restore — 403.
    expect(await status(handlePatchCard(ctx(memberAuth, { id: card.id }, { archived: false }, 'PATCH')))).toBe(403);
    // Admin restores — 200.
    expect(await status(handlePatchCard(ctx(adminAuth, { id: card.id }, { archived: false }, 'PATCH')))).toBe(200);
    // archived:false on a LIVE card is a harmless no-op for a member (not a restore).
    expect(await status(handlePatchCard(ctx(memberAuth, { id: card.id }, { archived: false }, 'PATCH')))).toBe(200);
  });
});

describe('KBR-94 follow-up: card DELETE is admin-only', () => {
  it('member gets 403; admin can delete', async () => {
    const card = await createCard(env, adminAuth.tenantId, projectId, adminAuth.userId, { summary: 'Deletable' });
    expect(await status(handleDeleteCard(ctx(memberAuth, { id: card.id }, undefined, 'DELETE')))).toBe(403);
    expect(await status(handleDeleteCard(ctx(adminAuth, { id: card.id }, undefined, 'DELETE')))).toBe(200);
  });
});

describe('KBR-94: member card-level workflow is unchanged', () => {
  it('member can create, edit, move-ish (patch), and comment-adjacent patch cards', async () => {
    const res = await handleCreateCard(ctx(memberAuth, { id: projectId }, { summary: 'Member card' }));
    expect(res.status).toBe(201);
    const { card } = (await res.json()) as { card: { id: string } };
    expect(await status(handlePatchCard(ctx(memberAuth, { id: card.id }, { summary: 'Edited by member' }, 'PATCH')))).toBe(200);
  });
});

describe('KBR-94: admin is unaffected', () => {
  it('admin can still create + patch projects and columns', async () => {
    const res = await handleCreateProject(ctx(adminAuth, {}, { name: 'Admin Board', code: 'ADM' }));
    expect(res.status).toBe(201);
    const { project } = (await res.json()) as { project: { id: string } };
    expect(await status(handlePatchProject(ctx(adminAuth, { id: project.id }, { name: 'Renamed' }, 'PATCH')))).toBe(200);
    expect(await status(handleCreateColumn(ctx(adminAuth, { id: project.id }, { name: 'Lane' })))).toBe(201);
  });
});

