import type { Env } from './env';
import type { AuthContext } from '@kbrelay/shared';
import { handleMe, handlePatchMe, handleMyQueue } from './routes/me';
import { handleListMentions, handleMarkMentionsRead } from './routes/mentions';
import { handleListUsers } from './routes/users';
import {
  handleListProjects,
  handleCreateProject,
  handleGetProject,
  handlePatchProject,
  handleDeleteProject,
} from './routes/projects';
import {
  handleListColumns,
  handleCreateColumn,
  handlePatchColumn,
  handleDeleteColumn,
} from './routes/columns';
import {
  handleListCards,
  handleCreateCard,
  handleGetCard,
  handlePatchCard,
  handleDeleteCard,
  handleListTimeline,
  handleAddComment,
  handleRedactComment,
} from './routes/cards';
import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleForgotPassword,
  handleResetPassword,
  handleAcceptInvite,
  handleAuthMe,
} from './routes/auth';
import { handleListTokens, handleCreateToken, handleDeleteToken } from './routes/tokens';
import {
  handleGetTeam,
  handleInvite,
  handleRevokeInvite,
  handleSetMemberRole,
  handleRemoveMember,
  handleSetMemberProjects,
} from './routes/team';
import {
  handleListAgents,
  handleCreateAgent,
  handlePatchAgent,
  handleRemoveAgent,
  handleListAgentTokens,
  handleCreateAgentToken,
  handleRevokeAgentToken,
} from './routes/agents';
import type { AccessScope } from './auth/access';
import { handleOpenApi } from './openapi';

