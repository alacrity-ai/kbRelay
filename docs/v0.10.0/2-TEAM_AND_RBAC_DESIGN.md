# kbRelay — v0.11.0 Design: Team Management & Project RBAC

**Date:** 2026-07-01
**Status:** Design (pre-implementation). Item 2 of `0-ROADMAP_PLAN.md`.
**Depends on:** Item 1 (memberships, roles, sessions, Mailgun).
**Grounded in:** houseops team system — `apps/api/src/routes/users.ts`,
`db/repos/auth.ts` (invite fns), `middleware/authz.ts`, `invites` +
`property_access` tables, `AcceptInvite.tsx`, `email/templates.ts` (`inviteEmail`).

---

## 1. Goal & scope

One **Tenant Settings modal** where an admin governs the tenant:
1. **Invite** people by email, **remove** them, **change role** (admin/member).
2. **Grant / revoke each member's access to individual projects.**

Access is **binary** (your call): a member either has access to a project (full
read+write) or not. No per-project read-vs-write level. This is what turns kbRelay
from "every member sees every project" into a real multi-team workspace, with the
minimum schema and the smallest enforcement surface.

## 2. Roles

- **`admin` vs `member`** are the enforced roles (kbRelay's 4-rank
  `read|runner|owner|admin` enum may remain in the column for forward-compat, but only
  these two matter). Role lives on the **membership** (per-tenant, from Item 1).
- **`requireRole(ctx, 'admin')`** guards all team + RBAC endpoints.
- **Admins bypass project ACLs** — full access to every project in the tenant.
- **Members are default-deny** — access only the projects explicitly granted.

## 3. Project RBAC — the access model

- **`project_access(tenant_id, project_id, user_id, created_at)`**, PK
  `(project_id, user_id)`. **Row present = access; absent = none.** No level column.
- **Resolution** for a caller on a project:
  - admin (of the tenant) → **allow**.
  - else → allow **iff** a `project_access(project, user)` row exists.
- A member with **zero grants** is valid (their board list is empty).

### 3.1 The enforcement layer (the real work)

A single helper — **`requireProjectAccess(ctx, projectId)`** (in
`middleware/authz.ts` or `auth/access.ts`) — is called by **every project-scoped
route**, for reads and mutations alike (access is all-or-nothing, so there's one
check, not a read/write split):

| Route surface | Guard |
|---|---|
| `GET /projects` | **filter** to accessible projects (admins: all; members: `JOIN project_access`) |
| `GET /projects/:id` (+ columns), `GET /projects/:id/cards`, `GET /cards/:id`, `…/timeline` | `requireProjectAccess(project)` |
| create/patch/delete card, move, `POST …/comments`, redact, column add/rename/delete/reorder, `PATCH/DELETE /projects/:id` | `requireProjectAccess(project)` |
| `GET /me/mentions` | already self-scoped; **exclude** mentions whose card is in a project the caller no longer has access to |

The card/column/timeline routes resolve the owning `project_id` first (cards already
carry `project_id`; columns→project; comments→card→project), then call the helper.
**No-access → `403`** (or `404` to avoid leaking existence — *decision below*).

### 3.2 Cross-access edge cases (resolved)

- **Assignment:** `assigneeUserId` on create/patch a card must be a user **with access
  to that project** (admins exempt) → else `400 "assignee has no access to this
  project"`. Prevents assigning work to someone who can't see it.
- **@-mentions:** the autocomplete only offers users with access to the project;
  server-side, a mention resolving to a no-access user is dropped (like an unknown
  handle). Existing mentions whose recipient later loses access are simply not
  returned by `GET /me/mentions` (§3.1) and can be swept lazily.
- **Project creation:** any member may create a project; the creator is **auto-granted
  access** (insert a `project_access` row). Admins see it regardless.
- **Removing a member:** deletes their `memberships` row **and** their
  `project_access` rows for that tenant (cascade). Their authored cards/comments stay
  (provenance is historical); assignments to them are left as-is (a `404`-safe stale
  id, already handled by the UI's "unknown user" fallback).
- **Existence leaks:** a member hitting a project they can't access gets **`404`**
  (not `403`) so we don't reveal that a project exists. Team/role errors stay `403`.

## 4. Endpoints (new, all admin-gated except accept-invite)

- `GET /api/v1/team` — members (id, name, email, kind, role) + their accessible
  project ids; pending invites.
- `POST /api/v1/team/invites` — `{email, role}` → issue + Mailgun-email an
  `/auth/accept-invite/<token>` link. `GET /api/v1/team/invites`,
  `DELETE /api/v1/team/invites/:id` (revoke).
- `POST /api/v1/auth/accept-invite` — **public** — `{token, name?, password?}` →
  consume the invite; if the email already has a user, attach a membership; else
  create the user; then log in. Idempotent-safe on already-accepted → `400`.
- `PATCH /api/v1/team/members/:userId` — `{role}` (change role). Guards: can't
  demote the **last admin**.
- `DELETE /api/v1/team/members/:userId` — remove from tenant. Guards: can't remove
  the **last admin**, can't remove **yourself** if last admin.
- `PUT /api/v1/team/members/:userId/projects` — `{projectIds: [...]}` → **replace**
  that member's `project_access` set (the checklist "save"). (Admins aren't listed —
  they always have all.)

