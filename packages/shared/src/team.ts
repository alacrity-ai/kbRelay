/**
 * Team management & project RBAC (v0.11.0). An admin governs a tenant from one
 * Tenant Settings modal: invite/remove/role, and grant/revoke each member's
 * access to individual projects. Access is BINARY — a member either has full
 * access to a project or none.
 */

import { z } from 'zod';
import { emailSchema } from './accounts.ts';
import type { UserKind } from './auth.ts';
import type { MembershipRole } from './accounts.ts';

export const membershipRoleSchema = z.enum(['admin', 'member']);

// ── Endpoint inputs ───────────────────────────────────────────

export const inviteInput = z.object({
  email: emailSchema,
  role: membershipRoleSchema,
});
export type InviteInput = z.infer<typeof inviteInput>;

export const acceptInviteInput = z.object({
  token: z.string().min(1, 'token is required'),
  // Required only when the invite creates a brand-new user (enforced server-side).
  name: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(8).max(200).optional(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteInput>;

export const setMemberRoleInput = z.object({ role: membershipRoleSchema });
export type SetMemberRoleInput = z.infer<typeof setMemberRoleInput>;

export const setProjectAccessInput = z.object({ projectIds: z.array(z.string()) });
export type SetProjectAccessInput = z.infer<typeof setProjectAccessInput>;

// ── Response DTOs ─────────────────────────────────────────────

/** A tenant member as shown in the settings modal. */
export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  kind: UserKind;
  role: MembershipRole;
  /** The tenant owner (KBR-114): un-demotable, un-removable. */
  isOwner: boolean;
  /** Project ids this member can access. Admins: all (the UI shows "all"). */
  projectIds: string[];
}

export interface PendingInvite {
  id: string;
  email: string;
  role: MembershipRole;
  createdAt: number;
  expiresAt: number;
}

export interface TeamResponse {
  members: TeamMember[];
  invites: PendingInvite[];
}
