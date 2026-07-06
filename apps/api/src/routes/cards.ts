import { createCardInput, patchCardInput, createCommentInput, countCardTasks, type WebhookTrigger } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { requireAdmin } from '../auth/access';
import { getProject } from '../db/repos/projects';
import { listCards, getCard, createCard, patchCard, deleteCard, autoArchiveDone } from '../db/repos/cards';
import { listTimeline, addComment, redactComment } from '../db/repos/card_events';
import { listCardAttachments, attachmentCountsForCards, purgeBlobs } from '../db/repos/attachments';
import { listCardLinks, linkCountsForCards } from '../db/repos/card-links';
import { labelsForCards } from '../db/repos/labels';
import { dispatchTriggers } from '../services/webhooks';

export async function handleListCards(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const project = await getProject(ctx.env, tenantId, ctx.params.id!);
  if (!project) throw new HttpError(404, 'Project not found');
  // Due-date conveniences (KBR-63): whitelisted values only, 400 on anything else.
  const due = ctx.url.searchParams.get('due') ?? undefined;
  if (due !== undefined && due !== 'overdue' && due !== 'soon') {
    throw new HttpError(400, "due must be 'overdue' or 'soon'");
  }
  const sort = ctx.url.searchParams.get('sort') ?? undefined;
  if (sort !== undefined && sort !== 'due') {
    throw new HttpError(400, "sort must be 'due'");
  }
  // Lazy done-column hygiene (KBR-60): the board read IS the scheduler.
  if (project.autoArchiveDoneDays != null) {
    await autoArchiveDone(ctx.env, tenantId, project.id, project.autoArchiveDoneDays);
  }
  const cards = await listCards(ctx.env, tenantId, project.id, {
    columnId: ctx.url.searchParams.get('column') ?? undefined,
    assignee: ctx.url.searchParams.get('assignee') ?? undefined,
    q: ctx.url.searchParams.get('q') ?? undefined,
    due,
    sort,
    archived: ctx.url.searchParams.get('archived') === '1',
    label: ctx.url.searchParams.get('label') ?? undefined,
  });
  // Enrich each card with its per-kind attachment counts for the board badges,
  // its task-list progress (v0.17.0, KBR-59 — computed here so the web never
  // parses every body), and its labels (KBR-62) — one grouped query each.
  const [counts, linkCounts, labels] = await Promise.all([
    attachmentCountsForCards(ctx.env, tenantId, cards.map((c) => c.id)),
    linkCountsForCards(ctx.env, tenantId, cards.map((c) => c.id)),
    labelsForCards(ctx.env, tenantId, cards.map((c) => c.id)),
  ]);
  const withCounts = cards.map((c) => {
    const tasks = countCardTasks(c.description, c.acceptanceCriteria);
    return {
      ...c,
      attachmentCounts: counts[c.id],
      linkCount: linkCounts[c.id] ?? 0,
      labels: labels[c.id] ?? [],
      ...(tasks.total > 0 ? { taskCounts: tasks } : {}),
    };
  });
  return jsonResponse(200, { cards: withCounts }, ctx.cors);
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
  const [attachments, links, labels] = await Promise.all([
    listCardAttachments(ctx.env, tenantId, card.id),
    listCardLinks(ctx.env, tenantId, card.id),
    labelsForCards(ctx.env, tenantId, [card.id]),
  ]);
  return jsonResponse(200, { card: { ...card, attachments, links, labels: labels[card.id] ?? [] } }, ctx.cors);
}

export async function handlePatchCard(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, patchCardInput);
  if (input.archived === false) {
    // Restoring from the archive is a settings-tab action → admin-only
    // (KBR-94). Archiving stays member-allowed; a redundant archived:false on
    // a live card is a no-op, so only a real restore is gated.
    const existing = await getCard(ctx.env, tenantId, ctx.params.id!);
    if (existing?.archivedAt) requireAdmin(ctx.auth);
  }
  const triggers: WebhookTrigger[] = [];
  const card = await patchCard(ctx.env, tenantId, ctx.params.id!, userId, input, triggers);
  if (triggers.length) ctx.waitUntil(dispatchTriggers(ctx.env, tenantId, card, userId, triggers));
  return jsonResponse(200, { card }, ctx.cors);
}

export async function handleDeleteCard(ctx: RouteContext): Promise<Response> {
  // Destructive and irreversible (card + timeline + attachments) → admin-only
  // (KBR-94 follow-up: a member deleted a live ticket). Members archive instead.
  requireAdmin(ctx.auth);
  const { tenantId } = tenantScope(ctx.auth);
  const blobKeys = await deleteCard(ctx.env, tenantId, ctx.params.id!);
  // Purge the bytes after responding — rows are already gone (KBR-41).
  ctx.waitUntil(purgeBlobs(ctx.env, blobKeys));
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
  const { event, blobKeys } = await redactComment(ctx.env, tenantId, card.id, ctx.params.commentId!, userId);
  ctx.waitUntil(purgeBlobs(ctx.env, blobKeys)); // purge redacted files off the response path (KBR-41)
  return jsonResponse(200, { event }, ctx.cors);
}