/** Everything a route handler needs. `auth` is non-null for protected routes. */
export interface RouteContext {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  cors: Record<string, string>;
  auth: AuthContext | null;
  /** Schedule fire-and-forget work (e.g. sending email) past the response. */
  waitUntil: (p: Promise<unknown>) => void;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response> | Response;

export interface Route {
  method: string;
  /** Path template, e.g. `/api/v1/projects/:id/cards`. */
  pattern: string;
  /** Public routes skip auth (health, openapi). Defaults to protected. */
  public?: boolean;
  /**
   * Project-RBAC scope (v0.11.0). When set, the dispatcher resolves the owning
   * project from the path and enforces caller access (404 on no-access) before
   * the handler runs. Every project/card/column route must declare this or be
   * in the coverage test's explicit exempt list.
   */
  access?: AccessScope;
  handler: RouteHandler;
}

/**
 * Route table. Handlers are registered here as each feature lands.
 * The dispatcher in index.ts matches method + pattern, extracts params,
 * authenticates protected routes, and invokes the handler.
 */
export const routes: Route[] = [
  // ── Public ──
  { method: 'GET', pattern: '/api/openapi.json', public: true, handler: handleOpenApi },

  // ── Human auth (v0.10.0) — public entrypoints ──
  { method: 'POST', pattern: '/api/v1/auth/register', public: true, handler: handleRegister },
  { method: 'POST', pattern: '/api/v1/auth/login', public: true, handler: handleLogin },
  { method: 'POST', pattern: '/api/v1/auth/logout', public: true, handler: handleLogout },
  { method: 'POST', pattern: '/api/v1/auth/forgot-password', public: true, handler: handleForgotPassword },
  { method: 'POST', pattern: '/api/v1/auth/reset-password', public: true, handler: handleResetPassword },
  { method: 'GET', pattern: '/api/v1/auth/me', handler: handleAuthMe },

  // ── Self-service API keys (v0.10.0) ──
  { method: 'GET', pattern: '/api/v1/me/tokens', handler: handleListTokens },
  { method: 'POST', pattern: '/api/v1/me/tokens', handler: handleCreateToken },
  { method: 'DELETE', pattern: '/api/v1/me/tokens/:id', handler: handleDeleteToken },

  // ── Identity ──
  { method: 'GET', pattern: '/api/v1/me', handler: handleMe },
  { method: 'PATCH', pattern: '/api/v1/me', handler: handlePatchMe },
  // Actionable queue (v0.15.0): assigned-to-me cards in a `ready`-role column.
  // Not project-scoped in the router — it filters by RBAC internally.
  { method: 'GET', pattern: '/api/v1/me/queue', handler: handleMyQueue },
  { method: 'GET', pattern: '/api/v1/users', handler: handleListUsers },

  // ── Mentions / notifications (v0.8.0) ──
  { method: 'GET', pattern: '/api/v1/me/mentions', handler: handleListMentions },
  { method: 'POST', pattern: '/api/v1/me/mentions/read', handler: handleMarkMentionsRead },

  // ── Team management & RBAC (v0.11.0) — admin-gated in-handler ──
  { method: 'POST', pattern: '/api/v1/auth/accept-invite', public: true, handler: handleAcceptInvite },
  { method: 'GET', pattern: '/api/v1/team', handler: handleGetTeam },
  { method: 'POST', pattern: '/api/v1/team/invites', handler: handleInvite },
  { method: 'DELETE', pattern: '/api/v1/team/invites/:id', handler: handleRevokeInvite },
  { method: 'PATCH', pattern: '/api/v1/team/members/:userId', handler: handleSetMemberRole },
  { method: 'DELETE', pattern: '/api/v1/team/members/:userId', handler: handleRemoveMember },
  { method: 'PUT', pattern: '/api/v1/team/members/:userId/projects', handler: handleSetMemberProjects },

  // ── Agent users (v0.14.0) — admin-gated in-handler; not project-scoped ──
  { method: 'GET', pattern: '/api/v1/agents', handler: handleListAgents },
  { method: 'POST', pattern: '/api/v1/agents', handler: handleCreateAgent },
  { method: 'PATCH', pattern: '/api/v1/agents/:userId', handler: handlePatchAgent },
  { method: 'DELETE', pattern: '/api/v1/agents/:userId', handler: handleRemoveAgent },
  { method: 'GET', pattern: '/api/v1/agents/:userId/tokens', handler: handleListAgentTokens },
  { method: 'POST', pattern: '/api/v1/agents/:userId/tokens', handler: handleCreateAgentToken },
  { method: 'DELETE', pattern: '/api/v1/agents/:userId/tokens/:tokenId', handler: handleRevokeAgentToken },

  // ── Projects ── (list filters in-handler; create auto-grants the creator)
  { method: 'GET', pattern: '/api/v1/projects', handler: handleListProjects },
  { method: 'POST', pattern: '/api/v1/projects', handler: handleCreateProject },
  { method: 'GET', pattern: '/api/v1/projects/:id', access: { kind: 'project', param: 'id' }, handler: handleGetProject },
  { method: 'PATCH', pattern: '/api/v1/projects/:id', access: { kind: 'project', param: 'id' }, handler: handlePatchProject },
  { method: 'DELETE', pattern: '/api/v1/projects/:id', access: { kind: 'project', param: 'id' }, handler: handleDeleteProject },

  // ── Columns ──
  { method: 'GET', pattern: '/api/v1/projects/:id/columns', access: { kind: 'project', param: 'id' }, handler: handleListColumns },
  { method: 'POST', pattern: '/api/v1/projects/:id/columns', access: { kind: 'project', param: 'id' }, handler: handleCreateColumn },
  { method: 'PATCH', pattern: '/api/v1/columns/:id', access: { kind: 'column', param: 'id' }, handler: handlePatchColumn },
  { method: 'DELETE', pattern: '/api/v1/columns/:id', access: { kind: 'column', param: 'id' }, handler: handleDeleteColumn },

  // ── Cards ──
  { method: 'GET', pattern: '/api/v1/projects/:id/cards', access: { kind: 'project', param: 'id' }, handler: handleListCards },
  { method: 'POST', pattern: '/api/v1/projects/:id/cards', access: { kind: 'project', param: 'id' }, handler: handleCreateCard },
  { method: 'GET', pattern: '/api/v1/cards/:id', access: { kind: 'card', param: 'id' }, handler: handleGetCard },
  { method: 'PATCH', pattern: '/api/v1/cards/:id', access: { kind: 'card', param: 'id' }, handler: handlePatchCard },
  { method: 'DELETE', pattern: '/api/v1/cards/:id', access: { kind: 'card', param: 'id' }, handler: handleDeleteCard },

  // ── Card timeline (v0.3.0) ──
  { method: 'GET', pattern: '/api/v1/cards/:id/timeline', access: { kind: 'card', param: 'id' }, handler: handleListTimeline },
  { method: 'POST', pattern: '/api/v1/cards/:id/comments', access: { kind: 'card', param: 'id' }, handler: handleAddComment },
  { method: 'DELETE', pattern: '/api/v1/cards/:id/comments/:commentId', access: { kind: 'card', param: 'id' }, handler: handleRedactComment },
];
