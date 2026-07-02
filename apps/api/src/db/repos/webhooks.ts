import type { Env } from '../../env';
import type {
  WebhookSubscriptionDto,
  CreatedWebhookSubscription,
  CreateWebhookInput,
  PatchWebhookInput,
} from '@kbrelay/shared';
import { HttpError } from '../../http';
import { newId } from '../ids';
import { randomToken } from './auth';

interface WebhookRow {
  id: string;
  tenant_id: string;
  label: string;
  url: string;
  secret: string;
  target_agent_user_id: string | null;
  enabled: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

/** Wire DTO — never includes the `secret` (returned once on create, then hidden). */
function toDto(r: WebhookRow): WebhookSubscriptionDto {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    label: r.label,
    url: r.url,
    targetAgentUserId: r.target_agent_user_id,
    enabled: r.enabled !== 0,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function getRow(env: Env, tenantId: string, id: string): Promise<WebhookRow | null> {
  return env.db.prepare('SELECT * FROM webhook_subscriptions WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<WebhookRow>();
}

export async function listSubscriptions(env: Env, tenantId: string): Promise<WebhookSubscriptionDto[]> {
  const rs = await env.db.prepare(
    'SELECT * FROM webhook_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC',
  )
    .bind(tenantId)
    .all<WebhookRow>();
  return (rs.results ?? []).map(toDto);
}

export async function createSubscription(
  env: Env,
  tenantId: string,
  userId: string,
  input: CreateWebhookInput,
): Promise<CreatedWebhookSubscription> {
  const id = newId('whs');
  const secret = randomToken();
  const now = Date.now();
  await env.db.prepare(
    `INSERT INTO webhook_subscriptions
       (id, tenant_id, label, url, secret, target_agent_user_id, enabled, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, tenantId, input.label, input.url, secret,
      input.targetAgentUserId ?? null, input.enabled === false ? 0 : 1, userId, now, now,
    )
    .run();
  const row = await getRow(env, tenantId, id);
  if (!row) throw new HttpError(500, 'Webhook insert did not return row');
  return { subscription: toDto(row), secret };
}

export async function patchSubscription(
  env: Env,
  tenantId: string,
  id: string,
  input: PatchWebhookInput,
): Promise<WebhookSubscriptionDto> {
  const existing = await getRow(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Webhook not found');
  const next = {
    label: input.label ?? existing.label,
    url: input.url ?? existing.url,
    target_agent_user_id:
      input.targetAgentUserId === undefined ? existing.target_agent_user_id : input.targetAgentUserId,
    enabled: input.enabled === undefined ? existing.enabled : input.enabled ? 1 : 0,
  };
  await env.db.prepare(
    `UPDATE webhook_subscriptions SET label = ?, url = ?, target_agent_user_id = ?, enabled = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`,
  )
    .bind(next.label, next.url, next.target_agent_user_id, next.enabled, Date.now(), id, tenantId)
    .run();
  const row = await getRow(env, tenantId, id);
  if (!row) throw new HttpError(500, 'Webhook update did not return row');
  return toDto(row);
}

export async function deleteSubscription(env: Env, tenantId: string, id: string): Promise<void> {
  const existing = await getRow(env, tenantId, id);
  if (!existing) throw new HttpError(404, 'Webhook not found');
  await env.db.prepare('DELETE FROM webhook_subscriptions WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .run();
}

/** Enabled subscriptions that should receive an event for `agentUserId` (its own + any-agent). */
export async function activeSubscriptionsForAgent(
  env: Env,
  tenantId: string,
  agentUserId: string,
): Promise<Array<{ id: string; url: string; secret: string }>> {
  const rs = await env.db.prepare(
    `SELECT id, url, secret FROM webhook_subscriptions
      WHERE tenant_id = ? AND enabled = 1
        AND (target_agent_user_id IS NULL OR target_agent_user_id = ?)`,
  )
    .bind(tenantId, agentUserId)
    .all<{ id: string; url: string; secret: string }>();
  return rs.results ?? [];
}

/** The per-project mute valve. Missing project → false (nothing fires). */
export async function agentEventsEnabled(env: Env, tenantId: string, projectId: string): Promise<boolean> {
  const row = await env.db.prepare(
    'SELECT agent_events_enabled AS e FROM projects WHERE id = ? AND tenant_id = ?',
  )
    .bind(projectId, tenantId)
    .first<{ e: number }>();
  return row ? row.e !== 0 : false;
}
