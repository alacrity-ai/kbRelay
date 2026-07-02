import type { RouteContext } from './router';

/**
 * Canonical OpenAPI 3.1 description of the kbRelay API. This object is
 * the single source of truth: it's served at GET /api/openapi.json and
 * checked against the live route table by a parity test, so the contract
 * agents read can never silently drift from what the Worker implements.
 */
export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'kbRelay API',
    version: '0.0.0',
    description:
      'Multi-tenant kanban board API. All /api/v1 routes require a bearer token ' +
      '(Authorization: Bearer <token>) that resolves to a user within a tenant. ' +
      'Every response is scoped to that tenant.',
  },
  servers: [{ url: 'https://kbrelay.lalalimited.com' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'kbrelay_session' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          kind: { type: 'string', enum: ['human', 'agent'] },
          role: { type: ['string', 'null'], enum: ['read', 'runner', 'owner', 'admin', 'member', null] },
          color: { type: 'string', description: 'The user\'s color; a card is shown in its assignee\'s color.' },
          handle: { type: ['string', 'null'], description: 'Unique-per-tenant @-mention handle, e.g. "leif".' },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          code: { type: ['string', 'null'], description: 'Ticket-key prefix, e.g. "OBL".' },
          description: { type: ['string', 'null'] },
          color: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['active', 'archived'] },
          createdBy: { type: 'string' },
          createdAt: { type: 'integer' },
          updatedAt: { type: 'integer' },
          cardCount: { type: 'integer', description: 'Total cards; present on the list endpoint only.' },
        },
      },
      Column: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          projectId: { type: 'string' },
          name: { type: 'string' },
          color: { type: ['string', 'null'] },
          position: { type: 'number' },
          role: {
            type: ['string', 'null'],
            enum: ['ready', 'in_progress', 'review', 'done', 'blocked', null],
            description: 'Semantic role (v0.15.0), or null for a neutral column. Unique within a project.',
          },
          createdAt: { type: 'integer' },
        },
      },
      Card: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          projectId: { type: 'string' },
          columnId: { type: 'string' },
          key: { type: ['string', 'null'], description: 'Human ticket key, e.g. "OBL-1" (project code + "-" + seq).' },
          seq: { type: ['integer', 'null'], description: 'Per-project sequence number behind the key.' },
          summary: { type: 'string', description: 'Descriptive text (was `title` before v0.7.0).' },
          description: { type: ['string', 'null'] },
          acceptanceCriteria: { type: ['string', 'null'] },
          color: { type: ['string', 'null'] },
          position: { type: 'number' },
          assigneeUserId: { type: ['string', 'null'] },
          createdBy: { type: 'string' },
          updatedBy: { type: 'string' },
          createdAt: { type: 'integer' },
          updatedAt: { type: 'integer' },
        },
      },
      CardEvent: {
        type: 'object',
        description:
          'A timeline entry: an auto-emitted system event or a user comment. ' +
          'System events (created/moved/assigned/edited) are the durable ' +
          'who-did-what-when history; comments are a note or a structured handoff.',
        properties: {
          id: { type: 'string' },
          cardId: { type: 'string' },
          authorUserId: { type: ['string', 'null'] },
          kind: { type: 'string', enum: ['system', 'note', 'handoff'] },
          eventType: { type: ['string', 'null'], enum: ['created', 'moved', 'assigned', 'edited', null] },
          body: { type: ['string', 'null'], description: 'Null for system events and redacted comments.' },
          meta: { type: ['object', 'null'] },
          createdAt: { type: 'integer' },
          deletedAt: { type: ['integer', 'null'], description: 'Redaction tombstone: when the comment was soft-deleted (null = live).' },
          deletedBy: { type: ['string', 'null'], description: 'Who redacted the comment.' },
        },
      },
      Agent: {
        type: 'object',
        description:
          'An agent user (kind=agent) managed by an admin. It has an OWNER (the ' +
          'managing human) and its own API keys, so its work is attributed to it.',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          handle: { type: ['string', 'null'] },
          ownerUserId: { type: ['string', 'null'], description: 'The managing human.' },
          ownerName: { type: ['string', 'null'] },
          projectIds: { type: 'array', items: { type: 'string' } },
          tokenCount: { type: 'integer', description: 'Count of live (non-revoked) API keys.' },
          createdAt: { type: 'integer' },
        },
      },
      Mention: {
        type: 'object',
        description:
          'A place the caller is @-mentioned. A mention is a live projection of ' +
          'the text: editing the handle out retracts it. `excerpt` is the current ' +
          'field/comment text, derived at read time.',
        properties: {
          id: { type: 'string' },
          cardId: { type: 'string' },
          cardKey: { type: ['string', 'null'], description: 'e.g. "OBL-2".' },
          cardSummary: { type: 'string' },
          projectId: { type: 'string' },
          projectCode: { type: ['string', 'null'] },
          projectName: { type: 'string' },
          source: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['summary', 'description', 'acceptance_criteria', 'comment'] },
              commentId: { type: ['string', 'null'], description: 'Set only for `comment` sources.' },
            },
          },
          excerpt: { type: 'string', description: 'Live text of the field/comment holding the mention.' },
          authorUserId: { type: 'string', description: 'Who wrote the mention.' },
          createdAt: { type: 'integer' },
          readAt: { type: ['integer', 'null'], description: 'Null = unread.' },
        },
      },
    },
  },
  paths: {
    '/api/v1/auth/register': {
      post: {
        summary: 'Self-register: create a tenant + owner user, and log in',
        description:
          'Public. Creates a new tenant, its owner (admin) user, and a starter ' +
          'agent user, then sets the session cookie. Returns { user, tenant }.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name', 'tenantName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                  tenantName: { type: 'string', description: 'Workspace name.' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'created + logged in' }, 409: { description: 'email in use' } },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Log in with email + password (sets session cookie)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'ok' }, 401: { description: 'invalid credentials' } },
      },
    },
    '/api/v1/auth/logout': {
      post: { summary: 'Clear the session cookie', security: [], responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        summary: 'Request a password-reset email (always 200 — no enumeration)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } },
            },
          },
        },
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        summary: 'Consume a reset token and set a new password',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } },
              },
            },
          },
        },
        responses: { 200: { description: 'ok' }, 400: { description: 'invalid or expired token' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        summary: 'The signed-in user + active tenant + role (token or cookie)',
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/auth/accept-invite': {
      post: {
        summary: 'Accept a team invite (public) — creates/attaches the user and logs in',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: {
                  token: { type: 'string' },
                  name: { type: 'string', description: 'Required for a brand-new user.' },
                  password: { type: 'string', minLength: 8, description: 'Required for a brand-new user.' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'ok' }, 400: { description: 'invalid/expired/used' } },
      },
    },
    '/api/v1/team': {
      get: { summary: 'Team members + their project access + pending invites (admin)', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/team/invites': {
      post: {
        summary: 'Invite someone by email (admin) — emails an accept link',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'role'],
                properties: { email: { type: 'string' }, role: { type: 'string', enum: ['admin', 'member'] } },
              },
            },
          },
        },
        responses: { 201: { description: 'invited' }, 409: { description: 'already a member' } },
      },
    },
    '/api/v1/team/invites/{id}': {
      delete: { summary: 'Revoke a pending invite (admin)', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/team/members/{userId}': {
      patch: {
        summary: "Change a member's role (admin) — can't demote the last admin",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['admin', 'member'] } } },
            },
          },
        },
        responses: { 200: { description: 'ok' }, 409: { description: 'last admin' } },
      },
      delete: { summary: "Remove a member (admin) — can't remove the last admin", responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/team/members/{userId}/projects': {
      put: {
        summary: "Replace a member's project-access set (admin)",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['projectIds'], properties: { projectIds: { type: 'array', items: { type: 'string' } } } },
            },
          },
        },
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/agents': {
      get: { summary: 'List agent users — with owner, project access, key count (admin)', responses: { 200: { description: 'ok' } } },
      post: {
        summary: 'Create an agent user (admin) — kind=agent, owned by the caller',
        description:
          'Creates an agent user with a membership (role member) and optional ' +
          'project access. Mint keys for it via /agents/{userId}/tokens; its work ' +
          'is then attributed to the agent, not to you.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  projectIds: { type: 'array', items: { type: 'string' }, description: 'Projects to grant up front.' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'created' } },
      },
    },
    '/api/v1/agents/{userId}': {
      patch: {
        summary: 'Rename an agent and/or reassign its owner (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Provide name and/or ownerUserId.',
                properties: {
                  name: { type: 'string' },
                  ownerUserId: { type: 'string', description: 'Must be a member of the workspace.' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'ok' }, 400: { description: 'invalid owner' }, 404: { description: 'not an agent' } },
      },
      delete: {
        summary: 'Deactivate an agent (admin) — revoke keys, drop access; keep the user row',
        description: 'Revokes all the agent\'s tokens and removes its membership + project access. The users row is kept so cards it created keep its name.',
        responses: { 200: { description: 'ok' }, 404: { description: 'not an agent' } },
      },
    },
    '/api/v1/agents/{userId}/tokens': {
      get: { summary: 'List an agent\'s API keys (admin)', responses: { 200: { description: 'ok' } } },
      post: {
        summary: 'Mint an API key for an agent (admin) — returns the plaintext secret ONCE',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['label'], properties: { label: { type: 'string' } } },
            },
          },
        },
        responses: { 201: { description: 'created' } },
      },
    },
    '/api/v1/agents/{userId}/tokens/{tokenId}': {
      delete: { summary: 'Revoke an agent\'s API key (admin)', responses: { 200: { description: 'ok' }, 404: { description: 'not found' } } },
    },
    '/api/v1/me/tokens': {
      get: { summary: 'List your API tokens (never the secret)', responses: { 200: { description: 'ok' } } },
      post: {
        summary: 'Mint an API token — returns the plaintext secret ONCE',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['label'], properties: { label: { type: 'string' } } },
            },
          },
        },
        responses: { 201: { description: 'created' } },
      },
    },
    '/api/v1/me/tokens/{id}': {
      delete: { summary: 'Revoke one of your API tokens', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/me': {
      get: { summary: 'Whoami for the current token', responses: { 200: { description: 'ok' } } },
      patch: {
        summary: 'Set your own color and/or profile (token is tied to a user)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  color: { type: 'string', description: '#rrggbb hex' },
                  profile: { type: ['string', 'null'], description: 'Free-text persona/role (KBR-21)' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/users': {
      get: {
        summary: 'List current tenant members (assignee/mention pickers)',
        description: 'Only current members (a removed user is excluded). Optional `projectId` scopes to users who can access that project.',
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' }, description: 'Scope to users with access to this project.' },
        ],
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/me/mentions': {
      get: {
        summary: 'List your @-mentions (unread by default). Side-effect-free.',
        description:
          'Every place you are @-mentioned, tenant-wide, unread first. Listing ' +
          'never marks anything read — acknowledge explicitly via ' +
          'POST /me/mentions/read. Intended agent loop: list → act on each card → ack.',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['unread', 'read', 'all'] } },
        ],
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/me/queue': {
      get: {
        summary: 'Your actionable queue — cards assigned to you in a `ready`-role column',
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' }, description: 'Narrow to one project.' },
        ],
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/me/mentions/read': {
      post: {
        summary: 'Acknowledge (mark read) your mentions',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Provide mentionIds or all:true.',
                properties: {
                  mentionIds: { type: 'array', items: { type: 'string' } },
                  all: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/webhooks': {
      get: { summary: 'List webhook subscriptions (admin)', responses: { 200: { description: 'ok' } } },
      post: { summary: 'Create a webhook subscription (admin) — returns the signing secret once', responses: { 201: { description: 'created' } } },
    },
    '/api/v1/webhooks/{id}': {
      patch: { summary: 'Edit a webhook subscription (admin)', responses: { 200: { description: 'ok' } } },
      delete: { summary: 'Delete a webhook subscription (admin)', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/projects': {
      get: {
        summary: 'List projects',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'archived'] } },
        ],
        responses: { 200: { description: 'ok' } },
      },
      post: {
        summary: 'Create a project (seeds default columns)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code'],
                properties: {
                  name: { type: 'string' },
                  code: { type: 'string', description: 'Ticket-key prefix, 2–6 alphanumerics (uppercased), unique per tenant.' },
                  description: { type: ['string', 'null'] },
                  color: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'created' } },
      },
    },
    '/api/v1/projects/{id}': {
      get: { summary: 'Get a project + its columns', responses: { 200: { description: 'ok' } } },
      patch: { summary: 'Update / archive a project', responses: { 200: { description: 'ok' } } },
      delete: { summary: 'Delete a project (cascades) — admin-only', responses: { 200: { description: 'ok' }, 403: { description: 'not an admin' } } },
    },
    '/api/v1/projects/{id}/columns': {
      get: { summary: 'List a project\'s columns', responses: { 200: { description: 'ok' } } },
      post: { summary: 'Add a column', responses: { 201: { description: 'created' } } },
    },
    '/api/v1/columns/{id}': {
      patch: { summary: 'Rename / recolor / reorder / set the role of a column', responses: { 200: { description: 'ok' } } },
      delete: { summary: 'Delete an empty column', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/projects/{id}/cards': {
      get: {
        summary: 'List cards in a project',
        parameters: [
          { name: 'column', in: 'query', schema: { type: 'string' } },
          { name: 'assignee', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'ok' } },
      },
      post: { summary: 'Create a card', responses: { 201: { description: 'created' } } },
    },
    '/api/v1/cards/{id}': {
      get: { summary: 'Get a card', responses: { 200: { description: 'ok' } } },
      patch: {
        summary: 'Edit and/or move a card (columnId + position)',
        responses: { 200: { description: 'ok' } },
      },
      delete: { summary: 'Delete a card', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/cards/{id}/timeline': {
      get: {
        summary: 'Card timeline — system events + comments, chronological',
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/cards/{id}/comments': {
      post: {
        summary: 'Post a note or handoff to the card timeline',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: {
                  type: { type: 'string', enum: ['note', 'handoff'], default: 'note' },
                  body: { type: 'string' },
                  meta: {
                    type: 'object',
                    description: 'Handoff slots (ignored for a note).',
                    properties: {
                      summary: { type: 'string' },
                      evidence: { type: 'array', items: { type: 'string' } },
                      verify: { type: 'array', items: { type: 'string' } },
                      spunOff: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'created' } },
      },
    },
    '/api/v1/cards/{id}/comments/{commentId}': {
      delete: {
        summary: 'Redact (soft-delete) a comment — author-only',
        description:
          'Redacts a comment\'s content (leaked secret / PII / wrong card), leaving ' +
          'a tombstone in place. Author-only (403 otherwise); system events cannot ' +
          'be redacted (400); idempotent. The comment\'s @-mentions are retracted.',
        responses: { 200: { description: 'redacted' } },
      },
    },
  },
} as const;

/** GET /api/openapi.json — public. */
export function handleOpenApi(ctx: RouteContext): Response {
  return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
    status: 200,
    headers: { ...ctx.cors, 'content-type': 'application/json; charset=utf-8' },
  });
}
