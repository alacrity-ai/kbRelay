import type { RouteContext } from './router';
import { API_DESCRIPTION } from './openapi-description';
import { buildEnrichedSpec } from './openapi-tags';

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
    // Rich Markdown landing page (KBR-109) — rendered by Scalar at the top of
    // /docs and carried in the public spec. See openapi-description.ts.
    description: API_DESCRIPTION,
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
          reviewerUserId: {
            type: ['string', 'null'],
            description: 'Who a review-lane card is waiting on (v0.17.0). Set on handback; a pointer, not an approval workflow.',
          },
          dueAt: {
            type: ['integer', 'null'],
            description: 'Optional deadline, epoch ms (v0.17.0). Null = no due date. No reminders — a display + ordering signal only.',
          },
          archivedAt: {
            type: ['integer', 'null'],
            description: 'When the card was archived (v0.17.0). Null = on the board. Archive via PATCH {archived: true|false}; timeline/attachments/mentions survive. Both directions are admin-only (KBR-101).',
          },
          createdBy: { type: 'string' },
          updatedBy: { type: 'string' },
          createdAt: { type: 'integer' },
          updatedAt: { type: 'integer' },
          attachments: {
            type: 'array',
            description: 'All attachments on the card (v0.16.0). Present on single-card GET only.',
            items: { $ref: '#/components/schemas/Attachment' },
          },
          attachmentCounts: {
            $ref: '#/components/schemas/AttachmentCounts',
            description: 'Per-kind attachment counts (v0.16.0). Present on the board list endpoint.',
          },
          links: {
            type: 'array',
            description: 'External links on the card (Jira/GitHub URLs, etc.). Present on single-card GET only.',
            items: { $ref: '#/components/schemas/CardLink' },
          },
          linkCount: {
            type: 'integer',
            description: 'Number of external links on the card. Present on the board list endpoint.',
          },
          taskCounts: {
            type: 'object',
            description:
              'GFM task-list progress across description + acceptanceCriteria (v0.17.0). ' +
              'Present on the board list endpoint when the card has any task items.',
            properties: { done: { type: 'integer' }, total: { type: 'integer' } },
          },
          labels: {
            type: 'array',
            description:
              'The card\'s labels (v0.17.0, KBR-62) — set via PATCH with labelIds ' +
              '(web) or labelNames (agents; resolved case-insensitively, 400 on unknown). ' +
              'Present on list, single GET, and queue payloads.',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' } },
            },
          },
        },
      },
      Label: {
        type: 'object',
        description:
          'A per-project label (v0.17.0, KBR-62): flat, capped at 12 per project, ' +
          'unique name (case-insensitive). A palette, not a taxonomy — no nesting, ' +
          'no descriptions, no rules.',
        properties: {
          id: { type: 'string' },
          projectId: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string' },
          createdAt: { type: 'integer' },
        },
      },
      ProjectLabel: {
        type: 'object',
        description:
          'A tenant-scoped project label (KBR-84): a bucket a project can carry ' +
          'several of ("Side gigs", "Day Job"). Unlike card labels these span the ' +
          'whole tenant. Flat, capped per tenant, unique name (case-insensitive). ' +
          'Embedded on project payloads as `labels[]`.',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string' },
          createdAt: { type: 'integer' },
        },
      },
      Attachment: {
        type: 'object',
        description:
          'A file attached to a card (v0.16.0). Hung off the card description ' +
          '(eventId null) or a specific note/handoff (eventId set). Bytes are ' +
          'streamed from `url` (same-origin; append ?download=1 to force download).',
        properties: {
          id: { type: 'string' },
          cardId: { type: 'string' },
          eventId: { type: ['string', 'null'], description: 'Null = on the description; set = on that timeline comment.' },
          filename: { type: 'string' },
          contentType: { type: 'string' },
          sizeBytes: { type: 'integer' },
          kind: { type: 'string', enum: ['image', 'document', 'archive', 'misc'] },
          createdBy: { type: 'string' },
          createdAt: { type: 'integer' },
          url: { type: 'string', description: 'Same-origin bytes URL, e.g. /api/v1/attachments/{id}/blob.' },
        },
      },
      AttachmentCounts: {
        type: 'object',
        description: 'Per-kind attachment counts for a card (v0.16.0 board badges).',
        properties: {
          image: { type: 'integer' },
          document: { type: 'integer' },
          archive: { type: 'integer' },
          misc: { type: 'integer' },
        },
      },
      CardLink: {
        type: 'object',
        description:
          'An external reference on a card (Jira/GitHub URL, etc.). `provider` ' +
          'names the system, `externalKey` is that system\'s own id when known ' +
          '(so cards can be found by it), `url` is the thing to open.',
        properties: {
          id: { type: 'string' },
          cardId: { type: 'string' },
          provider: { type: 'string', description: 'The external system, e.g. "jira" | "github".' },
          externalKey: { type: ['string', 'null'], description: 'That system\'s own id, e.g. "OBL-1234". Null when unknown.' },
          url: { type: 'string' },
          title: { type: ['string', 'null'], description: 'Optional human label.' },
          createdBy: { type: 'string' },
          createdAt: { type: 'integer' },
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
          color: { type: ['string', 'null'], description: 'Explicit #rrggbb, or null → deterministic palette fallback (KBR-74).' },
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
    '/api/v1/auth/switch-tenant': {
      post: {
        summary: 'Switch the session to another workspace you belong to (v0.18.0, KBR-96)',
        description:
          'Cookie sessions only — a bearer key is single-tenant by design (mint one per workspace; ' +
          'API keys get 400). Re-issues the session cookie with the new tenant and remembers it as ' +
          'your last-active workspace, so the next login lands there. 404 when you have no membership.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tenantId'],
                properties: { tenantId: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'switched — body matches /auth/me for the new tenant' },
          400: { description: 'caller is on an API key, not a session' },
          404: { description: 'no membership in that workspace' },
        },
      },
    },
    '/api/v1/tenants': {
      post: {
        summary: 'Create a NEW workspace for the current user (v0.18.0, KBR-96)',
        description:
          'Tenant + admin membership + starter agent, mirroring register — the sanctioned path ' +
          'around register\'s 409 for an email that already exists. Cookie sessions are re-issued ' +
          'into the new workspace.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tenantName'],
                properties: { tenantName: { type: 'string', maxLength: 80 } },
              },
            },
          },
        },
        responses: { 201: { description: 'created — body matches /auth/me for the new tenant' } },
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
        summary: 'Your actionable queue — { work, review } (v0.17.0 shape)',
        description:
          'Two typed sections: `work` = cards assigned to you in a `ready`-role column ' +
          '(do these); `review` = cards where you are the reviewer in a `review`-role ' +
          'column (verify these). Both RBAC-scoped, due-soonest first (undated last), then newest-updated.',
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'string' }, description: 'Narrow to one project.' },
        ],
        responses: { 200: { description: 'ok' } },
      },
    },
    '/api/v1/me/memberships': {
      get: {
        summary: 'Every workspace you belong to (v0.18.0, KBR-96)',
        description: 'Oldest membership first: `{ memberships: [{ tenant: {id,name,slug}, role }] }`. Works for tokens and sessions.',
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
        summary: 'Create a project (seeds default columns) — admin-only (KBR-94)',
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
      patch: { summary: 'Update / archive a project — admin-only (KBR-94)', responses: { 200: { description: 'ok' } } },
      delete: { summary: 'Delete a project (cascades) — admin-only', responses: { 200: { description: 'ok' }, 403: { description: 'not an admin' } } },
    },
    '/api/v1/projects/{id}/columns': {
      get: { summary: 'List a project\'s columns', responses: { 200: { description: 'ok' } } },
      post: { summary: 'Add a column — admin-only (KBR-94)', responses: { 201: { description: 'created' } } },
    },
    '/api/v1/columns/{id}': {
      patch: { summary: 'Rename / recolor / reorder / set the role of a column — admin-only (KBR-94)', responses: { 200: { description: 'ok' } } },
      delete: { summary: 'Delete an empty column — admin-only (KBR-94)', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/projects/{id}/cards': {
      get: {
        summary: 'List cards in a project',
        parameters: [
          { name: 'column', in: 'query', schema: { type: 'string' } },
          { name: 'assignee', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'due', in: 'query', schema: { type: 'string', enum: ['overdue', 'soon'] }, description: 'Due-date filter: overdue, or due within 48h (KBR-63).' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['due'] }, description: 'due = due-soonest first, undated cards last.' },
          { name: 'archived', in: 'query', schema: { type: 'string', enum: ['1'] }, description: '1 = ONLY archived cards, newest-archived first (KBR-60). Default excludes archived.' },
          { name: 'label', in: 'query', schema: { type: 'string' }, description: 'Only cards carrying this label id (KBR-62).' },
        ],
        responses: { 200: { description: 'ok' } },
      },
      post: { summary: 'Create a card', responses: { 201: { description: 'created' } } },
    },
    '/api/v1/projects/{id}/labels': {
      get: { summary: 'List a project\'s labels (max 12)', responses: { 200: { description: 'ok' } } },
      post: {
        summary: 'Create a label (name + #rrggbb color) — admin-only (KBR-94)',
        description: 'Unique name per project (case-insensitive); capped at 12 labels per project — 409 over the cap or on a duplicate name.',
        responses: { 201: { description: 'created' }, 409: { description: 'cap reached or duplicate name' } },
      },
    },
    '/api/v1/labels/{id}': {
      patch: { summary: 'Rename / recolor a label — admin-only (KBR-94)', responses: { 200: { description: 'ok' } } },
      delete: { summary: 'Delete a label (unlinks it from all cards) — admin-only (KBR-94)', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/project-labels': {
      get: { summary: 'List the tenant\'s project labels (KBR-84)', responses: { 200: { description: 'ok' } } },
      post: {
        summary: 'Create a project label (name + #rrggbb color) — admin-only (KBR-94)',
        description: 'Tenant-scoped; unique name per tenant (case-insensitive); capped per tenant — 409 over the cap or on a duplicate name.',
        responses: { 201: { description: 'created' }, 409: { description: 'cap reached or duplicate name' } },
      },
    },
    '/api/v1/project-labels/{id}': {
      patch: { summary: 'Rename / recolor a project label — admin-only (KBR-94)', responses: { 200: { description: 'ok' } } },
      delete: { summary: 'Delete a project label (unlinks it from all projects) — admin-only (KBR-94)', responses: { 200: { description: 'ok' } } },
    },
    '/api/v1/projects/{id}/project-labels': {
      put: {
        summary: 'Replace a project\'s label set (KBR-84) — admin-only (KBR-94)',
        description: 'Body: `{ labelIds }` (web) or `{ labelNames }` (agents, case-insensitive). `{ labelIds: [] }` clears all. Returns the project\'s resulting labels.',
        responses: { 200: { description: 'ok' }, 400: { description: 'unknown label, or both id/name lists provided' } },
      },
    },
    '/api/v1/cards/{id}': {
      get: { summary: 'Get a card', responses: { 200: { description: 'ok' } } },
      patch: {
        summary: 'Edit and/or move a card (columnId + position)',
        description:
          'RBAC (KBR-101): content fields (summary, description, acceptanceCriteria, labelIds, dueAt) ' +
          'require being the card\'s creator or a tenant admin; `archived` (either direction) is admin-only. ' +
          'Workflow fields (columnId, position, assigneeUserId, reviewerUserId) are open to any member with access.',
        responses: { 200: { description: 'ok' }, 403: { description: 'content edit by non-creator, or archive by non-admin' } },
      },
      delete: { summary: 'Delete a card (cascades; admin-only since KBR-94)', responses: { 200: { description: 'ok' }, 403: { description: 'members cannot delete — archive instead' } } },
    },
    '/api/v1/search': {
      get: {
        summary: 'Global quick-find — cards by key/summary, projects by name/code',
        description:
          'Tenant-wide, RBAC-filtered to your accessible projects. Ranks an exact ' +
          'ticket key ("KBR-3") above key prefixes, then project name/code hits, ' +
          'then card-summary substrings. v1 does NOT search descriptions/comments. ' +
          '`q` min 2 chars (400 below); `limit` default 20, max 50.',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
        ],
        responses: { 200: { description: 'ok' }, 400: { description: 'q too short' } },
      },
    },
    '/api/v1/analytics': {
      get: {
        summary: 'Workspace analytics — totals, throughput, cycle time, leaderboards',
        description:
          'Read-only aggregates over the caller\'s accessible projects (members see ' +
          'granted projects only; admins the whole workspace). Returns window totals ' +
          '(created/completed/active/overdue/comments), a created-vs-completed ' +
          'throughput series (daily; weekly at 90d), cycle-time stats, contributor ' +
          'and reviewer leaderboards, and a per-project breakdown. ' +
          '`?days=` one of 7|30|90 (default 30; 400 otherwise). "Completed" = a card ' +
          'moved into the done-role column; completion credit goes to the card\'s ' +
          'assignee and review credit to its reviewer as they stood at that moment.',
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', enum: [7, 30, 90], default: 30 } }],
        responses: { 200: { description: 'ok' }, 400: { description: 'invalid days' } },
      },
    },
    '/api/v1/projects/{id}/analytics': {
      get: {
        summary: 'Project analytics — same aggregates scoped to one board',
        description:
          'The workspace payload minus the per-project breakdown, plus the live ' +
          'column distribution of non-archived cards. `?days=` one of 7|30|90 ' +
          '(default 30).',
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', enum: [7, 30, 90], default: 30 } }],
        responses: { 200: { description: 'ok' }, 400: { description: 'invalid days' } },
      },
    },
    '/api/v1/projects/{id}/events': {
      get: {
        summary: 'Project activity feed — newest-first card events across the board',
        description:
          'Paginated union of the project\'s card timelines (system events + comments), ' +
          'each enriched with cardKey + cardSummary. `?since=<unix ms>` lower-bounds, ' +
          '`?limit=` caps the page (default 50, max 200), `?cursor=` (from nextCursor) ' +
          'pages older. Redacted comments appear as tombstones. Use it to catch up on ' +
          '"what happened on this board" without opening cards one by one.',
        responses: { 200: { description: 'ok' } },
      },
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
                  attachmentIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Attachments (v0.16.0) uploaded for this comment; linked to it on post.',
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'created' } },
      },
    },
    '/api/v1/cards/{id}/attachments': {
      post: {
        summary: 'Upload a file attachment to a card (multipart)',
        description:
          'Upload one file (multipart/form-data, part name `file`, ≤25 MB). Stored ' +
          'card-scoped (on the description); link it to a note/handoff by passing ' +
          'its id in the comment\'s `attachmentIds`. 503 if storage is unconfigured.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: { description: 'created' },
          413: { description: 'file too large' },
          415: { description: 'not multipart/form-data' },
        },
      },
    },
    '/api/v1/attachments/{id}': {
      get: { summary: 'Get an attachment\'s metadata', responses: { 200: { description: 'ok' } } },
      delete: {
        summary: 'Delete an attachment (uploader or admin)',
        responses: { 200: { description: 'deleted' }, 403: { description: 'not uploader/admin' } },
      },
    },
    '/api/v1/attachments/{id}/blob': {
      get: {
        summary: 'Stream an attachment\'s bytes',
        description:
          'Streams the file. Images + PDFs are served inline; everything else as an ' +
          'attachment download. Append ?download=1 to force download. Same-origin ' +
          '(cookie/bearer authorizes it); nosniff + private cache.',
        parameters: [{ name: 'download', in: 'query', schema: { type: 'string', enum: ['1'] } }],
        responses: { 200: { description: 'ok' }, 404: { description: 'not found' } },
      },
    },
    '/api/v1/cards/{id}/links': {
      post: {
        summary: 'Add an external link to a card',
        description:
          'Attach an external reference (Jira/GitHub URL, etc.) to a card. `provider` ' +
          'and `url` are required; `externalKey` (that system\'s own id, so the card ' +
          'can be found by it) and `title` are optional.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['provider', 'url'],
                properties: {
                  provider: { type: 'string' },
                  url: { type: 'string' },
                  externalKey: { type: ['string', 'null'] },
                  title: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'created' }, 400: { description: 'validation failed' } },
      },
    },
    '/api/v1/card-links/{id}': {
      delete: {
        summary: 'Delete a card link (creator or admin)',
        responses: { 200: { description: 'deleted' }, 403: { description: 'not creator/admin' } },
      },
    },
    '/api/v1/projects/{id}/card-links': {
      get: {
        summary: 'Find cards in a project by an external link',
        description:
          'Return every card in the project carrying a link with the given ' +
          '`provider` + `externalKey` (both query params required). Each match ' +
          'carries the card id, key, summary, and the link.',
        parameters: [
          { name: 'provider', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'externalKey', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'ok' }, 400: { description: 'missing provider/externalKey' } },
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

/**
 * The served spec: the canonical contract above, enriched with sidebar `tags` +
 * `x-tagGroups` (KBR-109). Computed once — the tags are derived from paths, so
 * this never drifts from the route table. OPENAPI_SPEC stays the raw source of
 * truth the parity test reads.
 */
const ENRICHED_SPEC = buildEnrichedSpec(OPENAPI_SPEC);

/** GET /api/openapi.json — public. */
export function handleOpenApi(ctx: RouteContext): Response {
  return new Response(JSON.stringify(ENRICHED_SPEC, null, 2), {
    status: 200,
    headers: { ...ctx.cors, 'content-type': 'application/json; charset=utf-8' },
  });
}
