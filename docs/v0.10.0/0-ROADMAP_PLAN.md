# kbRelay — v0.10.0 Roadmap Plan: Self-Register → Team/RBAC → Self-Host → MCP

**Date:** 2026-07-01
**Status:** Roadmap (pre-design). Approve this, then each item gets its own design doc.
**Grounded in:** houseops (`/home/leif/lets-get-rich/home-app`), textral
(`/home/leif/textral/TEXTRAL_REFACTOR_WIP`) — researched, cited below.

---

## 0. Where kbRelay is today (the starting point)

- **Runtime:** one Cloudflare Worker (`apps/api`), a hand-rolled router (`router.ts`
  route table + `index.ts` dispatcher) — **not Hono**. Repos call **D1 directly**
  (`env.DB.prepare(sql).bind(...).first()/all()/run()`, `env.DB.batch([...])`) with
  `?`-placeholder **SQLite** SQL.
- **Auth:** **bearer API tokens only** — `api_tokens` stores a sha256 hash, joined to
  `users`; `authenticate.ts` resolves a token → `AuthContext {tenantId, userId,…}`.
  No passwords, no sessions, no human login. Tenancy is a single `tenant_id` column
  on every row; `tenants → users (human|agent) → api_tokens`. **No per-project
  access control — every member sees every project.**
- **Frontend:** Vite/React SPA on Pages, same-origin `/api`. Sign-in = paste a token.
- **DB:** D1 `kbrelay` (prod) / `kbrelay-dev`. Migrations `apps/api/migrations/*.sql`.

Two structural facts shape everything below: (1) the **API-token auth is perfect for
agents/MCP** and we keep it; (2) the SQL is **plain SQLite**, which makes the
self-host split much cheaper than textral's (see Item 3).

---

## 1. The four items (grounded)

The original three items grew a fourth: **basic RBAC**. Once a tenant can hold
multiple people, "who can see / edit which project" is what makes it genuinely
useful — and it's the same admin action, in the same Tenant Settings modal, as
inviting and removing people. So team management + RBAC are one item (Item 2),
inserted between self-registration and the self-host split.

### Item 1 — Self-registration & sessions  → **v0.10.0**

**Goal.** A stranger can sign up at kbrelay.lalalimited.com, which creates their
tenant + owner user and logs them in; plus forgot/reset password and self-service
API keys. A working **solo** tenant. (Inviting teammates and access control come in
Item 2 — but the schema is laid here so Item 2 is purely additive.)

**Grounded approach — copy houseops's auth, in kbRelay's own style.** houseops
(`apps/api/src/routes/auth.ts`, `db/repos/auth.ts`, `lib/{password,jwt,cookies}.ts`,
`services/mailgun.ts`, `email/templates.ts`) is a complete, proven reference:
- **Passwords:** PBKDF2-HMAC-SHA-256 via Web Crypto (no library), stored as
  `pbkdf2-sha256$iters$salt$hash`. Copy `lib/password.ts` almost verbatim.
- **Human sessions:** stateless **HS256 JWT in an HttpOnly `kbrelay_session` cookie**
  (`{uid, tid, iat, exp}`), signed with `JWT_SECRET`. Copy `lib/{jwt,cookies}.ts`.
- **Mailgun:** single `sendMailgun(env,msg)` fetch; **graceful no-op when
  `MAILGUN_API_KEY` is unset** (so local/self-host needs no inbox). Copy
  `services/mailgun.ts` + `email/templates.ts` (welcome / reset).
- **Reset:** `password_reset_tokens` (store only sha256 of the token, 1h TTL,
  single-use), link `${PUBLIC_BASE_URL}/auth/reset/<token>`.

**Membership + role foundation (laid now, exercised in Item 2).** Adopt houseops's
**membership model** so tenancy is right from the start: users global + unique email;
**`memberships(tenant_id, user_id, role)`**; register creates tenant + user +
**owner/admin** membership; the JWT carries the active tenant. Roles live on the
membership (per-tenant), not the user. Item 1 only *stamps* the owner as admin; the
invite/role UI is Item 2.

