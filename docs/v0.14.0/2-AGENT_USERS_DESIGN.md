# KBR-3 — API keys for agents: first-class **agent users**

## The problem

The **API keys** modal mints tokens for the **caller's own** user
(`createToken(env, tenant, auth.userId, label)`). Hand that key to an agent and
every card it files is stamped `created_by = <the human>`. kbRelay's core
provenance signal — "was this a human or Claude?" — is lost. There is also no
way to have more than the single starter "Assistant" agent per tenant.

## The model

Introduce **agent users** (synthetic/virtual users): real `users` rows with
`kind='agent'` that an **admin** creates and manages. The distinguishing trait
is an **owner** (the managing human). An admin can create N of them
(`Claude`, `ChatGPT`, `openclaw`…), grant each Member access to chosen projects,
and mint one-or-more API keys **per agent**. Each agent runtime uses its own
key and acts **as that agent** — provenance, assignee, and @-mentions all
resolve to the agent. Only admins may create/manage agents.

## Why it's mostly additive

| Need | Already there |
|------|---------------|
| Tokens for an arbitrary user | `api_tokens.user_id` is arbitrary; `createToken/listTokens/revokeToken` are `(tenant,user)`-scoped |
| Agent identity | `users.kind='agent'`; registration already seeds one |
| Access + role | `memberships` + binary `project_access` work for any user id |
| Card provenance | already stamps `auth.userId` → becomes the agent automatically |
| Assignee / @-mention | `listUsers` returns all tenant users; `mentionableUsers` keys off membership + access |

The genuinely new parts: the **owner** column, an admin **CRUD + token** surface
for agents, and the **web** UI.

## Schema — migration `0012_agent_users.sql` (additive)

```sql
ALTER TABLE users ADD COLUMN owner_user_id TEXT;   -- managing human; NULL for humans/legacy
CREATE INDEX idx_users_owner ON users(owner_user_id);

-- Backfill: existing agent users that participate (have a membership) are owned
-- by their tenant's earliest admin, so they surface as managed agents. Fills
-- only NULLs (idempotent). No project/card/column data is read-modified.
UPDATE users
   SET owner_user_id = (
     SELECT m2.user_id FROM memberships m2
      WHERE m2.tenant_id = (SELECT m.tenant_id FROM memberships m WHERE m.user_id = users.id LIMIT 1)
        AND m2.role = 'admin'
      ORDER BY m2.created_at ASC LIMIT 1)
 WHERE kind = 'agent' AND owner_user_id IS NULL
   AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = users.id);
```

We store a plain `TEXT` (no `REFERENCES` clause) to avoid SQLite `ALTER TABLE`
FK pitfalls; D1 doesn't reliably enforce FKs anyway (same rationale as
`deleteProject`'s explicit cascade). On the live tenant this backfill makes
`u_claude` an agent owned by `u_leif` — new info only, nothing breaks.

`registerTenant` is updated to set the starter agent's `owner_user_id` to the
new owner.

## API — admin-gated `/agents` surface

New `apps/api/src/routes/agents.ts` + repo `apps/api/src/db/repos/agents.ts`.
Every handler `requireAdmin` (403 otherwise). Shared schemas in
`packages/shared/src/agents.ts`.

| Method & path | Body | Effect |
|---------------|------|--------|
| `GET /api/v1/agents` | — | List agent users: `{id,name,handle,ownerUserId,ownerName,projectIds,tokenCount,createdAt}` |
| `POST /api/v1/agents` | `{name, projectIds?}` | Create user(kind=agent, owner=caller, handle) + membership(member) + access grants — atomic batch |
| `PATCH /api/v1/agents/:userId` | `{name?, ownerUserId?}` | Rename / reassign owner |
| `DELETE /api/v1/agents/:userId` | — | **Deactivate**: revoke all its tokens + drop membership + project_access; **keep the user row** |
| `GET /api/v1/agents/:userId/tokens` | — | List that agent's live tokens |
| `POST /api/v1/agents/:userId/tokens` | `{label}` | Mint a key for the agent (secret shown once) |
| `DELETE /api/v1/agents/:userId/tokens/:tokenId` | — | Revoke |

