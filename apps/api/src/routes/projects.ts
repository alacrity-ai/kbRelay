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
import { labelsForProjects } from '../db/repos/projectLabels';
import { listProjectEvents } from '../db/repos/card_events';
import { purgeBlobs } from '../db/repos/attachments';
import { countArchivedCards } from '../db/repos/cards';

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
  // Embed each project's tenant-scoped labels (KBR-84) for filtering/chips.
  const byProject = await labelsForProjects(ctx.env, tenantId, projects.map((p) => p.id));
  const withLabels = projects.map((p) => ({ ...p, labels: byProject[p.id] ?? [] }));
  return jsonResponse(200, { projects: withLabels }, ctx.cors);
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
  // archivedCardCount (KBR-75) feeds the Done-lane "(N) Archived" badge — a
  // single COUNT so the board never fetches the (potentially huge) archive.
  const [columns, archivedCardCount, byProject] = await Promise.all([
    listColumns(ctx.env, tenantId, project.id),
    countArchivedCards(ctx.env, tenantId, project.id),
    labelsForProjects(ctx.env, tenantId, [project.id]),
  ]);
  const withLabels = { ...project, labels: byProject[project.id] ?? [] };
  return jsonResponse(200, { project: withLabels, columns, archivedCardCount }, ctx.cors);
}

export async function handlePatchProject(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchProjectInput);
  const project = await patchProject(ctx.env, tenantId, ctx.params.id!, input);
  return jsonResponse(200, { project }, ctx.cors);
}

/** Project activity feed (v0.17.0, KBR-67): newest-first card events across the
 *  board, cursor-paginated. Access is enforced by the route's `access` scope. */
export async function handleListProjectEvents(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const q = ctx.url.searchParams;
  const since = q.get('since') != null ? Number(q.get('since')) : undefined;
  const limit = q.get('limit') != null ? Number(q.get('limit')) : undefined;
  if (since !== undefined && !Number.isFinite(since)) {
    throw new HttpError(400, 'since must be a unix-ms timestamp');
  }
  if (limit !== undefined && !Number.isFinite(limit)) {
    throw new HttpError(400, 'limit must be a number');
  }
  const page = await listProjectEvents(ctx.env, tenantId, project.id, {
    since,
    limit,
    cursor: q.get('cursor') ?? undefined,
  });
  return jsonResponse(200, page, ctx.cors);
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
