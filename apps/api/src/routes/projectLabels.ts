import { createProjectLabelInput, patchProjectLabelInput, setProjectLabelsInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { requireAdmin } from '../auth/access';
import { getProject } from '../db/repos/projects';
import {
  listProjectLabels,
  createProjectLabel,
  patchProjectLabel,
  deleteProjectLabel,
  resolveProjectLabelSelection,
  setProjectLabels,
  labelsForProjects,
} from '../db/repos/projectLabels';

/**
 * Project-label CRUD (KBR-84). The label definitions are tenant-scoped and,
 * since KBR-94, admin-only to mutate (they're tenant-wide taxonomy). Attaching
 * labels to a project is project-scoped (router `access` on the PUT route) AND
 * admin-only — it's a project-settings action.
 */

export async function handleListProjectLabels(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const labels = await listProjectLabels(ctx.env, tenantId);
  return jsonResponse(200, { labels }, ctx.cors);
}

export async function handleCreateProjectLabel(ctx: RouteContext): Promise<Response> {
  requireAdmin(ctx.auth); // tenant-wide taxonomy / project settings → admin-only (KBR-94)
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, createProjectLabelInput);
  const label = await createProjectLabel(ctx.env, tenantId, input);
  return jsonResponse(201, { label }, ctx.cors);
}

export async function handlePatchProjectLabel(ctx: RouteContext): Promise<Response> {
  requireAdmin(ctx.auth); // tenant-wide taxonomy / project settings → admin-only (KBR-94)
  const { tenantId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchProjectLabelInput);
  const label = await patchProjectLabel(ctx.env, tenantId, ctx.params.id!, input);
  return jsonResponse(200, { label }, ctx.cors);
}

export async function handleDeleteProjectLabel(ctx: RouteContext): Promise<Response> {
  requireAdmin(ctx.auth); // tenant-wide taxonomy / project settings → admin-only (KBR-94)
  const { tenantId } = tenantScope(ctx.auth);
  await deleteProjectLabel(ctx.env, tenantId, ctx.params.id!);
  return jsonResponse(200, { ok: true }, ctx.cors);
}

/** Replace a project's label set (PUT /projects/:id/project-labels). */
export async function handleSetProjectLabels(ctx: RouteContext): Promise<Response> {
  requireAdmin(ctx.auth); // tenant-wide taxonomy / project settings → admin-only (KBR-94)
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const input = await parseJson(ctx.request, setProjectLabelsInput);
  const resolved = await resolveProjectLabelSelection(ctx.env, tenantId, input);
  await setProjectLabels(ctx.env, tenantId, project.id, resolved.map((l) => l.id));
  const byProject = await labelsForProjects(ctx.env, tenantId, [project.id]);
  return jsonResponse(200, { labels: byProject[project.id] ?? [] }, ctx.cors);
}
