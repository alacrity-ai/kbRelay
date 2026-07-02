import { z } from 'zod';

/**
 * Outbound webhook subscriptions (v0.15.x, KBR-16) — the tenant-level delivery
 * target for callback events. An admin registers a URL + gets a signing secret
 * (shown once); kbRelay POSTs a signed payload when a card becomes actionable or
 * an agent is @-mentioned. `targetAgentUserId` null = deliver for any agent.
 */
export interface WebhookSubscriptionDto {
  id: string;
  tenantId: string;
  label: string;
  url: string;
  targetAgentUserId: string | null;
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/** POST response: the subscription + its plaintext secret, returned ONCE. */
export interface CreatedWebhookSubscription {
  subscription: WebhookSubscriptionDto;
  secret: string;
}

const label = z.string().trim().min(1).max(120);
const url = z.string().trim().url().max(2048);
const agentRef = z.string().min(1).max(64).nullable().optional();

export const createWebhookInput = z.object({
  label,
  url,
  targetAgentUserId: agentRef,
  enabled: z.boolean().optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookInput>;

export const patchWebhookInput = z.object({
  label: label.optional(),
  url: url.optional(),
  targetAgentUserId: agentRef,
  enabled: z.boolean().optional(),
});
export type PatchWebhookInput = z.infer<typeof patchWebhookInput>;

/** The two callback events. `card.ready` = assign-into-ready; `card.mention` = an agent was @-mentioned. */
export type WebhookEvent = 'card.ready' | 'card.mention';

/**
 * A pending outbound event, collected by the repo mutation that caused it and
 * dispatched by the route handler (via waitUntil) so the response never blocks.
 */
export interface WebhookTrigger {
  event: WebhookEvent;
  /** The agent to nudge (assignee for card.ready; the mentioned agent for card.mention). */
  recipientUserId: string;
  source: {
    kind: 'assign' | 'mention';
    /** For a mention: where it was written (summary/description/acceptance_criteria/comment). */
    location?: string;
    commentId?: string | null;
  };
}
