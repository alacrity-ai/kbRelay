# v0.16.0 — Attachments (Design)

**Status:** design complete · **Owner:** Claude (KBR-22) · **Depends on:** nothing (additive)

Attachments let a human or agent hang files off a card's **description**, a **note**,
or a **handoff**. Images render inline; everything else is a download link. Each card
surfaces an at-a-glance badge row of what's attached. The feature ships with **full
Cloudflare ↔ self-host parity**, mirroring kbRelay's existing `Db`-port split.

This document makes every product + engineering decision. The implementation plan
(`0-ATTACHMENTS_IMPLEMENTATION_PLAN.md`) turns it into ordered tickets.

---

## 1. Decisions up front (executive summary)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **CF backend = R2 via native Worker binding** (`BLOB`); **self-host backend = filesystem** under the existing `/data` volume. | Matches "Cloudflare's own blob storage." The cited reference (`home-app`) is **R2-only, no MinIO** — so MinIO was never actually the reference. Filesystem honors kbRelay's "one Node container" promise (SQLite already lives in `/data`) with zero extra infra. A MinIO/S3 adapter is a clean future drop-in behind the same port. |
| D2 | **A `Blob` port** in `runtime/shared/`, bound in both runtimes, exactly mirroring the `Db` port. | The whole app's portability is this one pattern (`runtime/shared/db.ts`). Attachments must not be the thing that breaks it. |
| D3 | **Proxied upload + download through the API** (multipart in, streamed out). **No presigned URLs.** | Same-origin: the session cookie / bearer already authorizes every request, so `<img src>` and download links "just work" with no signing. This is exactly home-app's model and it ports 1:1 to filesystem. Presigning is a future optimization, not needed for parity or correctness. |
| D4 | **First-class `attachments` table** keyed by `(tenant_id, card_id, event_id?)`. `event_id NULL` = attached to the card description; set = attached to that note/handoff. | Matches the discipline of every other kbRelay feature (a real table + atomic batch insert), and gives clean per-card and per-note aggregation for badges. |
| D5 | **ID-first upload, then reference-in-text.** Upload returns an `AttachmentDto` with a stable `url`; the editor injects `![name](url)` (image) or `[📎 name](url)` (other) into the markdown. | No orphan-in-text race, no markdown parsing to reconcile. Reuses the existing Markdown renderer — inline images fall out for free. |
| D6 | **Classify server-side into `image \| document \| archive \| misc`**; store `kind`. | The badge row and the inline-vs-link decision both need it; computing once server-side keeps client + API consistent. |
| D7 | **25 MB per-file cap; accept any type, no allow-list.** Block nothing, but serve safely (see §7). | The ticket wants archives + misc, so an allow-list is wrong. Safety comes from *how* we serve (never execute), not *what* we accept. |
| D8 | **MCP: read-only, for free.** `get_card` surfaces attachment metadata + URLs via the enriched DTO; no upload tool in v1. | Agents can *see* and link attachments; uploading a local file over MCP has no natural surface. Additive later if wanted. |

---

## 2. Data model

New migration **`0016_attachments.sql`** (additive-only, `t_lala`-safe — the live tenant
simply has zero attachment rows until one is created).

```sql
CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,                                        -- newId('att')
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  -- denormalized scope (kbRelay convention)
  card_id       TEXT NOT NULL REFERENCES cards(id)   ON DELETE CASCADE,  -- always card-scoped
  event_id      TEXT REFERENCES card_events(id)      ON DELETE CASCADE,  -- NULL = description; set = a note/handoff
  blob_key      TEXT NOT NULL,        -- object key in the bucket / path in the fs store
  filename      TEXT NOT NULL,        -- ORIGINAL name, for display + download filename
  content_type  TEXT NOT NULL,        -- MIME (browser-reported, sanitized)
  size_bytes    INTEGER NOT NULL,
  kind          TEXT NOT NULL,        -- 'image' | 'document' | 'archive' | 'misc'
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL      -- ms epoch (kbRelay convention)
);
CREATE INDEX idx_attachments_card  ON attachments(tenant_id, card_id);
CREATE INDEX idx_attachments_event ON attachments(event_id);
```

**Cascade discipline.** D1 does not reliably enforce FKs, so kbRelay deletes children
explicitly (see `deleteCard` in `db/repos/cards.ts`). We extend that:
- `deleteCard` must also `DELETE FROM attachments WHERE card_id=?` **and** delete each
  blob from storage (best-effort, via `ctx.waitUntil`).
- `redactComment` (soft-delete of a note/handoff) must **hard-delete that event's
  attachments** (row + blob) — a redaction removes content that must not persist, and a
  leaked file is exactly that. The tombstone remains; its files do not.

**Blob key convention** (tenant-prefixed, like home-app — enables list/delete-by-prefix):
```
attachments/{tenant_id}/{card_id}/{uuid}-{safeFilename}
```

---

## 3. Storage port (the parity seam)

