/**
 * Sidebar grouping for the API reference (KBR-109 follow-up).
 *
 * The route table is flat, which made the rendered `/docs` a single long list.
 * Rather than hand-annotate ~65 operation literals in openapi.ts (and keep them
 * in sync forever), we derive each operation's **tag** from its path here and
 * inject `tags` + `x-tagGroups` into the served spec. Scalar renders tags as
 * collapsible sidebar sections and x-tagGroups as the super-sections above them.
 *
 * `tagForPath` is total over every documented path — a test asserts no path
 * falls through to the fallback, so adding a route surfaces here immediately.
 */

export interface TagDef {
  name: string;
  description: string;
}
export interface TagGroup {
  name: string;
  tags: string[];
}

/** The sidebar sections (order = render order within a group). */
export const TAGS: TagDef[] = [
  { name: 'Account & session', description: "Register, sign in, manage your profile and API keys, and control which workspace you're acting in." },
  { name: 'Mentions & queue', description: 'Your actionable queue and the @-mentions that notify you.' },
  { name: 'Team & access', description: 'Members, invitations, roles, and per-project access (admin).' },
  { name: 'Agents', description: 'Agent users and the API keys they act under (admin).' },
  { name: 'Projects', description: 'Boards — create, read, update, delete, plus each board’s activity feed.' },
  { name: 'Columns', description: 'The lanes on a board and their workflow roles (ready, in-progress, review, blocked, done).' },
  { name: 'Labels', description: 'Per-card labels and the tenant-wide project labels used to bucket boards.' },
  { name: 'Cards', description: 'The units of work that move across a board.' },
  { name: 'Comments & timeline', description: 'A card’s append-only history and the comments humans and agents relay on it.' },
  { name: 'Attachments', description: 'Files attached to a card, backed by object storage.' },
  { name: 'Card links', description: 'Typed external references (e.g. a Jira ticket) attached to a card.' },
  { name: 'Search & analytics', description: 'Cross-project quick-find and read-only board metrics.' },
  { name: 'Webhooks', description: 'Per-tenant subscriptions that POST card events to your endpoint.' },
];

/** The super-sections. Every tag above belongs to exactly one group. */
export const TAG_GROUPS: TagGroup[] = [
  { name: 'Accounts & access', tags: ['Account & session', 'Mentions & queue', 'Team & access', 'Agents'] },
  { name: 'Boards', tags: ['Projects', 'Columns', 'Labels'] },
  { name: 'Cards & activity', tags: ['Cards', 'Comments & timeline', 'Attachments', 'Card links'] },
  { name: 'Insights & integration', tags: ['Search & analytics', 'Webhooks'] },
];

/**
 * Map a documented path to its sidebar tag. Order matters: specific
 * sub-resources are matched before the generic `/cards` and `/projects`
 * buckets they nest under.
 */
export function tagForPath(path: string): string {
  const p = path;

  // Personal work surfaces (before the generic /me + /auth account bucket).
  if (p.startsWith('/api/v1/me/mentions') || p === '/api/v1/me/queue') return 'Mentions & queue';

  // Account, session, identity, and self-service keys.
  if (
    p.startsWith('/api/v1/auth/') ||
    p === '/api/v1/tenants' ||
    p === '/api/v1/me' ||
    p === '/api/v1/me/memberships' ||
    p.startsWith('/api/v1/me/tokens') ||
    p === '/api/v1/users'
  ) return 'Account & session';

  if (p.startsWith('/api/v1/team')) return 'Team & access';
  if (p.startsWith('/api/v1/agents')) return 'Agents';
  if (p.startsWith('/api/v1/webhooks')) return 'Webhooks';
  if (p === '/api/v1/search' || p === '/api/v1/analytics' || p.endsWith('/analytics')) return 'Search & analytics';

  // Card sub-resources (before the generic /cards + /projects buckets).
  if (p.endsWith('/timeline') || p.includes('/comments')) return 'Comments & timeline';
  if (p.includes('/attachments')) return 'Attachments';
  if (p.includes('card-links') || p.endsWith('/links')) return 'Card links';

  // Board sub-resources.
  if (p.includes('label')) return 'Labels';
  if (p.includes('/columns')) return 'Columns';

  // Cards (bare card + a project's cards).
  if (p.includes('/cards')) return 'Cards';

  // Projects (CRUD + events) — the catch-all for the remaining /projects paths.
  if (p.startsWith('/api/v1/projects')) return 'Projects';

  return 'Account & session'; // Unreachable for known paths (asserted by a test).
}

interface Operation {
  tags?: string[];
  [k: string]: unknown;
}
export interface EnrichableSpec {
  paths: Record<string, Record<string, Operation>>;
  tags?: TagDef[];
  'x-tagGroups'?: TagGroup[];
  [k: string]: unknown;
}

/**
 * Return a deep copy of `base` with `tags` + `x-tagGroups` added and every
 * operation tagged. The input (the canonical OPENAPI_SPEC) is left untouched so
 * the router↔spec parity test keeps reading the raw contract.
 */
export function buildEnrichedSpec(base: unknown): EnrichableSpec {
  const spec = JSON.parse(JSON.stringify(base)) as EnrichableSpec;
  spec.tags = TAGS;
  spec['x-tagGroups'] = TAG_GROUPS;
  for (const [path, ops] of Object.entries(spec.paths)) {
    const tag = tagForPath(path);
    for (const method of Object.keys(ops)) {
      ops[method].tags = [tag];
    }
  }
  return spec;
}