`invites` table: `id, tenant_id, email, role, token_hash (unique, sha256),
invited_by_user_id, expires_at (~7d), accepted_at, accepted_user_id, revoked_at,
created_at` — the same hashed-single-use-token pattern as password reset.

## 5. Web — the Tenant Settings modal

A tabbed modal (extends the existing project-settings modal pattern), **admin-only**
(hidden for members), reached from the gear / user menu:
- **Members tab:** list (name, email, role, kind badge); per row → change role,
  remove; an **"Invite"** action (email + role) and a **pending-invites** list with
  revoke.
- **Per-member project access:** expanding a member shows a **project checklist**
  (every tenant project → access on/off) that `PUT`s the set. Admins show "all
  projects (admin)" read-only.
- **Accept-invite page** (`/auth/accept-invite/:token`): shows the tenant, collects
  name/password for a new user (or just "Join" for an existing logged-in user), then
  lands them on the board.
- Members who aren't admins see a normal board scoped to their accessible projects;
  no settings modal.

## 6. Migration

`0011_rbac.sql` — **additive-only** (see `0-ROADMAP_PLAN.md §3a`; the live `t_lala`
tenant's **6 projects must survive intact** — this migration writes **no**
project/card/column data, only new tables):
- `CREATE TABLE invites(...)` (+ unique `token_hash`, index `tenant_id`).
- `CREATE TABLE project_access(tenant_id, project_id, user_id, created_at, PRIMARY
  KEY(project_id, user_id))` (+ index `user_id`).
- **Backfill = behavior-preserving (critical for the live tenant).** Grant every
  existing member access to every existing project in their tenant via a set-based
  insert:
  ```sql
  INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
  SELECT p.tenant_id, p.id, m.user_id, <now>
    FROM projects p JOIN memberships m ON m.tenant_id = p.tenant_id;
  ```
  This grants all current members (incl. `u_claude`) access to all current projects,
  so **nothing anyone sees today disappears** when enforcement turns on. Admins
  (`u_leif`) bypass regardless. This is a pure `INSERT` — projects/cards are never
  read-modified.

**Pre-flight (prod):** `wrangler d1 export kbrelay --remote --output
kbrelay-pre0011.sql`. **Post-migration verify (before deploying the Worker that
enforces):** the 6 baseline projects still `active`; **each `t_lala` member has a
`project_access` row for all 6** (so RBAC-on is a no-op for current members); a
member's board still shows all 6 until an admin narrows it.

## 7. Testing

- **Unit (pure):** access resolution (admin→allow; member with/without grant); invite
  token single-use + expiry; last-admin guards; assignee-access validation.
- **Enforcement coverage test (the key safety net):** a table-driven test that, for a
  member with **no** access, asserts **every** project-scoped route returns `404`
  (reads) / `404` (mutations) — iterating the router table so a newly added route that
  forgets the guard **fails the test**.
- **Local + prod smoke:** admin invites a member (real email in prod) → accept →
  member sees no projects → admin grants one project → member sees exactly that one,
  can edit; a second project stays invisible (`404` on direct id); remove member →
  access gone; last-admin guards fire.

## 8. Deploy (order matters — no lock-out window)

1. **Export** prod D1 (restore point).
2. **Migrate `0011` + run the backfill** on prod D1.
3. **Verify** every `t_lala` member now has `project_access` to all 6 baseline
   projects (`0-ROADMAP_PLAN.md §3a`). Do **not** proceed until this passes — the
   backfill must land *before* the enforcing Worker, or members would be briefly
   denied their own projects.
4. **Then** deploy the Worker (which enforces `requireProjectAccess`) → Pages.

Because the grants exist before enforcement turns on, the rollout is **behavior-
preserving**; access only narrows when an admin deliberately changes it.

## 9. Out of scope (→ later)

Per-project read-vs-write levels (access is binary), per-card/column ACLs, custom
roles, ownership transfer, audit log of access changes, bulk project-access editing,
SSO group mapping.
