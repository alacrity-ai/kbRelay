import type {
  MeResponse,
  UserDto,
  ProjectDto,
  ColumnDto,
  ColumnRole,
  CardDto,
  CardEventDto,
  CreateCommentInput,
  ProjectStatus,
  MentionsResponse,
  MentionsStatus,
  ProjectEventsResponse,
  AuthMeResponse,
  RegisterInput,
  LoginInput,
  TokenSummary,
  CreatedToken,
  TeamResponse,
  MembershipRole,
  AgentSummary,
  WebhookSubscriptionDto,
  CreatedWebhookSubscription,
  CreateWebhookInput,
  PatchWebhookInput,
  AttachmentDto,
} from '@kbrelay/shared';
import { getToken } from './auth';

/**
 * Typed client over the kbRelay API. Same-origin `/api` (proxied to the
 * Worker in dev; same host in prod). Every call carries the stored bearer
 * token. Throws Error(message) on a non-2xx so callers can surface it.
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    // Send the session cookie (human auth). A pasted bearer token, if present,
    // takes precedence server-side; both resolve to the same AuthContext.
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string; details?: Record<string, string> };
      if (j.error) message = j.error;
      if (j.details) message += ` — ${Object.entries(j.details).map(([k, v]) => `${k}: ${v}`).join('; ')}`;
    } catch {
      /* no body */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Human auth / sessions (v0.10.0) ──
export const register = (body: RegisterInput) =>
  request<AuthMeResponse>('POST', '/v1/auth/register', body);
export const login = (body: LoginInput) => request<AuthMeResponse>('POST', '/v1/auth/login', body);
export const logout = () => request<{ ok: true }>('POST', '/v1/auth/logout');
export const getAuthMe = () => request<AuthMeResponse>('GET', '/v1/auth/me');
export const forgotPassword = (email: string) =>
  request<{ ok: true }>('POST', '/v1/auth/forgot-password', { email });
export const resetPassword = (token: string, password: string) =>
  request<{ ok: true }>('POST', '/v1/auth/reset-password', { token, password });
export const acceptInvite = (token: string, body: { name?: string; password?: string }) =>
  request<AuthMeResponse>('POST', '/v1/auth/accept-invite', { token, ...body });

// ── Team management & RBAC (v0.11.0) ──
export const getTeam = () => request<TeamResponse>('GET', '/v1/team');
export const inviteMember = (email: string, role: MembershipRole) =>
  request<{ ok: true }>('POST', '/v1/team/invites', { email, role });
export const revokeInvite = (id: string) =>
  request<{ ok: true }>('DELETE', `/v1/team/invites/${id}`);
export const setMemberRole = (userId: string, role: MembershipRole) =>
  request<{ ok: true }>('PATCH', `/v1/team/members/${userId}`, { role });
export const removeMember = (userId: string) =>
  request<{ ok: true }>('DELETE', `/v1/team/members/${userId}`);
export const setMemberProjects = (userId: string, projectIds: string[]) =>
  request<{ ok: true }>('PUT', `/v1/team/members/${userId}/projects`, { projectIds });

// ── Agent users (v0.14.0) ── admin-only
export const listAgents = () => request<{ agents: AgentSummary[] }>('GET', '/v1/agents');
export const createAgent = (name: string, projectIds?: string[]) =>
  request<{ agent: AgentSummary }>('POST', '/v1/agents', { name, projectIds });
export const patchAgent = (userId: string, body: { name?: string; ownerUserId?: string }) =>
  request<{ ok: true }>('PATCH', `/v1/agents/${userId}`, body);
export const removeAgent = (userId: string) =>
  request<{ ok: true }>('DELETE', `/v1/agents/${userId}`);
export const listAgentTokens = (userId: string) =>
  request<{ tokens: TokenSummary[] }>('GET', `/v1/agents/${userId}/tokens`);
export const createAgentToken = (userId: string, label: string) =>
  request<CreatedToken>('POST', `/v1/agents/${userId}/tokens`, { label });
export const revokeAgentToken = (userId: string, tokenId: string) =>
  request<{ ok: true }>('DELETE', `/v1/agents/${userId}/tokens/${tokenId}`);

// ── Webhook subscriptions (v0.15.x) ── admin-only
export const listWebhooks = () =>
  request<{ webhooks: WebhookSubscriptionDto[] }>('GET', '/v1/webhooks');
export const createWebhook = (body: CreateWebhookInput) =>
  request<CreatedWebhookSubscription>('POST', '/v1/webhooks', body);
export const patchWebhook = (id: string, body: PatchWebhookInput) =>
  request<{ webhook: WebhookSubscriptionDto }>('PATCH', `/v1/webhooks/${id}`, body);
export const deleteWebhook = (id: string) =>
  request<{ ok: true }>('DELETE', `/v1/webhooks/${id}`);

// ── Self-service API keys (v0.10.0) ──
export const listTokens = () => request<{ tokens: TokenSummary[] }>('GET', '/v1/me/tokens');
export const createToken = (label: string) =>
  request<CreatedToken>('POST', '/v1/me/tokens', { label });
