# kbRelay v0.14.0 — Agent users, project General tab, team-modal fix

**Shipped:** 2026-07-01 · **Designs:** [`0-OVERVIEW.md`](./0-OVERVIEW.md) +
`1`/`2`/`3` in this folder · Backlog: KBR-1, KBR-3, KBR-4.

Three fixes from the kbRelay (KBR) backlog. One additive migration (`0012`); the
live `t_lala` tenant was backed up and verified intact end to end.

## KBR-3 — API keys for agents (first-class **agent users**)

The headline. Before, the API-keys panel minted tokens for **you**, so an agent
using your key filed cards stamped as *you*. Now an admin creates **agent users**
— real `users` with `kind='agent'` and an **owner** (the managing human) — grants
each project access, and mints keys **for the agent**. The agent acts as itself:
`created_by` / assignee / @-mentions all resolve to the agent.

- **Schema:** migration `0012_agent_users.sql` adds `users.owner_user_id`
  (nullable) + an index, and backfills owners for existing agent users (idempotent;
  on prod this made `u_claude` an agent owned by `u_leif`). No project/card/column
  data touched.
- **API (admin-only):** `GET/POST /api/v1/agents`,
  `PATCH/DELETE /api/v1/agents/:userId`, and
  `GET/POST/DELETE /api/v1/agents/:userId/tokens[/:tokenId]`. Members get `403`;
  a target that isn't an agent in the caller's tenant gets `404`. Project access
  reuses `PUT /team/members/:userId/projects`.
- **Deactivate, don't delete:** removing an agent revokes its keys and drops its
  membership + access but **keeps the user row**, so cards it authored keep its
  name (mirrors human `removeMember`).
- **Web:** **Team & access** is now tabbed — **People** and **Agents**. The Agents
  tab creates agents, manages each one's project access + API keys (one-time
  secret reveal), rename, and remove. The personal **API keys** modal stays, now
  pointing to Agents for agent identities.
- **Provenance seam unchanged:** the token→AuthContext path already stamps
  `auth.userId`; it just resolves to the agent now. Verified on prod: an agent's
  key created a project with `createdBy = <the agent>`.

## KBR-1 — Project settings: a **General** tab

Projects already carried `description` + `color` in the DB/API — there was just no
way to edit them. Added a **General** tab (name / description / color) to the
project-settings modal; saving reflects immediately in the switcher + board. The
`description` is the project's purpose, surfaced to agents via the API and MCP.
New MCP tool **`update_project`** rounds out create→read→update. No migration.

## KBR-4 — Team & access modal layout

Root cause: `.dialog-card.wide` only raised `max-width`, so the modal stayed
440px; and each member row crammed identity + role select + buttons into one
un-wrapping flex row. Fixed: the wide modal is genuinely wide (680px), and rows
split into an identity block + a right-aligned actions cluster that wraps — on
mobile the actions stack full-width. Applies to both People and Agents tabs.

## MCP — `@alacrity-ai/kbrelaymcp@0.2.0`

Added the **`update_project`** tool (16 tools total). README notes that a key
minted for an **agent user** attributes the MCP's work to the agent. Published to
npm (`0.2.0`).

## Tests & gates

- **149 unit tests** green (shared 47, mcp 12, api 90 incl. the new
  `agents.test.ts`: create/list/owner/keys, `assertAgentInTenant` guards, rename +
  owner reassign, deactivate keeps the user row, and an **agent key → agent
  identity** auth-path check). Typecheck (4 workspaces), lint, boundary guards,
  OpenAPI↔router parity, and the web build all pass.

## Prod verification

Backup `kbrelay-pre0012.sql` → apply `0012` → invariants unchanged
(**7 projects / 41 cards / 3 users / 1 agent / 3 memberships / 20 access rows**,
`u_claude` now owned by Leif) → deploy Worker (version `a07a3745`) + Pages →
end-to-end smoke (create agent → mint key → agent-attributed create → `update_project`
sets description/color → member `403` → deactivate revokes key `401`) → cleanup →
back to exact baseline.

## Follow-ups (KBR-5 / KBR-6 / KBR-7)

Landed after the initial v0.14.0 cut, same version line:

- **KBR-5 — MCP end-to-end test.** Verified all 16 MCP tools against prod via the
  published package (project `MCPT` left in place for inspection). No code.
- **KBR-6 — Project browsing.** As tenants grow past a handful of projects: the
  switcher now shows an inline **quick-filter** + the top **8** most-recently-viewed
  projects (recency in `localStorage`) + **Browse projects…** + New. A **Browse
  Projects** modal lists every project (filterable, recency-ordered) with a
  **ticket-count badge** per row (the projects **list endpoint now returns
  `cardCount`** via a correlated subquery — also surfaced through MCP
  `list_projects`), select→OK to switch, and an **admin-only delete** with a
  type-the-exact-name confirm. Project **DELETE is now admin-gated** server-side
  (`requireAdmin` → 403). No migration.
- **KBR-7 — In-app MCP guide.** A “?” badge by the agent-key blurbs (Agents tab +
  API-keys modal) opens a KISS **Connect the kbRelay MCP** modal: a copyable
  `claude mcp add …` command (base URL = current origin, so it's correct for
  self-host too) + a 3-step walkthrough.
- **MCP** bumped to **`0.3.1`** (`list_projects` documents `cardCount`; also fixed
  the server's advertised `serverInfo.version`, which was hardcoded to `0.1.0` —
  it now derives from `package.json` so it can't drift).

Prod-verified: `cardCount` returns per project over MCP; member-with-access DELETE
→ 403, admin DELETE → 200.

## Out of scope (deferred)

Hard-delete of agent users; per-key scopes/expiry/usage; agents creating agents
over MCP; project theming beyond one accent color.
