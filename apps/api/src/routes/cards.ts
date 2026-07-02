import { createCardInput, patchCardInput, createCommentInput, type WebhookTrigger } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { getProject } from '../db/repos/projects';
import { listCards, getCard, createCard, patchCard, deleteCard } from '../db/repos/cards';
import { listTimeline, addComment, redactComment } from '../db/repos/card_events';
import { dispatchTriggers } from '../services/webhooks';

export async function handleListCards(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const cards = await listCards(ctx.env, tenantId, project.id, {
    columnId: ctx.url.searchParams.get('column') ?? undefined,
    assignee: ctx.url.searchParams.get('assignee') ?? undefined,
    q: ctx.url.searchParams.get('q') ?? undefined,
  });
  return jsonResponse(200, { cards }, ctx.cors);
}

export async function handleCreateCard(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  const input = await parseJson(ctx.request, createCardInput);
  const triggers: WebhookTrigger[] = [];
  const card = await createCard(ctx.env, tenantId, project.id, userId, input, triggers);
  if (triggers.length) ctx.waitUntil(dispatchTriggers(ctx.env, tenantId, card, userId, triggers));
  return jsonResponse(201, { card }, ctx.cors);
}

export async function handleGetCard(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id!);
  if (!card) throw new HttpError(404, 'Card not found');
  return jsonResponse(200, { card }, ctx.cors);
}

export async function handlePatchCard(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchCardInput);
  const triggers: WebhookTrigger[] = [];
  const card = await patchCard(ctx.env, tenantId, ctx.params.id!, userId, input, triggers);
  if (triggers.length) ctx.waitUntil(dispatchTriggers(ctx.env, tenantId, card, userId, triggers));
  return jsonResponse(200, { card }, ctx.cors);
}

export async function handleDeleteCard(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  await deleteCard(ctx.env, tenantId, ctx.params.id!);
  return jsonResponse(200, { ok: true }, ctx.cors);
}

/** GET /api/v1/cards/:id/timeline — system events + comments, chronological. */
export async function handleListTimeline(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id!);
  if (!card) throw new HttpError(404, 'Card not found');
  const events = await listTimeline(ctx.env, tenantId, card.id);
  return jsonResponse(200, { events }, ctx.cors);
}

/** POST /api/v1/cards/:id/comments — add a note or handoff to the timeline. */
export async function handleAddComment(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id!);
  if (!card) throw new HttpError(404, 'Card not found');
  const input = await parseJson(ctx.request, createCommentInput);
  const triggers: WebhookTrigger[] = [];
  const event = await addComment(ctx.env, tenantId, card.id, userId, input, triggers);
  if (triggers.length) ctx.waitUntil(dispatchTriggers(ctx.env, tenantId, card, userId, triggers));
  return jsonResponse(201, { event }, ctx.cors);
}

/** DELETE /api/v1/cards/:id/comments/:commentId — redact (soft-delete) a comment. */
export async function handleRedactComment(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id!);
  if (!card) throw new HttpError(404, 'Card not found');
  const event = await redactComment(ctx.env, tenantId, card.id, ctx.params.commentId!, userId);
  return jsonResponse(200, { event }, ctx.cors);
}
