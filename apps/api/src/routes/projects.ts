import type { ProjectStatus } from '@kbrelay/shared';
import { createProjectInput, patchProjectInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { requireAdmin } from '../auth/access';
import {
  listProjects,
  getProject,
  createProject,
  patchProject,
  deleteProject,
} from '../db/repos/projects';
import { listColumns } from '../db/repos/columns';
import { purgeBlobs } from '../db/repos/attachments';

export async function handleListProjects(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const statusParam = ctx.url.searchParams.get('status') ?? undefined;
  const status =
    statusParam === 'active' || statusParam === 'archived'
      ? (statusParam as ProjectStatus)
      : undefined;
  const projects = await listProjects(ctx.env, tenantId, status, {
    userId,
    isAdmin: ctx.auth?.role === 'admin',
  });
  return jsonResponse(200, { projects }, ctx.cors);
}

export async function handleCreateProject(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, createProjectInput);
  const project = await createProject(ctx.env, tenantId, userId, input);
  const columns = await listColumns(ctx.env, tenantId, project.id);
  return jsonResponse(201, { project, columns }, ctx.cors);
}

export async function handleGetProject(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const columns = await listColumns(ctx.env, tenantId, project.id);
  return jsonResponse(200, { project, columns }, ctx.cors);
}

export async function handlePatchProject(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchProjectInput);
  const project = await patchProject(ctx.env, tenantId, ctx.params.id!, input);
  return jsonResponse(200, { project }, ctx.cors);
}

export async function handleDeleteProject(ctx: RouteContext): Promise<Response> {
  // Deleting a project is destructive and irreversible → admin-only (v0.14.0).
  requireAdmin(ctx.auth);
  const { tenantId } = tenantScope(ctx.auth);
  const blobKeys = await deleteProject(ctx.env, tenantId, ctx.params.id!);
  // Purge the whole board's attachment bytes after responding (KBR-43).
  ctx.waitUntil(purgeBlobs(ctx.env, blobKeys));
  return jsonResponse(200, { ok: true }, ctx.cors);
}