New port `apps/api/src/runtime/shared/blob.ts`, shaped like R2's surface so the CF side is
a near-passthrough:

```ts
export interface Blob {
  put(key: string, body: ReadableStream | ArrayBuffer, opts: BlobPutOpts): Promise<void>;
  get(key: string): Promise<BlobObject | null>;   // null = not found
  delete(key: string): Promise<void>;
}
export interface BlobPutOpts { contentType: string; size?: number; }
export interface BlobObject { body: ReadableStream; contentType: string; size: number; }
```

Added to `Env` as `blob?: Blob` (`apps/api/src/env.ts`), **optional** so it degrades
gracefully exactly like `MAILGUN_*` — no store configured ⇒ upload routes return a clean
`503 attachments not configured`, the rest of the app is unaffected.

- **CF adapter** (`runtime/cf/bindings.ts`): wrap the `BLOB` R2 binding. `put` →
  `bucket.put(key, body, { httpMetadata: { contentType } })`; `get` → map
  `R2ObjectBody` → `BlobObject`; `delete` → `bucket.delete(key)`. Lives in `runtime/cf/`
  so `@cloudflare/*` types stay CF-only (boundary guard `check-no-cf-imports-in-node.sh`).
- **Node adapter** (`runtime/node/fs-blob.ts`): filesystem store rooted at
  `BLOB_DIR` (default `/data/attachments`). `put` streams to `${root}/${key}` (mkdir -p
  the parents), `get` returns a read stream + `statSync` size + a stored content-type
  sidecar (or re-derive from the row — we pass content-type from the DB on read, so the
  store needn't persist it). Uses `node:fs`, which is already node-only per
  `check-no-node-imports-in-cf.sh`. A future `s3-blob.ts` (MinIO/R2-S3) implements the
  same interface with `@aws-sdk/client-s3`.

**Boundary rule:** all blob access goes through `env.blob`, never a raw R2/fs handle in a
route — mirroring the "no inline `env.DB`" guard. (New guard optional; the review will
enforce it.)

---

## 4. API surface

All under the existing dispatcher (`runtime/shared/dispatch.ts`); every route authenticates
(bearer or session) then runs `enforceProjectAccess`.

| Method & path | Access scope | Purpose |
|---|---|---|
| `POST /api/v1/cards/:id/attachments` | `{ kind:'card', param:'id' }` | Upload (multipart `file`). Validates size/type, classifies, stores blob, inserts row (`event_id` NULL = card/description-scoped). Returns `AttachmentDto`. |
| `GET /api/v1/attachments/:id/blob` | `{ kind:'attachment', param:'id' }` | Stream the bytes back. `inline` for image/pdf, `attachment` otherwise; `?download=1` forces `attachment`. |
| `GET /api/v1/attachments/:id` | `{ kind:'attachment', param:'id' }` | The `AttachmentDto` (metadata only). |
| `DELETE /api/v1/attachments/:id` | `{ kind:'attachment', param:'id' }` | Delete row + blob. Author or a project admin. |

**New access scope.** Extend `AccessScope` (`auth/access.ts`) with `kind:'attachment'`
and teach `resolveProjectId` to resolve it:
`SELECT c.project_id FROM attachments a JOIN cards c ON a.card_id=c.id WHERE a.id=? AND a.tenant_id=?`.
No-access ⇒ 404 (kbRelay's existence-hiding convention). The `access.test.ts` coverage
test will force us to declare a scope on every new route.

**Comment linkage.** `POST /api/v1/cards/:id/comments` (existing) gains an optional
`attachmentIds: string[]`. On create, the handler sets `event_id` on those rows to the new
event's id, in the **same batch** as the event insert (`insertEventStmt` pattern in
`db/repos/card_events.ts`). Description attachments need no linkage step — they're created
card-scoped with `event_id` NULL and stay that way.

**Card DTO enrichment.**
- `GET /api/v1/cards/:id` → add `attachments: AttachmentDto[]` (all rows for the card,
  each with a `url` = `/api/v1/attachments/:id/blob`).
- `GET /api/v1/projects/:id/cards` (board list) → add `attachmentCounts:
  { image, document, archive, misc }` per card, from one grouped query — cheap, and it's
  all the board badge needs. (Full list only on single-card GET.)

**OpenAPI parity.** Every new route + `Attachment` schema goes into `openapi.ts` in the
same change, or `openapi.test.ts` fails CI.

**The one convention deviation:** upload is `multipart/form-data`, so it bypasses the
JSON-only `parseJson` helper on the API and the JSON-only `request<T>()` helper on the web
client. Both get a dedicated multipart path.

---

## 5. Upload / download flows

**Description attachment (in CardModal edit mode):**
1. User drops a file on the description textarea, or clicks the **+** in a new toolbar
   under it.
2. Client `POST …/cards/:id/attachments` → gets `{ id, url, kind, filename }`.
3. Client injects markdown at the cursor: image → `![filename](url)`, else →
   `[📎 filename](url)`.
4. Saving the description (existing `PATCH card`) persists the text. The attachment row is
   already card-scoped — nothing else to do.

**Note / handoff attachment (in Timeline composer):**
1. Same drop / **+** (placed next to the Note·Handoff tab row).
2. Same upload → markdown injection into the comment body.
3. On **Post**, the client sends `attachmentIds` alongside `{ type, body, meta }`; the
   server links them to the new event. Now they aggregate under that note.

**Download / view:** `GET /api/v1/attachments/:id/blob` streams the object with
`content-type` from the row, `content-disposition` inline (image/pdf) or attachment, plus
`X-Content-Type-Options: nosniff` and `cache-control: private, max-age=300`. Same-origin,
so the cookie/bearer rides along; no signing.

**Orphans (accepted tradeoff).** Uploading into a draft you then cancel leaves a
card-scoped attachment (it shows in the card's aggregate). v1 keeps this simple; the
delete affordance + visible attachment list let a user clean up. Background GC of
never-referenced uploads is out of scope (noted in §9).

---

## 6. Web UX

- **Board card badge** (`components/CardItem.tsx`): right of the assignee, a right-justified
  row of kind glyphs with counts, e.g. `🖼 2  📄 1  🗜 3`, from `attachmentCounts`. Hidden
  when zero. One new `AttachmentBadges` component + a shared glyph map
  (`image→🖼 / document→📄 / archive→🗜 / misc→📎`, rendered as clean inline SVGs, not emoji).
- **CardModal** (`components/CardModal.tsx`): edit mode gets an attachment toolbar under the
  description (**+** button + drag-drop target + a list of the description's current
  attachments with download glyphs). View mode renders inline images via `<Markdown>` and
  shows the same download strip.
- **Timeline** (`components/Timeline.tsx`): composer gets **+** + drag-drop; each
  `TimelineEntry` renders its comment's attachments (inline images already come from the
  markdown; a download-glyph list sits under the body, grouped from that event's rows).
- **Markdown** (`components/Markdown.tsx`): custom `img` renderer scales attachment images
  to a sane max (e.g. `max-width:100%; max-height:320px; border-radius`); keep
  **no `rehype-raw`** (raw HTML must stay inert — our XSS guarantee).
- **API client** (`lib/api.ts`): `uploadAttachment(cardId, file, onProgress?)` (multipart),
  `deleteAttachment(id)`, `attachmentBlobUrl(id)`. Comment-create gains `attachmentIds`.

---

## 7. Security

Ports home-app's model, hardened for the "accept anything" requirement:
- **AuthN/Z:** every route authenticates in the dispatcher; card/attachment `access`
  scopes gate by project RBAC (admin bypass; member needs a `project_access` row; else 404).
- **Isolation:** every repo query is `tenant_id`-scoped; the attachment access resolver
  joins back to the project, so you can't read another tenant's / another project's file.
- **Size:** 25 MB server-enforced → 413. **Type:** none blocked, but:
  - We **never execute** uploads: served with an explicit stored `content-type` +
    `X-Content-Type-Options: nosniff`, and `content-disposition: inline` **only** for
    `image/*` and `application/pdf` (everything else is `attachment`).
  - Markdown rendering has **no raw-HTML pass** (`Markdown.tsx` uses no `rehype-raw`), so a
    filename or a text file's contents can't inject script.
- **Filename safety:** `safeFilename()` sanitizes the key segment; the original is stored
  for display; `content-disposition` strips quotes.
- **Redaction:** redacting a comment hard-deletes its attachments' bytes (see §2).

---

## 8. Config / deploy

- **CF:** `wrangler.toml` gains `[[env.prod.r2_buckets]]` binding `BLOB` →
  `kbrelay-attachments`, and the `dev` equivalent → `kbrelay-attachments-dev`.
  **Both buckets already exist** (created during this spike). Surface `BLOB` in
  `runtime/cf/bindings.ts`.
- **Self-host:** `BLOB_DIR` (default `/data/attachments`) in
  `infrastructure/docker/.env.selfhost.example`; read in `runtime/node/bindings.ts`. Lives
  in the existing `kbrelay-data` volume — no new container, no new volume.
- **Migration to prod:** additive `0016` via the standard protocol (D1 export backup →
  `d1 migrations apply --env prod --remote` → deploy Worker → deploy Pages → verify).
  Self-host applies the identical SQL through `scripts/migrate-libsql.ts` on boot.

---

## 9. Out of scope (v1)

- MinIO/S3 self-host adapter (port is ready for it; filesystem ships first).
- Presigned direct-to-storage upload/download (proxy is correct for parity now).
- Background GC of never-referenced ("orphan") uploads.
- MCP **upload** tool (read-only metadata ships via the enriched DTO).
- Image thumbnailing / transforms, virus scanning, per-file access grants beyond project
  RBAC, drag-to-reorder attachments, paste-from-clipboard (nice-to-have, easy follow-on).
