# kbRelay v0.11.0 — Team Management & Project RBAC

**Shipped:** 2026-07-01 · **Design:** `../v0.10.0/2-TEAM_AND_RBAC_DESIGN.md`

Item 2 of the v0.10.x roadmap. A tenant is now a real multi-team workspace: an
admin invites people, sets roles, and controls **which projects each member can
access**. Access is **binary** — a member either has full read+write to a project
or none.

## What shipped

- **Binary project RBAC.** New `project_access(tenant, project, user)` table. A row
  = full access; no row = none. **Admins bypass** (see everything); **members are
  default-deny**. Enforced by a single dispatcher check, `enforceProjectAccess`,
  driven by a declarative `access` scope on each project/card/column route. No-access
  resolves to **404** (never 403) so a project's existence isn't leaked.
- **Coverage safety net.** `access.test.ts` iterates the live router table and fails
  CI if any project-scoped route forgets to declare its `access` scope.
- **Team management (admin-gated).** `GET /team` (members + their project access +
  pending invites); `POST/DELETE /team/invites`; `PATCH/DELETE /team/members/:userId`
  (role change / remove, with **last-admin guards**); `PUT /team/members/:userId/projects`
  (replace a member's access set). Invites are hashed single-use 7-day tokens, emailed
  via Mailgun.
- **Accept-invite (public).** `POST /auth/accept-invite` — creates the user (or attaches
  an existing one) and logs them in. New members start default-deny until granted.
- **Cross-cutting enforcement.** Assigning a card requires the assignee to have access
  (400 otherwise); `@`-mentions only resolve to users with access (silent no-op
  otherwise); `GET /me/mentions` hides mentions in projects the caller can't access;
  creating a project auto-grants the creator; deleting a project cleans up its grants;
  removing a member drops their memberships + grants and invalidates their session.
- **Web.** A **Team & access** modal (admin-only, from the account menu): invite by
  email + role, pending-invite list with revoke, per-member role selector and remove,
  and a per-member **project checklist**. An accept-invite flow in the auth shell.

## Migration `0011_rbac.sql` (additive-only, behavior-preserving)

Adds `invites` + `project_access`. The critical backfill grants **every existing
member access to every existing project in their tenant**, so enforcement changes
nothing anyone can currently see:

```sql
INSERT OR IGNORE INTO project_access (tenant_id, project_id, user_id, created_at)
SELECT p.tenant_id, p.id, m.user_id, <ts>
  FROM projects p JOIN memberships m ON m.tenant_id = p.tenant_id;
```

## Live-tenant safety (verified on prod)

Deploy order (no lock-out window): **export → migrate + backfill → verify grants →
deploy enforcing Worker → deploy Pages → verify.** Confirmed on prod: 18 grants
(6 projects × 3 members), each member with access to all 6; projects/cards intact;
**Claude (member) still sees all 6 projects** — nothing disappeared when RBAC turned
on. Restore point: `kbrelay-pre0011.sql`.

## Tests

`access.test.ts` route-coverage net (18); OpenAPI↔router parity extended to the new
routes; all API unit tests green (72). Plus a 31-assertion local end-to-end RBAC smoke
(default-deny, grant→visibility, 404 no-leak, create/assignee gating, mentions RBAC,
member auto-grant, last-admin guards, session invalidation) and a 7-assertion prod
verification.

## Not in this item (later roadmap)

Per-project read-vs-write levels (access is binary), per-card/column ACLs, custom
roles, ownership transfer, audit log of access changes, multi-tenant account switcher.
Next: self-host / Cloudflare split (v0.12.0).
