/**
 * Agent users (v0.14.0, KBR-3; ownership model KBR-115). Every tenant user can
 * create and manage their OWN agent users — real users with kind='agent' and
 * an OWNER (the managing human) — grant them access to projects the owner can
 * see, and mint API keys for them. Each agent runtime uses its own key and
 * acts AS that agent, so provenance (created_by / assignee / @-mentions) is
 * correct.
 *
 * Visibility is ownership-scoped (KBR-115): members manage only their own
 * agents; admins additionally manage member-owned and ownerless agents (but
 * never another admin's); the tenant owner manages every agent. A hard cap
 * applies everywhere: an agent never outranks its owning human.
 *
 * These are the wire-level input schemas + response DTOs shared by the Worker
 * and the web client. Token minting reuses `createTokenInput` from accounts.ts.
 */

import { z } from 'zod';
import type { MembershipRole } from './accounts.ts';

/** Create an agent user. Optionally grant it access to projects up front
 *  (silently intersected with the projects the CALLER can see). */
export const createAgentInput = z.object({
  name: z.string().trim().min(1, 'name is required').max(80),
  projectIds: z.array(z.string()).optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentInput>;

/** Rename an agent, reassign its owner (admin+), recolor it (KBR-74), and/or
 *  set its workspace role (KBR-115 — capped at the owner's own role). At least
 *  one field required. Same #rrggbb rule as PATCH /me. */
export const patchAgentInput = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    ownerUserId: z.string().min(1).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex').optional(),
    role: z.enum(['admin', 'member']).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.ownerUserId !== undefined || v.color !== undefined || v.role !== undefined,
    { message: 'Provide name, ownerUserId, color, and/or role' },
  );
export type PatchAgentInput = z.infer<typeof patchAgentInput>;

/** Replace an agent's project access (PUT /agents/:userId/projects). Scoped:
 *  only projects the CALLER can see are granted or revoked; grants outside the
 *  caller's visibility survive untouched. */
export const setAgentProjectsInput = z.object({ projectIds: z.array(z.string()) });
export type SetAgentProjectsInput = z.infer<typeof setAgentProjectsInput>;

/** An agent user as shown in the Agents modal. */
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
   *  can manage the team — change it via PATCH /agents/:userId. */
  role: MembershipRole;
  /** The owning human's membership role; null for ownerless/orphaned agents. */
  ownerRole: MembershipRole | null;
  /** The highest role this agent may hold — an agent never outranks its owner
   *  (KBR-115). Server-computed so clients never re-derive policy. */
  roleCap: MembershipRole;
  createdAt: number;
}

export interface AgentsResponse {
  agents: AgentSummary[];
}