**Two auth modes coexist.** The dispatcher tries **bearer token first** (agents,
unchanged), then the **session cookie** (humans). Both yield the same `AuthContext`.

**Self-service API keys (load-bearing for Item 4).** Today tokens are only minted by
a server-side script. A human must be able to **create / revoke their own API tokens
from the web UI** (name, shown-once plaintext) to paste into `claude mcp add`. Small
addition, hard dependency of the MCP item — lands here.

**Key decisions for `1-TENANT_SELF_REGISTER_DESIGN.md`:** membership-model migration
of the existing seeded tenant (`t_lala` users → owner memberships); email
verification (houseops stubs it — *recommend* active-immediately for v1, keep the
column); how an admin creates an **agent user** (e.g. "Claude") + its token in a new
tenant; **register atomicity** (wrap the multi-insert in `env.DB.batch` — houseops
doesn't, and risks partial tenants).

**Blast radius:** new `routes/auth.ts`, `db/repos/auth.ts`, `lib/{password,jwt,
cookies}.ts`, `services/mailgun.ts`, `email/templates.ts`; migration (auth columns on
`users`, new `memberships` + `password_reset_tokens`, backfill seeded users);
dispatcher cookie fallback; web pages (Register/SignIn/Forgot/Reset) + an **API-keys**
settings panel; `env.ts` (+`JWT_SECRET`, `MAILGUN_*`, `PUBLIC_BASE_URL` secrets).

---

### Item 2 — Team management & project RBAC  → **v0.11.0**

**Goal.** An admin can grow and govern a tenant from one **Tenant Settings modal**:
invite people by email, remove them, set their role — and, crucially, control **which
projects each member can access and at what level (read vs read/write)**. This is
what turns kbRelay from "everyone sees everything" into a real multi-team workspace.

**Grounded approach — houseops has both halves.**

*Team management* (`apps/api/src/routes/users.ts`, `db/repos/auth.ts` invite fns,
`middleware/authz.ts`, `invites` table, `AcceptInvite.tsx`, `inviteEmail` template):
- **Roles:** `admin` vs `member` for v1 (kbRelay's 4-rank `read|runner|owner|admin`
  enum can stay in the column for forward-compat; only admin/member are enforced).
  `requireRole('admin')` guards team + settings + RBAC endpoints.
- **Invites:** `invites` table (sha256 `token_hash`, `email`, `role`, `invited_by`,
  ~7-day TTL, `accepted_at`/`revoked_at`); `POST /invites` (admin issues + Mailgun-
  emails `${PUBLIC_BASE_URL}/auth/accept-invite/<token>`), `GET /invites`,
  `DELETE /invites/:id`; public `POST /auth/accept-invite` attaches an existing user
  or creates a new one with the invited role. Same hashed-single-use pattern as reset.
- **Member management:** `PATCH /users/:id` (change role), `DELETE /users/:id`
  (**remove from tenant = delete the membership**, not the user). Guards: can't
  remove/demote the **last admin**; can't remove yourself if last admin.

*Project RBAC* — the new grain kbRelay needs. houseops's analog is `property_access`
(a per-user, per-sub-tenant allow-list) + role ranks that separate read from write;
kbRelay makes the level explicit **per project**:
- **`project_access(tenant_id, project_id, user_id)`**, PK `(project_id, user_id)`.
  A row = the member has **access** (full read/write) to that project; no row = no
  access. **Access is binary — no per-project read-vs-write level** (deliberately
  simplified per your call: less schema, one enforcement check, lower privilege-leak
  risk).
- **Model:** **default-deny for members** — a member sees only projects they're
  granted. **Admins bypass** — access to every project in the tenant (never need to be
  added). A member with zero grants is valid (empty board list).
- **Enforcement layer (cross-cutting).** A single helper
  `requireProjectAccess(ctx, projectId)` used by **every** project-scoped route (reads
  and mutations alike — access is all-or-nothing): `GET /projects` filters to
  accessible projects; everything under a project (columns, cards, timeline, comments,
  mutations) requires access. Admin short-circuits to allow.
- **UI:** the Tenant Settings modal gains, per member, a **project checklist** (each
  project → access on/off). Same modal as invite/remove — the "same modal" you meant.

**Key decisions for `2-TEAM_AND_RBAC_DESIGN.md`:**
- **Cross-access edge cases:** can you **@-mention** or **assign a card to** a user
  with no access to that project? *Recommendation:* the autocomplete only offers users
  with ≥read access to the project; assigning to a no-access user is blocked (or
  offers "grant access"). Mentions already retract on text edits, so a lost-access
  user's stale mentions can be swept.
- **Project creation:** the creator (a member) auto-gets `write` on their new project;
  admins see it regardless.
- **Agents:** an agent token is a member too — RBAC applies uniformly (no access to a
  project ⇒ can't see or touch it). Important for Item 4 (a scoped MCP token).
- **Role interaction:** admin = tenant-wide access bypass; a member's access = its
  per-project grants.
- **Backfill:** existing `t_lala` members → admins (so nothing breaks); existing
  projects visible to all current members.

**Blast radius:** `routes/team.ts` (members + invites + project-access),
`middleware/authz.ts` (`requireRole`, `requireProjectAccess`), `db/repos/access.ts`;
migration (`invites`, `project_access`, backfill); **enforcement threaded through
every existing card/column/project/timeline/mention route** (the bulk of the work);
web **Tenant Settings modal** (Team tab + per-member project-access matrix) +
**Accept-invite** page; `CONTEXT.md` deferred list (RBAC now partially shipped).

**Risk:** **medium**, lowered by the binary model (one check, not a read/write matrix).
The enforcement helper touches nearly every route, so the risk is *missing a spot*
(an unguarded route = a leak). Mitigation: centralize in one helper, default-deny, and
a test asserting every project-scoped route rejects a no-access caller.

---

### Item 3 — Self-host vs Cloudflare split  → **v0.12.0**

**Goal.** Run the whole thing (BE + FE + DB) locally with **no Cloudflare
dependency**, via Docker + compose + make targets. Two modalities: **Cloudflare**
(unchanged) and **self-host**.

**Grounded approach — textral's pattern, but simpler.** textral proved the shape: one
runtime-agnostic app + a thin **`Db` port** with per-runtime adapters, chosen by
**which entrypoint boots** (no in-app mode flag) — KISS takeaway: a tiny `Db` port,
one app behind two entrypoints, a small migration runner (`runtime/shared/
interfaces.ts`, `runtime/cf/d1-db.ts`, `runtime/node/pg-db.ts`, `apps/api/Dockerfile`,
`infrastructure/docker/docker-compose.yml`, `scripts/migrate-postgres.ts`).

**Our simplification — self-host on SQLite, not Postgres.** You said "postgres **or a
simpler sql container**." kbRelay's SQL is already plain SQLite (D1), so the simplest,
lowest-risk self-host DB is **SQLite via `@libsql/client`** (a local file, or `sqld`
if networked). This *eliminates textral's biggest costs*: **no `?`→`$N` translation,
no BIGINT/JSON type-parser shims, ONE migration tree** — the same `migrations/*.sql`
run on both D1 and libsql. Postgres stays an optional later adapter.

- **The `Db` port = D1's own shape.** An interface mirroring what repos already call
  (`prepare(sql).bind(...).first()/all()/run()` + `batch([...])`). CF adapter *is* the
  D1 binding; Node adapter wraps `@libsql/client` to expose the same shape. **Repos
  barely change** (`env.DB` → `env.db`); no SQL rewrites.
- **Two entrypoints.** Keep the Worker `export default { fetch }`. Add
  `runtime/node/index.ts`: a thin Node server (`node:http` + a standard-`Request`
  adapter like `@whatwg-node/server`) that builds a Node `env` and **serves the built
  SPA statically + routes `/api/*`** through the existing dispatcher.
- **Docker/compose (minimal).** One Node `Dockerfile`; `docker-compose.yml` = **just
  the `app` service + a volume for the SQLite file** — *no DB/redis/minio containers*.
- **Make targets:** `selfhost-up/down/logs`, `selfhost-migrate`, and
  **`selfhost-mint-tenant`** (create tenant + admin + first API token, **no email** —
  the offline equivalent of textral's `/admin/bootstrap`). Mailgun stays a no-op.
- **Boundary guards (from textral `tools/`):** CI checks no `@cloudflare/*`/D1 types
  leak into the Node path and no `@libsql`/`node:*` into the Worker path.

**Key decisions for `3-SELFHOST_OR_HOSTED_SPLIT_DESIGN.md`:** exact `Db` interface;
libsql file vs `sqld`; SPA static-serving in Node; `batch`/transaction parity; folder
layout (`runtime/{cf,node,shared}`).

**Risk:** **low** — both sides are the *same SQLite engine*; RETURNING, correlated
subqueries, `ALTER … RENAME COLUMN`, and batches behave identically. Work is mostly
mechanical (thread `env.db`) + the Node entrypoint + Docker.

---

### Item 4 — MCP server `@alacrity-ai/kbrelaymcp`  → **v0.13.0**

**Goal.** A published npm MCP server so any agent can drive kbRelay via
`claude mcp add kbrelay --scope user -- npx -y @alacrity-ai/kbrelaymcp`.

**Grounded approach — textral's `packages/mcp` blueprint (verified):**
- Workspace package `packages/mcp`, `package.json`: `name:
  "@alacrity-ai/kbrelaymcp"`, `type: module`, `bin: { kbrelaymcp:
  "./bin/kbrelaymcp.mjs" }`, `files: ["dist","bin","README.md"]`, and — scoped —
  **`publishConfig: { access: "public" }`** (textral omitted this; a public publish
  would fail without it). Deps: `@modelcontextprotocol/sdk`, `zod`,
  `zod-to-json-schema`. Build with plain **`tsc`**.
- `bin/kbrelaymcp.mjs`: shim that dynamic-imports `dist/transport-stdio.js` →
  `startStdio()` (stderr for logs; stdout reserved for JSON-RPC).
- `src/server.ts`: low-level `Server`; `ListTools`/`CallTool` over an `allTools`
  array; `defineTool({name, description≤200, inputSchemaZod, handler})` with
  zod→JSON-Schema at load.
- **Tools** wrap kbRelay endpoints: `list_projects`, `list_cards`, `create_card`,
  `move_card`, `add_comment`, `get_mentions`, `mark_mentions_read`, `whoami`, …
  **RBAC-aware:** the token's project access (Item 2) governs what the agent can see/do.
- **Auth/config (KISS):** read **`KBRELAY_BASE_URL` + `KBRELAY_API_KEY`** from env
  (via `claude mcp add … --env …`); send `Authorization: Bearer <key>`.
- **API client:** **inline a tiny typed `fetch` wrapper** (no workspace dep) so
  `npx -y @alacrity-ai/kbrelaymcp` runs standalone.
- **Publish:** manual `npm publish --access public`, or a tag-driven GitHub Action
  (`setup-node` + `NODE_AUTH_TOKEN: secrets.NPM_TOKEN` — token in `DO_NOT_COMMIT.md`).

**Depends on Items 1–2** (self-service API keys + RBAC-scoped tokens). **Key decisions
for `4-MCP_DESIGN.md`:** tool surface (read vs write); inline client vs publishing
`@kbrelay/shared`; manual vs CI publish.

---

## 2. Sequencing & why

**1 → 2 → 3 → 4:**
- **Self-register (1)** first — introduces human auth + the membership/role foundation
  + self-service API keys, on a single runtime (simpler to get right).
- **Team & RBAC (2)** next — builds directly on Item 1's membership/role/Mailgun to
  add invites, removal, and per-project read/write access + enforcement. Same modal,
  same infra. Doing it before the split means the split wraps a *complete* auth+RBAC
  surface.
- **Self-host split (3)** — wrap the finished behavior behind a `Db` port + Node
  entrypoint. Runtime-agnostic; RBAC enforcement is just SQL + checks, unaffected.
- **MCP (4)** last — a thin client over the finished, RBAC-scoped API; needs Item 1's
  keys; runs against CF or self-host via `KBRELAY_BASE_URL`.

Each ships as its own minor release (v0.10–v0.13) with its own design doc + release
notes, same cadence as v0.1–v0.9.

## 3. Cross-cutting notes

- **Two auth modes forever:** bearer (agents/MCP) + cookie/JWT (humans).
- **RBAC applies uniformly to humans and agents** — an agent token is a member with
  per-project access, so a scoped MCP token is "free" once Item 2 lands.
- **Mailgun graceful-degrade** (houseops) → same code runs CF (email on) and self-host
  (email off, mint via make target).
- **One SQLite dialect** across CF-D1 and self-host-libsql is the biggest risk-reducer.
- **`DO_NOT_COMMIT.md` has everything:** Mailgun key (`mg.kbrelay…`), NPM CI token, CF
  creds, D1 IDs. Secrets via `wrangler secret put` (CF) / `.env` (self-host).

## 3a. Live-tenant preservation (HARD REQUIREMENT)

The production tenant **`t_lala`** is in active daily use and **must not be
destroyed or degraded** by any migration here. Baseline captured 2026-07-01 —
**6 active projects that must survive intact**:

| code | id | name |
|---|---|---|
| OBC | `prj_e4f9903dbf96406c845fdd81b7f0574d` | Orderbase - Customers |
| MSP | `prj_328d8379a7304e14a1f0d79abfa17d5d` | MemeSigns - Planning |
| CR  | `prj_4316d5581976461d88e1eb99918e890a` | Chrono Resonance |
| OBL | `prj_2f713d4c864745fbb9cae134052dfd8c` | Orderbase - Launch |
| BMS | `prj_c6a2f28633a4485c9588bc8081718cd5` | buildmylease.com Support |
| BML | `prj_0e619e7c54664ff696e16bfee79583a7` | buildmylease.com |

**Guarantees enforced on every migration in this roadmap:**
1. **Additive-only.** Migrations only `CREATE TABLE` / `ADD COLUMN` (nullable) /
   `CREATE INDEX`. **No `DROP`, no `RENAME`, no `UPDATE`/`DELETE` on
   `projects`/`cards`/`columns`/`card_events`/`card_mentions`.** Project data is never
   in the blast radius.
2. **Backfills are idempotent and explicit-by-id** (the same safe pattern already run
   twice on this tenant — v0.7.0 ticket-key backfill, v0.8.0 handle backfill).
3. **Behavior-preserving rollout.** Item 2's RBAC backfill grants **every existing
   member access to every one of the 6 projects**, so nothing a member sees today
   disappears. `u_leif` is backfilled **admin** (RBAC-bypass); his existing **token
   keeps authenticating unchanged** throughout.
4. **Pre-flight backup.** Before running `0010`/`0011` on prod: `wrangler d1 export
   kbrelay --remote --output kbrelay-preYYYYMMDD.sql` (a full restore point).
5. **Post-migration verification** (must pass before proceeding): the 6 project ids
   above still present + `status='active'`; each project's card count unchanged vs. the
   pre-flight snapshot; every `t_lala` member has a membership; every (member × the 6
   projects) has a `project_access` row.
6. **Rollback.** Because migrations are additive, rollback = drop the new
   tables/columns (or restore the export). The projects are untouched either way.

## 4. Non-goals (for this roadmap)

Per-project **read-vs-write levels** (access is binary), deeper/attribute-based RBAC
(per-card/column ACLs), org/billing, real-time push, Postgres self-host, multi-region,
OAuth/SSO, attachments, multi-tenant account-switcher UI (one active tenant per
session to start). Additive hooks left for each.

## 5. Next step

On approval, produce (with fresh grounded research per item, reading the exact
reference files):
1. `docs/v0.10.0/1-TENANT_SELF_REGISTER_DESIGN.md`
2. `docs/v0.10.0/2-TEAM_AND_RBAC_DESIGN.md`
3. `docs/v0.10.0/3-SELFHOST_OR_HOSTED_SPLIT_DESIGN.md`
4. `docs/v0.10.0/4-MCP_DESIGN.md`

Then implement 1 → land → 2 → land → 3 → land → 4 → land, each verified in prod (and,
for Item 3, in a local self-host stack) before moving on.
