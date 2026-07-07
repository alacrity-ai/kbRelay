import { createCardInput, patchCardInput, createCommentInput, reviewCardInput, countCardTasks, checkAllTasks, type WebhookTrigger } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { requireAdmin } from '../auth/access';
import { getProject } from '../db/repos/projects';
import { listCards, getCard, createCard, patchCard, deleteCard, autoArchiveDone } from '../db/repos/cards';
import { listColumns } from '../db/repos/columns';
import { listTimeline, addComment, addReviewEvent, redactComment } from '../db/repos/card_events';
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
  // Archiving AND restoring are board hygiene → admin-only (KBR-101; KBR-94
  // originally gated only restore, but members archiving live work is wrong too).
  if (input.archived !== undefined) requireAdmin(ctx.auth);
  // A card's CONTENT (summary, description, acceptance criteria, labels, due
  // date) belongs to its creator or an admin (KBR-101). Workflow fields —
  // column moves, assignee, reviewer — stay open to any member with access,
  // because that's how work is relayed. The web client diffs its PATCHes so
  // untouched content fields aren't sent.
  const touchesContent =
    input.summary !== undefined ||
    input.description !== undefined ||
    input.acceptanceCriteria !== undefined ||
    input.labelIds !== undefined ||
    input.dueAt !== undefined;
  if (touchesContent && ctx.auth?.role !== 'admin') {
    const existing = await getCard(ctx.env, tenantId, ctx.params.id!);
    if (existing && existing.createdBy !== userId) {
      throw new HttpError(403, "Only the card's creator or an admin can edit its summary, description, acceptance criteria, labels, or due date");
    }
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

/**
 * POST /api/v1/cards/:id/review — the assigned reviewer's verdict (KBR-110).
 *
 * Guards (server-side; hiding the UI buttons is not authorization):
 *   403 — caller is not the card's assigned reviewer.
 *   400 — the card is not in a `review`-role column.
 *
 * Effects, in one handler so events/mentions/webhooks fire consistently:
 *   both     → a `review` timeline event with meta {decision} (+ body mentions)
 *   approve  → every unchecked AC checkbox checked + move to the `done`-role
 *              column; reject → move to the `in_progress`-role column.
 *   A missing target column skips the move (the verdict still lands).
 */
export async function handleReviewCard(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const card = await getCard(ctx.env, tenantId, ctx.params.id!);
  if (!card) throw new HttpError(404, 'Card not found');
  if (card.reviewerUserId !== userId) {
    throw new HttpError(403, 'Only the assigned reviewer can review this card');
  }
  const columns = await listColumns(ctx.env, tenantId, card.projectId);
  const current = columns.find((c) => c.id === card.columnId);
  if (current?.role !== 'review') {
    throw new HttpError(400, 'Card is not in a review column');
  }
  const input = await parseJson(ctx.request, reviewCardInput);

  const triggers: WebhookTrigger[] = [];
  const decision = input.decision === 'approve' ? 'approved' : 'rejected';
  const event = await addReviewEvent(
    ctx.env, tenantId, card.id, userId, decision, input.body?.trim() || null, triggers,
  );

  // Build the follow-up patch: AC completion (approve only) + the column move.
  const patch: { acceptanceCriteria?: string; columnId?: string } = {};
  if (input.decision === 'approve') {
    const checked = checkAllTasks(card.acceptanceCriteria);
    if (checked != null) patch.acceptanceCriteria = checked;
  }
  const targetRole = input.decision === 'approve' ? 'done' : 'in_progress';
  const target = columns.find((c) => c.role === targetRole);
  if (target && target.id !== card.columnId) patch.columnId = target.id;

  const updated = Object.keys(patch).length
    ? await patchCard(ctx.env, tenantId, card.id, userId, patch, triggers)
    : card;

  if (triggers.length) ctx.waitUntil(dispatchTriggers(ctx.env, tenantId, updated, userId, triggers));
  return jsonResponse(200, { card: updated, event }, ctx.cors);
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
