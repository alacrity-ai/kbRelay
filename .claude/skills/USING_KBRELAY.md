# Using kbRelay (agent skill)

# NOTE: Deprecated 7/1/2026 - We now use MCP (@alacrity-ai/kbrelaymcp)

Everything below this line is now deprecated - the API exists, but using the MCP should be your primary pathway

**kbRelay** is a shared kanban board where humans and agents relay work to each other. If you're an agent, this is where you pick up tasks a human filed for you, and where you file tasks back for a human. This doc takes you from knowing nothing to using it in minutes.

- **Where:** `https://kbrelay.lalalimited.com`
- **API base:** `https://kbrelay.lalalimited.com/api`
- **Contract:** `GET https://kbrelay.lalalimited.com/api/openapi.json` (OpenAPI 3.1, no auth)

---

## 1. Auth — do this first

Every `/api/v1/*` call needs a bearer token:

```
Authorization: Bearer <token>
```

Your token resolves to **a user within a tenant**. Everything you see and touch is automatically scoped to that tenant — you cannot read or change another tenant's data.

Get your token from the `KBRELAY_TOKEN` environment variable if set, otherwise from the kbRelay repo's `DO_NOT_COMMIT.md` (the row for the agent user, e.g. "Claude"). **Never print, log, or commit the token.**

> **Two auth modes (v0.10.0+).** Humans now sign in on the web with **email + password** (a session cookie); they mint the bearer tokens they hand to agents from the **API keys** panel in their account menu. **Bearer tokens are unchanged** — this is still your path. You can also self-manage your own tokens via `GET/POST/DELETE /api/v1/me/tokens` (POST returns the plaintext secret exactly once). Your `role` is now your tenant **membership** role (`admin`/`member`).

> **Project access is scoped (v0.11.0 RBAC).** Your token only sees the projects you've been granted access to — `GET /projects` returns exactly those. An **admin** sees every project; a **member** sees only granted ones. Touching a project/card/column you can't access returns **404** (we don't reveal it exists), so if you get an unexpected 404, you may simply lack access — ask an admin to grant it in **Team & access**. A card's `assigneeUserId` must be someone with access to that project, and `@`-mentioning a user without access is a silent no-op. Team management (`/api/v1/team/*`) is admin-only.

> **Agent users (v0.14.0).** The right way to run an agent is with its **own** identity, not a human's borrowed key. An admin creates an **agent user** (web → *Team & access → Agents*, or `POST /api/v1/agents`), grants it project access, and mints keys for it — everything the agent then does is attributed to the agent (`created_by`), and it can be assigned cards and `@`-mentioned like anyone. If your key was minted this way, `GET /me` shows you as `kind:"agent"` with your own name/handle. Agent management (`/api/v1/agents*`) is admin-only; a member key gets `403`.

Set up your shell once:

```bash
export KBRELAY_TOKEN="<your token>"
export KB="https://kbrelay.lalalimited.com/api"
alias kbget='curl -s -H "Authorization: Bearer $KBRELAY_TOKEN"'
# helper for writes:
kbpost(){ curl -s -H "Authorization: Bearer $KBRELAY_TOKEN" -H 'content-type: application/json' -X "$1" "$KB$2" ${3:+-d "$3"}; }
```

Confirm who you are:

```bash
kbget $KB/v1/me
# → {"tenant":{"id":"t_lala","name":"LaLa Solutions","slug":"lala"},
#    "user":{"id":"u_claude","name":"Claude","kind":"agent","role":"owner"}}
```

Remember your own `user.id` (e.g. `u_claude`) — you'll use it to find work assigned to you and to stamp cards you create.

---

## 2. The mental model (30 seconds)

```
tenant ── has many ── users (kind: "human" | "agent")   ← Leif, Joe (human); Claude (agent)
   └───── has many ── projects
                          └── columns   (lanes: Todo, In Progress, In Review, Done — customizable)
                                 └── cards   (the tasks)
```

- **A card's status *is* its column.** Moving a card from "Todo" to "In Progress" = changing its `columnId`. There's no separate status field.
- **Provenance is automatic.** Whatever token makes a change stamps the card's `created_by` / `updated_by`. So the board always shows *who* (and whether human or agent) created and last touched a card.
- **Spec vs. log — this is the important one.** A card has two kinds of text:
  - the **spec** — `description` + `acceptanceCriteria`: *what to do / how we'll know it's done*. **Rewrite it in place** to improve the plan.
  - the **log** — the card **timeline**: *what happened*. **Append-only.** Never dump "what happened" into the description.
  Moving/assigning/editing a card auto-emits a **system event** to the timeline (durable who-did-what-when — not just last-write). To report results, **post a comment** (`note` or `handoff`); don't edit the description.
- **Write in markdown — always.** `description`, `acceptanceCriteria`, and timeline comment/handoff **bodies** render as **GitHub-flavored markdown** in the board's view mode. Default to markdown: use `##` headings, `-` bullets, `- [ ]` task lists, `` `code` `` / fenced ```` ``` ```` blocks, tables, `> quotes`, `**bold**`, and `[text](url)` links. A single newline is a line break. (Titles and the handoff `summary`/slot lists stay plain — don't format those.)
- **Ordering** within a column is a numeric `position` (drag-and-drop uses fractional midpoints). Bigger = lower in the list.
- **Column IDs are per-project and not guessable.** Always fetch a project's columns and map them **by name** — never hardcode a column id across projects.
- **@-mentions are your inbox.** Write `@handle` (e.g. `@leif`, `@claude`) in a `description`, `acceptanceCriteria`, or a comment `body` to notify that user. Your own mentions are at **`GET /v1/me/mentions`** — this is how you find "what did people ask me?" See §4.5.

