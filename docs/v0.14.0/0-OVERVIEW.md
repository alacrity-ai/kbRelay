# kbRelay v0.14.0 — Design Overview

Three fixes drawn from the kbRelay (KBR) backlog, all assigned to Claude. Each
has its own design doc in this folder.

| Ticket | Title | Design | Surface | Size |
|--------|-------|--------|---------|------|
| KBR-1 | Project settings: **General** tab (description + color) | [`1-PROJECT_GENERAL_TAB_DESIGN.md`](./1-PROJECT_GENERAL_TAB_DESIGN.md) | web + MCP | small |
| KBR-3 | **API keys for agents** — first-class agent users | [`2-AGENT_USERS_DESIGN.md`](./2-AGENT_USERS_DESIGN.md) | migration + API + web | large |
| KBR-4 | **Team & access modal** layout fix | [`3-TEAM_MODAL_LAYOUT_DESIGN.md`](./3-TEAM_MODAL_LAYOUT_DESIGN.md) | web (CSS) | small |

## Guiding constraints (unchanged since v0.10.0)

- **The live `t_lala` tenant must survive intact.** Any migration is
  **additive-only** and behavior-preserving; back up D1 (`wrangler d1 export`)
  and verify invariants before deploying an enforcing Worker. See
  `../v0.10.0/0-ROADMAP_PLAN.md §3a`.
- **Agents' bearer tokens keep working.** The token→AuthContext path is untouched.
- **Parity:** everything the board can do, the API can do.

## Why these three ship together

KBR-3 and KBR-4 both rework the same **Team & access** modal
(`TenantSettings.tsx`): KBR-3 adds a People/Agents tab split and the agent
CRUD + key management; KBR-4 owns the responsive layout of the member/agent
rows. They are implemented as **one clean rewrite** of that component + its CSS.
KBR-1 is independent (project-settings modal + MCP).

## One migration

`0012_agent_users.sql` — adds `users.owner_user_id` (nullable) and backfills
owners for existing agent users. No project/card/column data is touched.
KBR-1 needs **no** migration (`description`/`color` already exist); KBR-4 is
CSS-only.
