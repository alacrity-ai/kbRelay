import { createColumnInput, patchColumnInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { requireAdmin } from '../auth/access';
import { getProject } from '../db/repos/projects';
import { listColumns, createColumn, patchColumn, deleteColumn } from '../db/repos/columns';

export async function handleListColumns(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const columns = await listColumns(ctx.env, tenantId, project.id);
  return jsonResponse(200, { columns }, ctx.cors);
}

export async function handleCreateColumn(ctx: RouteContext): Promise<Response> {
  requireAdmin(ctx.auth); // column layout is board-shaping → admin-only (KBR-94)
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const input = await parseJson(ctx.request, createColumnInput);
  const column = await createColumn(ctx.env, tenantId, project.id, input);
  return jsonResponse(201, { column }, ctx.cors);
}

export async function handlePatchColumn(ctx: RouteContext): Promise<Response> {
  requireAdmin(ctx.auth); // column layout is board-shaping → admin-only (KBR-94)
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchColumnInput);
  const column = await patchColumn(ctx.env, tenantId, ctx.params.id!, input);
  return jsonResponse(200, { column }, ctx.cors);
}

export async function handleDeleteColumn(ctx: RouteContext): Promise<Response> {
  requireAdmin(ctx.auth); // column layout is board-shaping → admin-only (KBR-94)
  const { tenantId } = tenantScope(ctx.auth);
  await deleteColumn(ctx.env, tenantId, ctx.params.id!);
  return jsonResponse(200, { ok: true }, ctx.cors);
}
