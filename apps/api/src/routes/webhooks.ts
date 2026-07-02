import { createWebhookInput, patchWebhookInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse } from '../http';
import { parseJson } from '../validate';
import { requireAdmin } from '../auth/access';
import {
  listSubscriptions,
  createSubscription,
  patchSubscription,
  deleteSubscription,
} from '../db/repos/webhooks';

/**
 * Webhook subscription admin surface (KBR-16) — the tenant-level delivery
 * targets for agent callback events. Admin-gated (member → 403), like agents.
 * Create returns the signing `secret` ONCE; thereafter it's used server-side to
 * sign deliveries and never re-shown.
 */

export async function handleListWebhooks(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth } = ctx;
  requireAdmin(auth);
  const webhooks = await listSubscriptions(env, auth!.tenantId);
  return jsonResponse(200, { webhooks }, cors);
}

export async function handleCreateWebhook(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, createWebhookInput);
  const created = await createSubscription(env, auth!.tenantId, auth!.userId, input);
  return jsonResponse(201, created, cors);
}

export async function handlePatchWebhook(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params, request } = ctx;
  requireAdmin(auth);
  const input = await parseJson(request, patchWebhookInput);
  const webhook = await patchSubscription(env, auth!.tenantId, params.id!, input);
  return jsonResponse(200, { webhook }, cors);
}

export async function handleDeleteWebhook(ctx: RouteContext): Promise<Response> {
  const { env, cors, auth, params } = ctx;
  requireAdmin(auth);
  await deleteSubscription(env, auth!.tenantId, params.id!);
  return jsonResponse(200, { ok: true }, cors);
}