- **Ticket keys.** Every project has a short **`code`** (e.g. `OBL`). Cards get an
  auto-assigned **`key`** (`OBL-1`, `OBL-2`, …) — sequential per project, never
  reused. You don't set the key; it's derived from the project code + the card's
  `seq`. Refer to tickets by their key. The descriptive text is **`summary`** (this
  was called `title` before v0.7.0).

Key shapes:
- **Card:** `{ id, projectId, columnId, key, seq, summary, description, acceptanceCriteria, color, position, assigneeUserId, createdBy, updatedBy, createdAt, updatedAt }` — `key` (e.g. `"OBL-1"`) and `seq` are auto; `summary` is the text.
- **Column:** `{ id, projectId, name, color, position }`
- **Project:** `{ id, name, code, description, color, status, createdBy, cardCount? }` — `code` drives ticket keys; `cardCount` (total tickets) is present on the list endpoint only.
- **User:** `{ id, name, kind, role, color, handle }` — `handle` (e.g. `"leif"`) is what you `@`-mention.
- **Mention:** `{ id, cardId, cardKey, cardSummary, projectId, projectCode, projectName, source:{kind, commentId}, excerpt, authorUserId, createdAt, readAt }` — one place you were @-mentioned.

---

## 3. Endpoint reference (everything you need)

All require the bearer token unless marked public.

| Method & path | What it does |
|---|---|
| `GET /api/health` | liveness (public) |
| `GET /api/openapi.json` | full machine-readable contract (public) |
| `GET /api/v1/me` | who am I (user + tenant) |
| `GET /api/v1/users` | list tenant users → resolve names to ids for assignment |
| `GET /api/v1/projects?status=active` | list projects (each includes `cardCount`, total tickets) |
| `POST /api/v1/projects` | create a project — **requires `code`** (2–6 alnum, e.g. `OBL`); auto-seeds Todo/In Progress/In Review/Done |
| `GET /api/v1/projects/{id}` | project **+ its columns** |
| `PATCH /api/v1/projects/{id}` | rename / recolor / `status:"archived"` |
| `DELETE /api/v1/projects/{id}` | delete project (cascades) — **admin-only** (403 otherwise) |
| `GET /api/v1/projects/{id}/columns` | list columns (ordered) |
| `POST /api/v1/projects/{id}/columns` | add a column |
| `PATCH /api/v1/columns/{id}` | rename / recolor / reorder (`position`) |
| `DELETE /api/v1/columns/{id}` | delete an **empty** column (409 if it has cards) |
| `GET /api/v1/projects/{id}/cards?column=&assignee=&q=` | list cards (filterable) |
| `POST /api/v1/projects/{id}/cards` | create a card (defaults to the first column) |
| `GET /api/v1/cards/{id}` | read one card |
| `PATCH /api/v1/cards/{id}` | edit fields **and/or move** (`columnId` + `position`) |
| `DELETE /api/v1/cards/{id}` | delete a card |
| `GET /api/v1/cards/{id}/timeline` | the card's activity log (system events + comments), oldest→newest |
| `POST /api/v1/cards/{id}/comments` | post a `note` or a `handoff` to the timeline |
| `DELETE /api/v1/cards/{id}/comments/{commentId}` | **redact** (soft-delete) *your own* comment — leaves a tombstone |
| `GET /api/v1/me/mentions?status=unread\|read\|all` | **your** @-mentions (default unread). Side-effect-free |
| `POST /api/v1/me/mentions/read` | acknowledge mentions: `{ "mentionIds": [...] }` or `{ "all": true }` |
| `PATCH /api/v1/me` | set **your own** color (`{ "color": "#rrggbb" }`) |
| `GET /api/v1/me/tokens` | list **your** API tokens (never the secret) |
| `POST /api/v1/me/tokens` | mint a token: `{ "label": "…" }` → returns the plaintext **once** |
| `DELETE /api/v1/me/tokens/{id}` | revoke one of your tokens |

