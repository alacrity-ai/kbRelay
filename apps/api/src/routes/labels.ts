import { createLabelInput, patchLabelInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { getProject } from '../db/repos/projects';
import { listLabels, createLabel, patchLabel, deleteLabel } from '../db/repos/labels';

/** Label CRUD (v0.17.0, KBR-62). Project-RBAC'd via the router's access scopes. */

export async function handleListLabels(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const labels = await listLabels(ctx.env, tenantId, project.id);
  return jsonResponse(200, { labels }, ctx.cors);
}

export async function handleCreateLabel(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const input = await parseJson(ctx.request, createLabelInput);
  const label = await createLabel(ctx.env, tenantId, project.id, input);
  return jsonResponse(201, { label }, ctx.cors);
}

export async function handlePatchLabel(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchLabelInput);
  const label = await patchLabel(ctx.env, tenantId, ctx.params.id!, input);
  return jsonResponse(200, { label }, ctx.cors);
}

export async function handleDeleteLabel(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  await deleteLabel(ctx.env, tenantId, ctx.params.id!);
  return jsonResponse(200, { ok: true }, ctx.cors);
}
