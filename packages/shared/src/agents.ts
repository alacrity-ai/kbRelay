/**
 * Agent users (v0.14.0, KBR-3). A tenant admin creates and manages "agent
 * users" — real users with kind='agent' and an OWNER (the managing human) —
 * grants each Member access to projects, and mints API keys for them. Each
 * agent runtime uses its own key and acts AS that agent, so provenance
 * (created_by / assignee / @-mentions) is correct.
 *
 * These are the wire-level input schemas + response DTOs shared by the Worker
 * and the web client. Token minting reuses `createTokenInput` from accounts.ts.
 */

import { z } from 'zod';

/** Create an agent user. Optionally grant it access to projects up front. */
export const createAgentInput = z.object({
  name: z.string().trim().min(1, 'name is required').max(80),
  projectIds: z.array(z.string()).optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentInput>;

/** Rename an agent and/or reassign its owner. At least one field required. */
export const patchAgentInput = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    ownerUserId: z.string().min(1).optional(),
  })
  .refine((v) => v.name !== undefined || v.ownerUserId !== undefined, {
    message: 'Provide name and/or ownerUserId',
  });
export type PatchAgentInput = z.infer<typeof patchAgentInput>;

/** An agent user as shown in the Agents tab. */
export interface AgentSummary {
  id: string;
  name: string;
  handle: string | null;
  /** The managing human (may be null for legacy/unmanaged agents). */
  ownerUserId: string | null;
  ownerName: string | null;
  /** Project ids this agent can access. */
  projectIds: string[];
  /** Count of live (non-revoked) API keys. */
  tokenCount: number;
  createdAt: number;
}

export interface AgentsResponse {
  agents: AgentSummary[];
}