Admin-only endpoints (a member key gets `403`): team management `GET /api/v1/team`, `POST/DELETE /api/v1/team/invites…`, `PATCH/DELETE /api/v1/team/members/{userId}`, `PUT /api/v1/team/members/{userId}/projects`; and **agent users** `GET/POST /api/v1/agents`, `PATCH/DELETE /api/v1/agents/{userId}`, `GET/POST /api/v1/agents/{userId}/tokens`, `DELETE /api/v1/agents/{userId}/tokens/{tokenId}` (create/manage agent identities + their keys).

Human-only auth endpoints (public; cookie-based — agents don't need these): `POST /api/v1/auth/{register,login,logout,forgot-password,reset-password}`, `GET /api/v1/auth/me`.

> **MCP option (v0.13.0+).** Instead of raw curl, an agent runtime can add the published MCP server for typed tools (`whoami`, `list_projects`, `create_project`, `update_project`, `create_card`, `add_comment`, `get_mentions`, `mark_mentions_read`, …): `claude mcp add kbrelay --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com --env KBRELAY_API_KEY=<token> -- npx -y @alacrity-ai/kbrelaymcp`. It's a thin client over this same API — the token's tenant + RBAC still govern everything. Prefer a key minted for an **agent user** (above) so the MCP's work is attributed to the agent. See `packages/mcp/README.md`.

Card create/patch body fields (all optional except `summary` on create): `summary, description, acceptanceCriteria, columnId, assigneeUserId, position`. The ticket **`key`/`seq` are auto-assigned — never sent.** (Card **color** is no longer settable — a card shows in its **assignee's** color; set yours with `PATCH /me`.) The `?q=` list filter matches **`summary`** (+ description).

Project create/patch body: `name` (required on create), **`code`** (required on create; 2–6 alphanumerics, uppercased, unique per tenant), `description`, `color`, `status`.

**Comment body** (`POST …/comments`): `{ type?: "note"|"handoff" (default note), body, meta? }`. `body` is **markdown** (renders in view mode). A `handoff`'s `meta` carries soft slots — `{ summary?, evidence?: string[], verify?: string[], spunOff?: string[] }` (kept plain; don't markdown these).

> **Write `description`, `acceptanceCriteria`, and comment `body` in markdown** — headings, lists, task lists, code, tables, and links all render. Plain text still works, but prefer markdown.

---

## 4. The core agent working loop

This is the pattern for "go do the tasks on the board." Resolve columns by name, find your work, and reflect progress by moving the card.

```bash
# 0. Who am I?
ME=$(kbget $KB/v1/me | jq -r .user.id)                       # e.g. u_claude

# 1. Find the project by name.
PID=$(kbget $KB/v1/projects | jq -r '.projects[] | select(.name=="Growth") | .id')

# 2. Map column names → ids for THIS project.
COLS=$(kbget $KB/v1/projects/$PID)
TODO=$(echo "$COLS"    | jq -r '.columns[] | select(.name=="Todo") | .id')
DOING=$(echo "$COLS"   | jq -r '.columns[] | select(.name=="In Progress") | .id')
REVIEW=$(echo "$COLS"  | jq -r '.columns[] | select(.name=="In Review") | .id')

# 3. Find work: cards in Todo (optionally only those assigned to me).
kbget "$KB/v1/projects/$PID/cards?column=$TODO"
# or just mine, anywhere:
kbget "$KB/v1/projects/$PID/cards?assignee=$ME"

# 4. Take a card: move it to In Progress and assign it to yourself.
CARD=card_xxxxxxxx
kbpost PATCH /v1/cards/$CARD "{\"columnId\":\"$DOING\",\"assigneeUserId\":\"$ME\"}"

# 5. …do the actual work…  (read the card's description + acceptanceCriteria first)

# 6. When done, move to In Review, then POST a handoff to the timeline
#    (do NOT edit the description to say what happened — that's what the log is for).
#    Write `body` in markdown — it renders in the board's view mode. `\n` = line break.
kbpost PATCH /v1/cards/$CARD "{\"columnId\":\"$REVIEW\"}"
kbpost POST /v1/cards/$CARD/comments "{
  \"type\":\"handoff\",
  \"body\":\"**Measurement spine shipped** + prod-smoke-verified.\n\n- attribution capture → D1 (\`0009\`) → ops export\n- see [tracking design](docs/v0.2.0/1-TRACKING_DESIGN.md)\",
  \"meta\":{
    \"summary\":\"UTM/gclid capture → D1 → ops export, live in prod\",
    \"evidence\":[\"commit:2eebfff\",\"deploy:api@6111ea4a\",\"gate:green\"],
    \"verify\":[\"attributed prod draft captured PRODSMOKE123\",\"normal draft path intact\"],
    \"spunOff\":[\"card:set-OPS_API_TOKEN\",\"card:ship-cookiepolicy-after-HU3\"]
  }
}"
```

You don't set `updated_by` — kbRelay stamps it from your token, and the move in step 6 auto-emits a "Claude moved this Todo→In Review" **system event** on the timeline. The reviewer sees your handoff sitting right under that move.

### Placing a card precisely (optional)
`position` is optional. If you omit it on a move, the card keeps its old position number in the new column (usually fine). To drop it at the **bottom** of the target column:

```bash
LAST=$(kbget "$KB/v1/projects/$PID/cards?column=$DOING" | jq '[.cards[].position] | max // 0')
kbpost PATCH /v1/cards/$CARD "{\"columnId\":\"$DOING\",\"position\":$(($LAST + 1000))}"
```

---

### 4.5 Your mentions — "check my mentions and respond to them"

When someone writes `@claude` in a card's description, acceptance criteria, or a
comment, it lands in **your mention inbox**. This is the API to answer *"a human
asked me things across the board — go handle them."*

```bash
# 1. List your unread mentions (side-effect-free — listing does NOT clear them).
kbget "$KB/v1/me/mentions" | jq -r '.mentions[] | "\(.cardKey) [\(.source.kind)] by \(.authorUserId): \(.excerpt)"'

# 2. For each mention: read context + respond ON THAT CARD, then acknowledge it.
CARD=card_xxxx ; MEN=men_xxxx
kbpost POST /v1/cards/$CARD/comments '{"type":"note","body":"On it — @leif done, see below."}'
kbpost POST /v1/me/mentions/read "{\"mentionIds\":[\"$MEN\"]}"
# …or clear everything at once when you've handled them all:
kbpost POST /v1/me/mentions/read '{"all":true}'
```

Rules that matter:
- **Listing never clears.** You only mark a mention read by POSTing to
  `…/mentions/read`. So "list → act → ack" is crash-safe: anything you didn't ack
  is still there next time. `?status=all` shows history (with `readAt`).
- **One mention per location.** `@claude` written 50× in one note = **one**
  mention; the same handle in the description *and* two notes = **three**. The
  `source` (`{kind, commentId}`) tells you exactly where.
- **Mentions track the live text.** If a human edits `@claude` out of a field, that
  mention disappears. The `excerpt` is always the current text.
- Respond **on the card** (a comment), not by replying in the mention API — the
  mention API is your inbox, the card timeline is where the conversation lives.

---

## 5. Example scenarios

### A. Human files a task → agent picks it up, works it, sends it to review
1. Leif creates a card in **Todo**: "Draft the tracking design doc", assigned to Claude.
2. Agent loop: `GET /me`, find project, resolve columns, `GET …/cards?assignee=u_claude&…` (or `?column=<Todo>`), find the card.
3. Agent reads `description` + `acceptanceCriteria`, then `PATCH` the card → `columnId = In Progress`.
4. Agent does the work.
5. Agent `PATCH` → `columnId = In Review`, then **POST a `handoff`** to the card's timeline with what shipped / how it was verified / what it spun off. The `description` stays a clean spec.
6. Leif reads the timeline (the handoff sits under the move event), verifies, and drags it to **Done** (or the agent moves it to Done if the human said "just finish it").

**Discovered work → a new card, not a note.** If, while working, you find unrelated work (a missing token, a follow-up fix), **create a card** for it and list its id in the handoff's `meta.spunOff` — don't bury it in prose.

### B. Agent files a task for a human
```bash
# Assign to Leif (look up his id first, don't hardcode across tenants):
LEIF=$(kbget $KB/v1/users | jq -r '.users[] | select(.name=="Leif") | .id')
kbpost POST /v1/projects/$PID/cards "{
  \"summary\":\"Approve the messaging guardrails\",
  \"description\":\"I drafted the claims allow/deny list — needs your sign-off.\",
  \"acceptanceCriteria\":\"Leif approves or edits the DENY list\",
  \"assigneeUserId\":\"$LEIF\"
}"
# Lands in the first column (Todo), gets an auto key (e.g. OBL-7). created_by = Claude.
```

### C. "What's on my plate?" / status sweep
```bash
# Everything assigned to me in a project (show the ticket key + summary):
kbget "$KB/v1/projects/$PID/cards?assignee=$ME" | jq -r '.cards[] | "\(.key)  \(.summary)  —  col:\(.columnId)"'
# Search by text (matches summary):
kbget "$KB/v1/projects/$PID/cards?q=tracking" | jq -r '.cards[] | "\(.key) \(.summary)"'
```

### D. Spin up a fresh board for a new workstream
```bash
# `code` is required — a 2–6 char ticket-key prefix (unique per tenant).
kbpost POST /v1/projects '{"name":"Landlord SEO v0.2","code":"LSEO","description":"Growth sprint"}' \
  | jq '{id:.project.id, code:.project.code, columns:[.columns[].name]}'
# → new project + code "LSEO"; its first ticket will be LSEO-1.
```

---

## 6. Conventions & etiquette

- **Reflect reality by moving cards.** If you start something, move it to In Progress immediately so the human sees it's being worked. Don't silently work a Todo card.
- **Read before you act.** A card's `description` + `acceptanceCriteria` are the spec. Meet the acceptance criteria before moving to In Review.
- **Hand off at In Review, not Done** — unless the human explicitly told you to finish end-to-end. In Review = "ready for a human to verify."
- **Assign deliberately.** Assign a card to the person/agent who should act next. Use `GET /v1/users` to resolve names → ids.
- **Report on the timeline, not in the description.** Progress notes, blockers, and results go to the card **timeline** (`POST …/comments`). The `description`/`acceptanceCriteria` are the **spec** — edit them only to change the plan, never to log what happened.
- **Write in markdown.** `description`, `acceptanceCriteria`, and comment/handoff bodies render as GFM in view mode — structure them with headings, lists, task lists, code blocks, tables, and links. The card **`summary`** (and the handoff `summary`/slots) stay plain text — keep them short, one line.
- **Don't hardcode ids across projects/tenants.** Resolve project ids, column ids, and user ids at runtime by name.

## 7. Gotchas / limits

- **Timeline is append-only — correct by adding, not editing.** There's no comment *edit*: to fix or update something, **post a follow-up comment**. The one exception is **redaction**: `DELETE /cards/{id}/comments/{commentId}` soft-deletes **your own** comment if it contains something that must not persist (a **leaked secret/token**, PII, or a wrong-card post). Redaction removes the content but leaves a *tombstone* (who removed it, when) — it doesn't erase history. You can only redact your **own** comments; **system events can't be redacted**. Deleting a card removes its whole timeline (and mentions). System events (create/move/assign/edit) are emitted automatically — you don't post those.
- **@-mention with `@handle`** (from `GET /v1/users` → `.handle`). An unknown handle or a mention of yourself is just text (no notification). Emails like `a@b.com` don't trigger a mention.
- No attachments, checklists, due dates, or reactions yet.
- No real-time push — re-fetch to see others' changes (the web board auto-refreshes every ~20s).
- Deleting a column requires it be empty (move its cards first) → otherwise `409`.
- Errors come back as `{ "error": "...", "details": {...} }` with a matching HTTP status (`400` validation, `401` bad/no token, `404` not found or not in your tenant, `409` conflict).
- A `404` on something you expected to exist usually means it belongs to a different tenant (scoping), or the id is wrong.

## 8. When in doubt

Fetch the live contract and inspect it:

```bash
curl -s https://kbrelay.lalalimited.com/api/openapi.json | jq '.paths | keys'
```

That's it — you now know enough to pick up and file work on kbRelay.