- Token handlers reuse `listTokens/createToken/revokeToken` with the **target**
  agent's id after `assertAgentInTenant` (target must be `kind='agent'` with a
  membership in the caller's tenant → else 404).
- Project access reuses `PUT /team/members/:userId/projects`
  (`replaceMemberProjectAccess`) — works for any membership.
- **Deactivate, not delete:** mirrors human `removeMember` (keeps the user row so
  authored-card `created_by`/`updated_by` still resolve to a name; old
  @-mentions still resolve by handle). Hard delete is intentionally omitted.
- These routes are **not** project-scoped, so they carry no RBAC `access` scope;
  the router coverage test only requires scopes on project/card/column routes.

### Repo sketch (`agents.ts`)

- `listAgents(env, tenant)` — `users u JOIN memberships m` where `u.kind='agent'`,
  LEFT JOIN owner for `ownerName`, aggregate `project_access` ids +
  `api_tokens` (non-revoked) count.
- `createAgent(env, tenant, ownerId, name, projectIds)` — atomic batch: insert
  user (handle via `deriveHandle`+`uniqueHandle`), membership(member),
  `grantProjectAccessStmt` per valid project id.
- `assertAgentInTenant(env, tenant, userId)` — 404 guard reused by patch/remove/
  token handlers.
- `renameAgent` / `setAgentOwner`, `removeAgent` (revoke tokens + drop
  membership + access).

## Web — Team & access becomes tabbed (People / Agents)

Rework `TenantSettings.tsx` into two tabs (this is also where KBR-4's responsive
layout lands — one rewrite):

- **People** — humans only (`members.filter(kind==='human')`): invite, role,
  remove, per-member project checklist (existing behavior, cleaned-up layout).
- **Agents** — from `GET /agents`:
  - **Create agent** row: name input + Create.
  - Per agent: name + `@handle`, `agent` kind badge, **owner** label, a
    project-access checklist (reuse `ProjectAccessEditor` → `setMemberProjects`),
    a **Keys** expander (list/create/revoke with one-time secret reveal, reusing
    the API-keys UX), rename, and **Remove** (deactivate).

The account-menu **API keys** modal stays for a human's own keys, with a one-line
pointer: to give an agent its own identity, use **Team & access → Agents**.

New `apps/web/src/lib/api.ts` functions: `listAgents`, `createAgent`,
`patchAgent`, `removeAgent`, `listAgentTokens`, `createAgentToken`,
`revokeAgentToken`.

## MCP

No new tools — agent management is an admin/human surface. An agent's key already
resolves to the agent identity (`whoami` reflects it). (KBR-1 separately adds
`update_project`.)

## Provenance walk-through

Admin creates agent "Claude" → mints key `K` → hands `K` to the Claude runtime →
runtime calls `POST /projects/:id/cards` with `Authorization: Bearer K` →
`authenticate` resolves `K` → agent user → `created_by = <agent Claude>`. The
board shows the card in the agent's color, attributed to the agent. Correct.

## Security

- All `/agents` endpoints `requireAdmin`; members get 403.
- Target must be an agent user with a membership in the caller's tenant (404),
  so an admin can't manage another tenant's users or a human via this surface.
- Admins already see all projects, so granting agents project access is within
  their authority.

## Testing

- Repo/route unit tests: create→list (owner + projectIds + tokenCount),
  mint→list→revoke token for an agent, deactivate drops membership/access/tokens
  but keeps the user row, `assertAgentInTenant` 404s for a human / cross-tenant,
  non-admin → 403.
- Coverage test (`access.test.ts`) still passes (new routes aren't
  project-scoped).
- Prod smoke: create an agent, mint a key, create a card with it, verify
  `created_by` = the agent; confirm `t_lala` projects/cards unchanged and
  `u_claude` now owned by `u_leif`.

## Acceptance criteria

See the KBR-3 ticket. Key ones: agent-attributed provenance; admin-only;
`t_lala` intact; `u_claude` surfaces as an owned agent.

## Out of scope

Hard-delete of agents; per-key scopes/expiry/rate-limits/usage; agents creating
agents over MCP.
