# kbRelay — v0.3.0 Implementation Plan: the card timeline

**Date:** 2026-07-01
**Companion to:** `0-PROBLEM_STATEMENT.md`
**Scope:** data-model + API + web (like v0.2.0). Additive migration `0004`.

---

## 0. Evaluation of the proposal

The problem statement is correct and the direction is right: **the log is not a
field, it's an append-only timeline.** A scalar `completion_notes` is correctly
rejected. I'm adopting the `card_events` table, the two endpoints, and
auto-emitted system events as the durable replacement for lossy `updated_by`.

Three technical corrections to the sketch, finalized below:

1. **Discriminator collision.** The sketch used `kind ∈ {comment, handoff,
   system}` in the table but `type ∈ {note, handoff}` on the POST — two names for
   the same axis. **Finalized:** a single discriminator **`kind ∈ {'system',
   'note', 'handoff'}`**. `note` and `handoff` are the two user-authored kinds
   (the `/comments` endpoint creates them); `system` is auto-emitted. `event_type`
   is meaningful **only** for `system` rows (`created | moved | assigned | edited`).
   This removes the ambiguity while keeping "post a comment" as the umbrella verb.

2. **Delete cascade.** The repo **explicitly cascades deletes** rather than trust
   D1 FK enforcement (`deleteProject` comment: *"which is not reliably on"*). So
   `ON DELETE CASCADE` in the DDL is documentation only — we must **explicitly
   delete `card_events`** in both `deleteCard` and `deleteProject`.

3. **Atomicity + field casing.** Card mutation and its system event(s) are written
   in **one `env.DB.batch([...])`** (the established pattern) so a move can't land
   without its event. DTO fields are **camelCase** (`spunOff`, not `spun_off`) to
   match every other DTO in the codebase; `meta_json` stores the camelCase object
   verbatim.

Deferrals in §4.3 / §5 of the problem statement (full link graph, comment
edit/delete, mentions/reactions/attachments, AC-checklist) are accepted as-is.

---

## 1. Data model — migration `0004_card_activity.sql`

Additive; no change to `cards`. Follows `0001_init.sql` conventions (denormalized
`tenant_id`, ms timestamps).

```sql
CREATE TABLE card_events (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id        TEXT NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id),   -- the acting user (always set in practice)
  kind           TEXT NOT NULL,               -- 'system' | 'note' | 'handoff'
  event_type     TEXT,                        -- system only: 'created'|'moved'|'assigned'|'edited'
  body           TEXT,                        -- markdown, for note/handoff
  meta_json      TEXT,                        -- JSON: system detail slots OR handoff slots
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_card_events_card ON card_events(card_id, created_at);
```

`meta_json` shapes:
- `system/moved`   → `{ "from": {id,name}, "to": {id,name} }`
- `system/assigned`→ `{ "from": userId|null, "to": userId|null }`
- `system/edited`  → `{ "fields": ["description","title", …] }`
- `system/created` → `{ "columnId": "…" }`
- `handoff`        → `{ summary?, evidence?:[], verify?:[], spunOff?:[] }`

---

## 2. Shared (`packages/shared`)

`board.ts` (or a new `events.ts`, exported from the barrel):

```ts
export type CardEventKind = 'system' | 'note' | 'handoff';
export type SystemEventType = 'created' | 'moved' | 'assigned' | 'edited';

export interface CardEventDto {
  id: string;
  cardId: string;
  authorUserId: string | null;
  kind: CardEventKind;
  eventType: SystemEventType | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  createdAt: number;
}

export const createCommentInput = z.object({
  type: z.enum(['note', 'handoff']).default('note'),
  body: z.string().trim().min(1).max(20_000),
  meta: z.object({
    summary: z.string().max(2_000).optional(),
    evidence: z.array(z.string().max(500)).max(50).optional(),
    verify:   z.array(z.string().max(500)).max(50).optional(),
    spunOff:  z.array(z.string().max(120)).max(50).optional(),
  }).strict().optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentInput>;
```

`meta` is only meaningful for `handoff`; it's ignored (stored null) for `note`.

---

## 3. API (`apps/api`)

**`db/repos/card_events.ts` (new)**
- `toDto(row)` — parse `meta_json` → object (null-safe).
- `listTimeline(env, tenantId, cardId)` → `SELECT * … WHERE card_id=? AND
  tenant_id=? ORDER BY created_at ASC, id ASC`. **Ascending** (a log reads
  oldest→newest; a comment sits directly under the event it follows; the composer
  lives at the bottom).
- `insertEventStmt(env, {tenantId, cardId, authorUserId, kind, eventType, body,
  meta})` → returns a **prepared statement** (not executed) so callers can compose
  it into a `batch()`. Generates `evt_…` id + `Date.now()`.
