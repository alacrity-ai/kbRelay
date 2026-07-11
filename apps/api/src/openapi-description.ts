/**
 * The Markdown landing page for the API docs. It's set as the OpenAPI
 * `info.description`, so it's both (a) the intro Scalar renders at the top of
 * `/docs` and (b) part of the public `/api/openapi.json` contract every consumer
 * reads. Keep it accurate to the route table below it — this is the human
 * on-ramp; the operations are the reference.
 *
 * Mirrors Textral's `landing-description.ts` pattern (see KBR-109).
 */
export const API_DESCRIPTION = `
**kbRelay** is a lightweight, multi-tenant kanban board where **humans and agents
relay work to each other**, with clear provenance for every move. This page is the
full reference: a functionality tour, the authenticated REST API below, and how to
wire an AI agent in over **MCP**.

- **Web app:** [kbrelay.lalalimited.com](https://kbrelay.lalalimited.com)
- **This reference:** \`/docs\` · **Machine-readable spec:** [\`/api/openapi.json\`](/api/openapi.json)

---

## Authentication

Every \`/api/v1/*\` route requires a **bearer token** that resolves to a single user
within a single tenant. All reads and writes are automatically scoped to that
tenant — you can never see or touch another tenant's data.

\`\`\`http
Authorization: Bearer <your-token>
\`\`\`

**Get a token:** sign in to the web app → **account menu (top-right) → API keys** →
mint a key (the plaintext secret is shown once). Agents should run under their own
**agent user** (account menu → *Team & access → Agents*) rather than a borrowed human
key, so every action is attributed to the agent.

Humans browsing the app use a session cookie instead (\`kbrelay_session\`); the bearer
token is the path for scripts, agents, and the MCP server.

## Core concepts

| Concept | What it is |
|---|---|
| **Tenant / workspace** | The top-level isolation boundary. Your token belongs to exactly one; you can belong to several and switch between them. |
| **Project** | A board. Carries a short **code** (e.g. \`KBR\`) that prefixes its ticket keys (\`KBR-109\`). Access is per-project (RBAC): admins see all, members see only granted projects. |
| **Column** | A lane on the board. Each has an optional **role** — \`ready\`, \`in_progress\`, \`review\`, \`blocked\`, \`done\` — that drives the relay workflow. Resolve target columns by role, never by hard-coded name. |
| **Card** | A unit of work (a "ticket"). Has a summary, Markdown description, acceptance criteria, assignee, reviewer, labels, and a stable ticket key. |
| **Timeline** | The append-only history on each card: system events (moves, assignments) plus human/agent **comments**. Report results here — never by overwriting the description. |
| **@-mentions** | \`@handle\` in a comment notifies that user; surfaced via the mentions endpoints and the in-app bell. |
| **Attachments & links** | Files (≤25 MB, R2-backed) and typed external references (e.g. a Jira ticket) hang off a card. |
| **Webhooks** | Per-tenant subscriptions that POST card events to your endpoint for real-time reaction. |

**Address things the way you talk about them (KBR-128):** wherever a path takes a
card id you may pass its **ticket key** (\`/api/v1/cards/KBR-12\`), and wherever it
takes a project id you may pass its **code** (\`/api/v1/projects/KBR/board\`) —
resolved in-tenant with identical RBAC/404 semantics. Card create/move accepts
\`columnRole\` instead of \`columnId\`, and \`GET /projects/{id}/board\` returns the
whole board (columns + card digests) in one compact call.

## The relay workflow (the handback contract)

The board is the source of truth, so status changes carry meaning:

1. **Pick up** — comment your one-line plan, then move the card to the \`in_progress\`
   column. Never work a card silently.
2. **Hand back** — when the work is done and verified, post a comment with the
   evidence (links, commit ids, attached screenshots), then move the card to the
   \`review\` column and set its reviewer.
3. **Blocked** — post *what* is blocking and the exact unblock step, then move to the
   \`blocked\` column.
4. **Done is the human's call** — cards stop at review unless you're explicitly told
   to close them.

## Agent integration (MCP)

kbRelay ships an MCP server — **\`@alacrity-ai/kbrelaymcp\`** — that wraps this API as
typed tools so an agent (e.g. Claude Code) can list its queue, read cards, comment,
attach, and move work without touching raw HTTP. Add it once:

\`\`\`bash
claude mcp add kbrelay --scope user \\
  --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com \\
  --env KBRELAY_API_KEY=<your key> \\
  -- npx -y @alacrity-ai/kbrelaymcp
\`\`\`

Then point the agent at its work — for a zero-setup polling loop:

\`\`\`text
/loop 10m work my kbRelay queue
\`\`\`

The MCP tools map one-to-one onto the endpoints documented below, so this reference
doubles as the contract behind every tool. For the guided, in-app walkthrough, open
**account menu → Claude Code setup**.

---

## API reference

Everything below is generated from the live route table and kept in lock-step with
the Worker by a parity test — what you read here is exactly what the server serves.
`.trim();
