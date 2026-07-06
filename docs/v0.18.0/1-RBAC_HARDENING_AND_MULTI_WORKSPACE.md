# v0.18.0 — RBAC hardening (KBR-94) + multi-workspace (KBR-96)

Both come out of the KBR-92 audit: the v0.10 membership model (global
email-keyed users + `memberships(tenant_id, user_id, role)`) was sound, but
(a) the `member` role could shape boards it could see, and (b) a second
membership was unusable because sessions pin to one tenant with no switcher.

## KBR-94 — board-shaping is admin-only

**Principle:** members (human or agent) *work* boards — cards, comments,
attachments, moves, archiving done work. Admins *shape* them — projects,
columns, labels, restores.

Gated with `requireAdmin` in-handler (same pattern as team/agents/webhooks):

| Surface | Routes |
|---|---|
| Project create | `POST /v1/projects` |
| Project settings | `PATCH /v1/projects/:id` |
| Columns | `POST /projects/:id/columns`, `PATCH/DELETE /columns/:id` |
| Card labels (palette) | `POST /projects/:id/labels`, `PATCH/DELETE /labels/:id` |
| Tenant project-labels | `POST/PATCH/DELETE /project-labels*`, `PUT /projects/:id/project-labels` |
| Archive **restore** | `PATCH /cards/:id` with `archived:false` **on an archived card** |

Notes:
- Restore is gated only on a real transition — `archived:false` on a live card
  stays a member no-op, and `archived:true` (archiving) remains member-allowed
  (Done-lane hygiene is normal workflow).
- **Supersedes** the v0.11 decision "any member may create a project"
  (`docs/v0.10.0/2-TEAM_AND_RBAC_DESIGN.md` §3.2). That made sense before
  invites existed; with real multi-user tenants it let guests mint boards in
  someone else's workspace.
- Web hides the affordances for non-admins (settings gear, mobile-menu entry,
  "+ New project" in switcher and empty-state, Done-lane archived badge).
- Agent keys are members unless explicitly made admins — an agent that should
  create projects needs an admin membership, which is a deliberate human act.
- Tests: `apps/api/src/routes/rbac-hardening.route.test.ts` (member 403 matrix,
  member workflow unchanged, admin unaffected).

## KBR-96 — multi-workspace

**Goal:** an invited user (e.g. a member of LaLa) can have their own workspace
and hop between them; nothing about API keys changes.

New endpoints (cookie-session oriented; bearer keys stay single-tenant):

- `GET /v1/me/memberships` → `{ memberships: [{ tenant:{id,name,slug}, role }] }`
  for the session user (works for bearer too — read-only introspection).
- `POST /v1/auth/switch-tenant { tenantId }` → 404 if the caller has no
  membership there; otherwise re-issues the session cookie with the new `tid`
  and records `users.last_tenant_id`. **Session-only** (a bearer token's tenant
  is immutable — mint a key per tenant).
- `POST /v1/tenants { name, tenantName?, code…? }` → creates a tenant + admin
  membership + starter agent for the **current** user, mirroring register's
  seeding. This is the sanctioned path around the register-409 for existing
  emails, and it switches the session into the new tenant.

Login behavior: `pickActiveTenant` prefers `users.last_tenant_id` (migration
adds the nullable column) when that membership still exists, then falls back
to origin tenant → oldest membership (unchanged).

Web: the account menu's tenant-name line becomes a **Workspaces** section —
one row per membership (current one marked), click to switch (full reload),
"+ New workspace" opens a name dialog. Hidden complexity stays server-side.

Out of scope (unchanged from v0.10): merging accounts, per-tenant profiles,
cross-tenant search, tenant deletion self-serve.

## KBR-101 addendum — member lockdown round 2 (same release)

Live member-account testing surfaced a second tier of loose powers. The final
member permission model on a card:

| On a card you **created** | On someone else's card |
|---|---|
| everything except archive/delete | **move** (column/position), **assign** (assignee/reviewer), comment, attach, upload |

Enforced server-side in `handlePatchCard`:
- `archived` (either direction) → **admin-only** (was restore-only in the first pass).
- **Content** — `summary`, `description`, `acceptanceCriteria`, `labelIds`,
  `dueAt` — → **creator or admin**. Workflow fields stay open because relaying
  work *is* moving/assigning other people's cards.
- Card delete was already admin-only + confirm-dialoged (earlier follow-up).

Web consequences:
- `CardModal` diffs its PATCHes — only changed fields are sent, so a member
  saving a workflow change on another's card doesn't trip the content gate.
- Locked content renders read-only ("· locked" labels, dashed `spec-locked`
  panes, disabled summary/due/label controls); view-mode task checkboxes are
  inert on cards you can't edit (a toggle IS a description/AC write).
- Attachment/link ✕ only renders for the uploader/creator or an admin (the API
  always enforced this; the UI used to show the button and swallow the 403).
- Archive button + Done-lane "Archive all" are admin-only.
- Attaching a file to someone else's card still works, but the markdown embed
  into the description is skipped (that would be a content write).

Agent caveat: member-roled agent keys can no longer set labels/due/summary on
cards a human created — they work the card and report on the timeline instead.