export const deleteToken = (id: string) => request<{ ok: true }>('DELETE', `/v1/me/tokens/${id}`);

// ── Identity ──
export const getMe = () => request<MeResponse>('GET', '/v1/me');
export const patchMe = (body: { color?: string; profile?: string | null }) =>
  request<MeResponse>('PATCH', '/v1/me', body);
export const listUsers = (projectId?: string) =>
  request<{ users: UserDto[] }>('GET', `/v1/users${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`);

// ── Projects ──
export const listProjects = (status?: ProjectStatus) =>
  request<{ projects: ProjectDto[] }>('GET', `/v1/projects${status ? `?status=${status}` : ''}`);
export const createProject = (body: { name: string; code: string; description?: string | null; color?: string | null }) =>
  request<{ project: ProjectDto; columns: ColumnDto[] }>('POST', '/v1/projects', body);
export const getProject = (id: string) =>
  request<{ project: ProjectDto; columns: ColumnDto[] }>('GET', `/v1/projects/${id}`);
export const patchProject = (id: string, body: Partial<Pick<ProjectDto, 'name' | 'code' | 'description' | 'color' | 'status' | 'agentEventsEnabled'>>) =>
  request<{ project: ProjectDto }>('PATCH', `/v1/projects/${id}`, body);
export const deleteProject = (id: string) => request<{ ok: true }>('DELETE', `/v1/projects/${id}`);

// ── Columns ──
export const createColumn = (
  projectId: string,
  body: { name: string; color?: string | null; position?: number; role?: ColumnRole | null },
) => request<{ column: ColumnDto }>('POST', `/v1/projects/${projectId}/columns`, body);
export const patchColumn = (
  id: string,
  body: { name?: string; color?: string | null; position?: number; role?: ColumnRole | null },
) => request<{ column: ColumnDto }>('PATCH', `/v1/columns/${id}`, body);
export const deleteColumn = (id: string) => request<{ ok: true }>('DELETE', `/v1/columns/${id}`);

// ── Cards ──
export const listCards = (projectId: string) =>
  request<{ cards: CardDto[] }>('GET', `/v1/projects/${projectId}/cards`);
export interface CardInput {
  summary?: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
  columnId?: string;
  assigneeUserId?: string | null;
  position?: number;
}
export const createCard = (projectId: string, body: CardInput) =>
  request<{ card: CardDto }>('POST', `/v1/projects/${projectId}/cards`, body);
export const getCard = (id: string) => request<{ card: CardDto }>('GET', `/v1/cards/${id}`);
export const patchCard = (id: string, body: CardInput) =>
  request<{ card: CardDto }>('PATCH', `/v1/cards/${id}`, body);
export const deleteCard = (id: string) => request<{ ok: true }>('DELETE', `/v1/cards/${id}`);

// ── Project activity feed (v0.17.0) ──
export const listProjectEvents = (
  projectId: string,
  opts: { since?: number; limit?: number; cursor?: string } = {},
) => {
  const q = new URLSearchParams();
  if (opts.since != null) q.set('since', String(opts.since));
  if (opts.limit != null) q.set('limit', String(opts.limit));
  if (opts.cursor) q.set('cursor', opts.cursor);
  const qs = q.toString();
  return request<ProjectEventsResponse>('GET', `/v1/projects/${projectId}/events${qs ? `?${qs}` : ''}`);
};

// ── Card timeline (v0.3.0) ──
export const getTimeline = (cardId: string) =>
  request<{ events: CardEventDto[] }>('GET', `/v1/cards/${cardId}/timeline`);
export const addComment = (cardId: string, body: CreateCommentInput) =>
  request<{ event: CardEventDto }>('POST', `/v1/cards/${cardId}/comments`, body);
export const redactComment = (cardId: string, commentId: string) =>
  request<{ event: CardEventDto }>('DELETE', `/v1/cards/${cardId}/comments/${commentId}`);

// ── Attachments (v0.16.0) ──
/** Same-origin bytes URL for an attachment (append ?download=1 to force download). */
export const attachmentBlobUrl = (id: string, download = false): string =>
  `/api/v1/attachments/${id}/blob${download ? '?download=1' : ''}`;

/** Upload one file to a card (multipart — bypasses the JSON `request` helper so
 *  the browser sets the multipart boundary). Returns the created attachment. */
export async function uploadAttachment(cardId: string, file: File): Promise<AttachmentDto> {
  const token = getToken();
  const fd = new FormData();
  fd.set('file', file);
  const res = await fetch(`/api/v1/cards/${cardId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      /* no body */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return ((await res.json()) as { attachment: AttachmentDto }).attachment;
}

export const deleteAttachment = (id: string) =>
  request<{ ok: true }>('DELETE', `/v1/attachments/${id}`);

// ── Mentions / notifications (v0.8.0) ──
export const getMentions = (status: MentionsStatus = 'unread') =>
  request<MentionsResponse>('GET', `/v1/me/mentions?status=${status}`);
export const markMentionsRead = (body: { mentionIds?: string[]; all?: boolean }) =>
  request<{ unreadCount: number }>('POST', '/v1/me/mentions/read', body);
