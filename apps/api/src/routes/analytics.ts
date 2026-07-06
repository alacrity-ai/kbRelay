import { ANALYTICS_WINDOWS, DEFAULT_ANALYTICS_WINDOW } from '@kbrelay/shared';
import type { AnalyticsWindow } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { tenantScope } from '../auth/tenant-scope';
import { projectAnalytics, tenantAnalytics } from '../db/repos/analytics';

/**
 * Analytics (v0.19.0, KBR-102/103) — read-only aggregates for the Analytics
 * screen. Read access is deliberately member-visible: the scoreboard belongs
 * to the whole team. The workspace route scopes members to their granted
 * projects in-query (same pattern as /v1/search).
 */

function parseDays(ctx: RouteContext): AnalyticsWindow {
  const raw = ctx.url.searchParams.get('days');
  if (raw == null) return DEFAULT_ANALYTICS_WINDOW;
  const days = Number(raw);
  const window = ANALYTICS_WINDOWS.find((w) => w === days);
  if (window === undefined) {
    throw new HttpError(400, `days must be one of ${ANALYTICS_WINDOWS.join(', ')}`);
  }
  return window;
}

/** GET /api/v1/projects/:id/analytics?days= — project-scoped metrics. */
export async function handleProjectAnalytics(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const days = parseDays(ctx);
  const analytics = await projectAnalytics(ctx.env, tenantId, ctx.params.id!, days, Date.now());
  return jsonResponse(200, { analytics }, ctx.cors);
}

/** GET /api/v1/analytics?days= — workspace metrics over accessible projects. */
export async function handleTenantAnalytics(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const days = parseDays(ctx);
  const analytics = await tenantAnalytics(
    ctx.env,
    tenantId,
    { userId, isAdmin: ctx.auth?.role === 'admin' },
    days,
    Date.now(),
  );
  return jsonResponse(200, { analytics }, ctx.cors);
}
