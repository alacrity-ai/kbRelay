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
import type { MembershipRole } from './accounts.ts';

/** Create an agent user. Optionally grant it access to projects up front. */
export const createAgentInput = z.object({
  name: z.string().trim().min(1, 'name is required').max(80),
  projectIds: z.array(z.string()).optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentInput>;

/** Rename an agent, reassign its owner, and/or recolor it (KBR-74). At least
 *  one field required. Same #rrggbb rule as PATCH /me. */
export const patchAgentInput = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    ownerUserId: z.string().min(1).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex').optional(),
  })
  .refine((v) => v.name !== undefined || v.ownerUserId !== undefined || v.color !== undefined, {
    message: 'Provide name, ownerUserId, and/or color',
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
  /** Explicit color, or null → deterministic palette fallback (KBR-74). */
  color: string | null;
  /** Project ids this agent can access. */
  projectIds: string[];
  /** Count of live (non-revoked) API keys. */
  tokenCount: number;
  /** Workspace membership role (KBR-113). Admin agents see every project and
   *  can manage the team — change it via PATCH /team/members/:userId. */
  role: MembershipRole;
  createdAt: number;
}

export interface AgentsResponse {
  agents: AgentSummary[];
}
