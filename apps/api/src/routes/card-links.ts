import { createCardLinkInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { getCard } from '../db/repos/cards';
import { getProject } from '../db/repos/projects';
import {
  newCardLinkId,
  createCardLink,
  getCardLinkRow,
  deleteCardLinkStmt,
  findCardLinksInProject,
} from '../db/repos/card-links';

/**
 * Card link routes (external references — Jira/GitHub URLs, etc.). Plain JSON
 * CRUD (no bytes). RBAC: add is card-scoped; delete uses the `cardLink` access
 * scope (link → card → project); the project-wide lookup is project-scoped —
 * all declared in the router.
 */

/** POST /api/v1/cards/:id/links — add one external link to a card. */
export async function handleAddCardLink(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id!);
  if (!card) throw new HttpError(404, 'Card not found');

  const input = await parseJson(ctx.request, createCardLinkInput);
  const link = await createCardLink(ctx.env, {
    id: newCardLinkId(),
    tenantId,
    cardId: card.id,
    provider: input.provider,
    externalKey: input.externalKey ?? null,
    url: input.url,
    title: input.title ?? null,
    createdBy: userId,
  });
  return jsonResponse(201, { link }, ctx.cors);
}

/** DELETE /api/v1/card-links/:id — creator or a tenant admin. */
export async function handleDeleteCardLink(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const row = await getCardLinkRow(ctx.env, tenantId, ctx.params.id!);
  if (!row) throw new HttpError(404, 'Card link not found');
  if (row.created_by !== userId && ctx.auth?.role !== 'admin') {
    throw new HttpError(403, 'Only the creator or an admin can delete this link');
  }
  await ctx.env.db.batch([deleteCardLinkStmt(ctx.env, tenantId, row.id)]);
  return jsonResponse(200, { ok: true }, ctx.cors);
}

/**
 * GET /api/v1/projects/:id/card-links?provider=&externalKey= — find every card
 * in the project carrying a link with that provider + external key. Both query
 * params are required (400 otherwise).
 */
export async function handleFindCardLinks(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');

  const provider = ctx.url.searchParams.get('provider');
  const externalKey = ctx.url.searchParams.get('externalKey');
  if (!provider || !externalKey) {
    throw new HttpError(400, 'provider and externalKey query params are required');
  }
  const matches = await findCardLinksInProject(ctx.env, tenantId, project.id, provider, externalKey);
  return jsonResponse(200, { matches }, ctx.cors);
}
