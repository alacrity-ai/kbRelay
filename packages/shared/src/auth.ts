/**
 * Identity primitives shared by the API and the web client.
 *
 * A request authenticates with a bearer token → resolves to a user
 * within a tenant. `kind` distinguishes humans from agents (that's the
 * "was it Claude?" provenance signal); `role` is an unenforced
 * forward-compat hook for future RBAC.
 */

import { z } from 'zod';

export type UserKind = 'human' | 'agent';

/**
 * `read|runner|owner` are the legacy 4-rank hooks; `admin`/`member` are the
 * enforced membership roles (v0.10.0+). Only `admin` vs `member` gate access.
 */
export type Role = 'read' | 'runner' | 'owner' | 'admin' | 'member';

/**
 * Attached to every authenticated request. Both auth modes — bearer token
 * (agents/MCP) and JWT cookie (humans) — resolve to this shape. `role` is
 * the caller's enforced role in `tenantId`, sourced from their membership.
 */
export interface AuthContext {
  tenantId: string;
  userId: string;
  userName: string;
  userKind: UserKind;
  role: Role | null;
  /** The user's color (a card's display color is its assignee's). */
  color: string;
  /** Present for bearer-token auth; null for cookie sessions. */
  tokenId: string | null;
}

/** Wire shape of GET /api/v1/me. */
export interface MeResponse {
  tenant: { id: string; name: string; slug: string };
  user: { id: string; name: string; kind: UserKind; role: Role | null; color: string };
}

/** Wire shape of a tenant user (assignee pickers, /users). */
export interface UserDto {
  id: string;
  name: string;
  kind: UserKind;
  role: Role | null;
  /** Always populated (deterministic fallback if never set explicitly). */
  color: string;
  /** Unique-per-tenant @-mention handle, e.g. "leif". Null if never assigned. */
  handle: string | null;
}

/** PATCH /api/v1/me — set your own color (the token is tied to a user). */
export const patchMeInput = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex'),
});
export type PatchMeInput = z.infer<typeof patchMeInput>;
