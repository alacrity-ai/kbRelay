import { z } from 'zod';
import { defineTool, type Tool } from '../define-tool.js';

/**
 * The kbRelay MCP tool surface. Every tool is RBAC-scoped by the token — a tool
 * only sees/touches projects the token's user can access. Descriptions teach the
 * model kbRelay's conventions: status = column (move, don't set a field), report
 * on the timeline (don't rewrite the description), write markdown, `@handle` to
 * notify, refer to tickets by key (OBL-1).
 */

const qs = (params: Record<string, string | undefined>): string => {
  const pairs = Object.entries(params).filter(([, v]) => v != null && v !== '');
  return pairs.length ? '?' + pairs.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&') : '';
};
const enc = encodeURIComponent;

export const allTools: Tool[] = [
  // ── Identity ──
  defineTool({
    name: 'whoami',
    description: 'Who this token is: the current user (id, name, kind, role) and tenant. Call first to learn your own user id.',
    inputSchema: z.object({}),
    handler: (_a, c) => c.request('GET', '/v1/me'),
  }),
  defineTool({
    name: 'list_users',
    description: 'List the tenant\'s users (id, name, kind, @handle, profile). Resolve a name→id for assignment or a @handle to mention; read `profile` for who a person is (role/persona) and how to weigh their feedback.',
    inputSchema: z.object({}),
    handler: (_a, c) => c.request('GET', '/v1/users'),
  }),

  // ── Projects ──
  defineTool({
    name: 'list_projects',
    description: 'List projects you can access (admins: all). Each has a code (e.g. OBL) that prefixes ticket keys, a description (the project\'s purpose/context), a color, and cardCount (total tickets in the project).',
    inputSchema: z.object({ status: z.enum(['active', 'archived']).optional() }),
    handler: (a, c) => c.request('GET', `/v1/projects${qs({ status: a.status })}`),
  }),
  defineTool({
    name: 'get_project',
    description: 'Get a project (name, code, description, color, status) + its columns, each with an optional `role`. Read `description` for context. Resolve target columns by `role`, never by hardcoded name.',
    inputSchema: z.object({ projectId: z.string() }),
    handler: (a, c) => c.request('GET', `/v1/projects/${enc(a.projectId)}`),
  }),
  defineTool({
    name: 'create_project',
    description: 'Create a project. `code` (2–6 alnum, e.g. LSEO) is required and prefixes ticket keys; default columns are seeded. `description` gives future readers (human or agent) the project\'s purpose.',
    inputSchema: z.object({
      name: z.string(),
      code: z.string(),
      description: z.string().nullish(),
      color: z.string().nullish(),
    }),
    handler: (a, c) => c.request('POST', '/v1/projects', a),
  }),
  defineTool({
    name: 'update_project',
    description: 'Edit a project: name, code, description (its purpose/context), color (#rrggbb or null to reset), or status (active/archived). Only pass the fields you want to change.',
    inputSchema: z.object({
      projectId: z.string(),
      name: z.string().optional(),
      code: z.string().optional(),
      description: z.string().nullish(),
      color: z.string().nullish(),
      status: z.enum(['active', 'archived']).optional(),
    }),
    handler: (a, c) => {
      const { projectId, ...body } = a;
      return c.request('PATCH', `/v1/projects/${enc(projectId)}`, body);
    },
  }),

  // ── Cards ──
  defineTool({
    name: 'list_cards',
    description: 'List cards in a project. Optional filters: column (id), assignee (user id), q (text search on summary/description).',
    inputSchema: z.object({
      projectId: z.string(),
      column: z.string().optional(),
      assignee: z.string().optional(),
      q: z.string().optional(),
    }),
    handler: (a, c) =>
      c.request('GET', `/v1/projects/${enc(a.projectId)}/cards${qs({ column: a.column, assignee: a.assignee, q: a.q })}`),
  }),
  defineTool({
    name: 'get_card',
    description: 'Get one card by id (summary, description, acceptanceCriteria, column, assignee, ticket key). Read the spec before working it.',
    inputSchema: z.object({ cardId: z.string() }),
    handler: (a, c) => c.request('GET', `/v1/cards/${enc(a.cardId)}`),
  }),
  defineTool({
    name: 'create_card',
    description: 'Create a card (defaults to the first column). Write summary plain; description/acceptanceCriteria in markdown; @handle to notify.',
    inputSchema: z.object({
      projectId: z.string(),
      summary: z.string(),
      description: z.string().nullish(),
      acceptanceCriteria: z.string().nullish(),
      columnId: z.string().optional(),
      assigneeUserId: z.string().nullish(),
    }),
    handler: (a, c) => {
      const { projectId, ...body } = a;
      return c.request('POST', `/v1/projects/${enc(projectId)}/cards`, body);
    },
  }),
  defineTool({
    name: 'update_card',
    description: 'Edit a card and/or move it (status = column). Move by role: pickup → in_progress, finish → review, done only when told, stuck → blocked. Log progress via add_comment, not the description.',
    inputSchema: z.object({
      cardId: z.string(),
      summary: z.string().optional(),
      description: z.string().nullish(),
      acceptanceCriteria: z.string().nullish(),
      columnId: z.string().optional(),
      assigneeUserId: z.string().nullish(),
      position: z.number().optional(),
    }),
    handler: (a, c) => {
      const { cardId, ...body } = a;
      return c.request('PATCH', `/v1/cards/${enc(cardId)}`, body);
    },
  }),
  defineTool({
    name: 'delete_card',
    description: 'Delete a card (cascades its timeline + mentions). Irreversible.',
    inputSchema: z.object({ cardId: z.string() }),
    handler: (a, c) => c.request('DELETE', `/v1/cards/${enc(a.cardId)}`),
  }),

  defineTool({
    name: 'get_project_activity',
    description:
      'Project activity feed: newest-first card events across the board (creates/moves/assigns/comments) with cardKey + cardSummary. Catch up on "what happened while I was away"; nextCursor pages older.',
    inputSchema: z.object({
      projectId: z.string(),
      since: z.number().optional(),
      limit: z.number().optional(),
      cursor: z.string().optional(),
    }),
    handler: (a, c) =>
      c.request(
        'GET',
        `/v1/projects/${enc(a.projectId)}/events${qs({
          since: a.since != null ? String(a.since) : undefined,
          limit: a.limit != null ? String(a.limit) : undefined,
          cursor: a.cursor,
        })}`,
      ),
  }),

  // ── Timeline ──
  defineTool({
    name: 'get_timeline',
    description: 'The card\'s activity log (system events + comments), oldest→newest — the who-did-what-when history.',
    inputSchema: z.object({ cardId: z.string() }),
    handler: (a, c) => c.request('GET', `/v1/cards/${enc(a.cardId)}/timeline`),
  }),
  defineTool({
    name: 'add_comment',
    description: 'Report results ON the timeline (not by editing the description). A note or a structured handoff. Body is markdown; @handle to notify.',
    inputSchema: z.object({
      cardId: z.string(),
      type: z.enum(['note', 'handoff']).default('note'),
      body: z.string(),
      meta: z
        .object({
          summary: z.string().optional(),
          evidence: z.array(z.string()).optional(),
          verify: z.array(z.string()).optional(),
          spunOff: z.array(z.string()).optional(),
        })
        .optional(),
    }),
    handler: (a, c) => {
      const { cardId, ...body } = a;
      return c.request('POST', `/v1/cards/${enc(cardId)}/comments`, body);
    },
  }),
  defineTool({
    name: 'redact_comment',
    description: 'Redact (soft-delete) YOUR OWN comment — leaves a tombstone. For a leaked secret / PII / wrong-card post. Author-only.',
    inputSchema: z.object({ cardId: z.string(), commentId: z.string() }),
    handler: (a, c) => c.request('DELETE', `/v1/cards/${enc(a.cardId)}/comments/${enc(a.commentId)}`),
  }),

  // ── Your queue (what to work now) ──
  defineTool({
    name: 'list_my_queue',
    description:
      'Your queue: cards assigned to you in a `ready`-role column (optional projectId). Work these first. Pick up → in_progress, finish → review + handoff, done only when told.',
    inputSchema: z.object({ projectId: z.string().optional() }),
    handler: (a, c) => c.request('GET', `/v1/me/queue${qs({ projectId: a.projectId })}`),
  }),

  // ── Mentions (your inbox) ──
  defineTool({
    name: 'get_mentions',
    description: 'Your @-mentions (default unread). Side-effect-free — listing does NOT clear them. This is how you find "what did people ask me?".',
    inputSchema: z.object({ status: z.enum(['unread', 'read', 'all']).optional() }),
    handler: (a, c) => c.request('GET', `/v1/me/mentions${qs({ status: a.status })}`),
  }),
  defineTool({
    name: 'mark_mentions_read',
    description: 'Acknowledge mentions after handling them: pass mentionIds, or all:true to clear everything.',
    inputSchema: z
      .object({ mentionIds: z.array(z.string()).optional(), all: z.boolean().optional() })
      .refine((v) => v.all || (v.mentionIds && v.mentionIds.length > 0), {
        message: 'Provide mentionIds or all:true',
      }),
    handler: (a, c) => c.request('POST', '/v1/me/mentions/read', a),
  }),
];