- `addComment(env, tenantId, cardId, userId, input)` → single insert; returns DTO.

**`db/repos/cards.ts` (emit system events)**
- `createCard`: `batch([ insert card, insertEventStmt(created) ])`.
- `patchCard`: compute a diff of `{column, assignee, edited-fields}` from
  `existing`; build `[ UPDATE card, …one insertEventStmt per changed axis ]` and
  `batch()` them. Move → `moved` (with from/to column id+name), assignee change →
  `assigned`, any of title/description/acceptance change → one `edited` with the
  field list. No-op patches emit nothing.
- `deleteCard`: `batch([ DELETE card_events WHERE card_id, DELETE card ])`.
- Column-name lookup for `moved` meta reuses a small `getColumnRow`-style read.

**`db/repos/projects.ts`**
- `deleteProject` batch gains a leading `DELETE FROM card_events WHERE tenant_id=?
  AND card_id IN (SELECT id FROM cards WHERE project_id=? AND tenant_id=?)`.

**`routes/cards.ts` (new handlers)**
- `handleListTimeline` — verify card in tenant (`getCard` → 404), return
  `{ events }`.
- `handleAddComment` — verify card in tenant; `parseJson(createCommentInput)`;
  `addComment(...)`; `201 { event }`. `note` stores `body`, null meta; `handoff`
  stores `body` + `meta`.

**`router.ts`**
```
GET  /api/v1/cards/:id/timeline   → handleListTimeline
POST /api/v1/cards/:id/comments   → handleAddComment
```

**`openapi.ts`** — add `CardEvent` schema; document both paths (+ request body for
comments) so the router↔spec parity test stays green.

---

## 4. Web (`apps/web`)

**`lib/api.ts`**
```ts
getTimeline = (cardId) => request<{ events: CardEventDto[] }>('GET', `/v1/cards/${cardId}/timeline`);
addComment  = (cardId, body: CreateCommentInput) => request<{ event: CardEventDto }>('POST', `/v1/cards/${cardId}/comments`, body);
```

**`components/Timeline.tsx` (new)** — given `cardId`, `users`:
- Fetches the timeline on mount and when `refreshKey` changes; re-fetches when the
  card's `updatedAt` changes (so an edit's system events appear).
- Renders each event by kind:
  - **system** → a compact line: icon + actor + phrase ("moved **Todo → In
    Review**", "assigned to **Leif**", "created", "edited description") + relative
    time.
  - **note** → a bubble: author avatar/name + time + body.
  - **handoff** → a highlighted card ("✅ Handoff from *Claude*") rendering
    `summary`, `evidence`, `verify`, `spunOff` lists when present, then `body`.
- **Composer** at the bottom: a textarea + a Note/Handoff segmented control; for
  Handoff, one extra "Summary" input. Posting calls `addComment`, clears, and
  bumps `refreshKey`. (Full structured handoffs — evidence/verify/spunOff arrays —
  are agent-posted via the API; the human composer covers body + summary.)

**`components/CardModal.tsx`** — in **view** mode, add a **Timeline** section below
provenance (only for an existing card). Read-first posture preserved: viewing is
passive; posting is an explicit button. Column names for `moved` events come from
the event meta (snapshot) with a live-columns fallback.

**`styles.css`** — timeline list, system-event line, comment bubble, handoff
highlight, composer.

---

## 5. Agent guide (`.claude/skills/USING_KBRELAY.md`)

- **Remove** the "there are no comments — put notes in the description / acceptance
  criteria" guidance (§5–6).
- **Add** the rule: *edit `description`/`acceptanceCriteria` only to change the
  plan; **post to the timeline** to report what happened; open a **new card** for
  work you discovered.*
- Document `GET /cards/:id/timeline` and `POST /cards/:id/comments` (with the
  `handoff` shape) in the endpoint table + working loop; show the AG-1 handoff as
  the worked example (post a handoff on the move to In Review instead of editing
  the description).

---

## 6. Verify + deploy

- `make typecheck && make lint && make test && make build` clean (extend the
  openapi parity expectations; add a shared zod test for `createCommentInput`).
- Local Miniflare smoke: create card (→ `created` event), move it (→ `moved`),
  reassign (→ `assigned`), edit (→ `edited`), `POST` a note and a handoff, `GET`
  the timeline (correct order + shapes), delete card (events gone).
- **Prod:** `make db-migrate-prod` → `make deploy-api-prod` → `make
  deploy-web-prod`. Verify live: openapi documents the two routes; a real
  timeline round-trip; health ok.
- `docs/v0.3.0/RELEASE_NOTES.md`.

## 7. Risk / rollback

Additive table + two additive endpoints; nothing existing changes shape. Rollback
= redeploy prior Worker + Pages; the unused table is inert. System-event volume is
a few rows per card; the `(card_id, created_at)` index keeps reads cheap.
