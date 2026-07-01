import type { RouteContext } from '../router';
import { jsonResponse } from '../http';
import { parseJson } from '../validate';
import { tenantScope } from '../auth/tenant-scope';
import { mentionsStatus, markMentionsReadInput, type MentionsResponse } from '@kbrelay/shared';
import { listMentions, markMentionsRead } from '../db/repos/mentions';

/**
 * GET /api/v1/me/mentions?status=unread|read|all (default unread).
 * Side-effect-free — listing never marks anything read (see design §2). The
 * caller only ever sees their own mentions, tenant-wide.
 */
export async function handleListMentions(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const parsed = mentionsStatus.safeParse(ctx.url.searchParams.get('status') ?? 'unread');
  const status = parsed.success ? parsed.data : 'unread';
  const body: MentionsResponse = await listMentions(ctx.env, tenantId, userId, status, ctx.auth?.role === 'admin');
  return jsonResponse(200, body, ctx.cors);
}

/**
 * POST /api/v1/me/mentions/read — explicit acknowledgment. Body is
 * { mentionIds: [...] } or { all: true }. Only marks the caller's own mentions.
 */
export async function handleMarkMentionsRead(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const input = await parseJson(ctx.request, markMentionsReadInput);
  const unreadCount = await markMentionsRead(ctx.env, tenantId, userId, input);
  return jsonResponse(200, { unreadCount }, ctx.cors);
}
