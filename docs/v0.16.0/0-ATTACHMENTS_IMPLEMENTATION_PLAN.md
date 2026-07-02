# v0.16.0 — Attachments (Implementation Plan)

Turns `0-ATTACHMENTS_DESIGN.md` into an ordered, reviewable ticket sequence. Each ticket is
a vertical-ish slice that compiles, tests green, and (where relevant) can be verified in the
running app. All migrations are additive and `t_lala`-safe.

**File-path anchors verified during the KBR-22 spike** (CONTEXT.md lags — real latest
migration is `0015`, so ours is `0016`):
- Runtime port: `apps/api/src/runtime/shared/db.ts` · CF bindings `runtime/cf/bindings.ts` ·
  Node bindings `runtime/node/bindings.ts` · env `apps/api/src/env.ts`
- Dispatch/RBAC: `runtime/shared/dispatch.ts` · `router.ts` · `auth/access.ts` ·
  coverage test `apps/api/src/access.test.ts`
- Repos: `db/repos/cards.ts`, `db/repos/card_events.ts` · ids `db/repos/`/`db/ids.ts`
- Migrations: `apps/api/migrations/00NN_*.sql` (next = `0016`)
- Shared: `packages/shared/src/{board,events,index}.ts` · OpenAPI `apps/api/src/openapi.ts`
  + parity test `openapi.test.ts`
- Web: `apps/web/src/lib/api.ts` · `components/{CardModal,Timeline,Markdown,CardItem}.tsx`
- Config: `apps/api/wrangler.toml` · `infrastructure/docker/.env.selfhost.example`
- Guards: `tools/check-no-{inline-db,cf-imports-in-node,node-imports-in-cf}.sh`

---

## Ticket sequence

### KBR-23 — Storage port + R2/filesystem adapters + config
**Backend foundation. No routes yet.**
- `runtime/shared/blob.ts`: `Blob`, `BlobPutOpts`, `BlobObject` interfaces (design §3).
- `env.ts`: add optional `blob?: Blob`.
- `runtime/cf/bindings.ts`: add `BLOB: R2Bucket` to `CfBindings`; build a thin R2-backed
  `Blob` in `buildCfBindings`.
- `runtime/node/fs-blob.ts`: filesystem `Blob` rooted at `BLOB_DIR` (default
  `/data/attachments`), `node:fs` only. `runtime/node/bindings.ts`: construct it from
  `process.env.BLOB_DIR`.
- `wrangler.toml`: `[[env.prod.r2_buckets]]` + `[[env.dev.r2_buckets]]` binding `BLOB`
  (buckets `kbrelay-attachments` / `-dev`, already created).
- `infrastructure/docker/.env.selfhost.example`: document `BLOB_DIR`.
- **AC:** builds on both runtimes; `make check-boundaries` green (no CF import leaks into
  node, no node import leaks into CF); a unit test round-trips put→get→delete against the
  fs adapter with a temp dir. No behavior change to existing routes.

### KBR-24 — Data layer: migration 0016 + repo + shared types + OpenAPI
- `migrations/0016_attachments.sql` (design §2, additive header per `0014/0015` convention).
- `packages/shared/src/attachments.ts`: `AttachmentKind`, `AttachmentDto`,
  `attachmentCountsSchema`; export from `index.ts`.
- `db/repos/attachments.ts`: `Row`→`toDto`; `insertAttachmentStmt(env, a)` (prepared, for
  atomic batching — `card_events.ts` pattern); `createAttachment`, `getAttachment`,
  `listCardAttachments`, `listCardAttachmentCounts`, `linkAttachmentsToEvent(ids, eventId)`,
  `deleteAttachment`. `classifyKind(contentType, filename)` helper.
- Cascade: extend `deleteCard` (delete attachment rows) and `redactComment` (delete that
  event's attachment rows) in their repos; return blob keys so the route can purge bytes.
- `openapi.ts`: `components.schemas.Attachment` (+ counts on the card list schema). Keep
  `openapi.test.ts` green (schemas only here; route paths land in KBR-25).
- **AC:** `make db-migrate-local` applies cleanly + additive; repo unit tests (create,
  classify, link-to-event, counts, cascade) green; `make test` + boundaries green.

### KBR-25 — Attachment API routes + RBAC scope + comment linkage + card enrichment
- `auth/access.ts`: add `kind:'attachment'` to `AccessScope`; resolve attachment→card→project
  in `resolveProjectId`.
- `routes/attachments.ts`: `POST /cards/:id/attachments` (multipart: parse, 413 >25MB,
  classify, `env.blob.put`, `createAttachment`, 201 DTO), `GET /attachments/:id`,
  `GET /attachments/:id/blob` (stream; inline for image/pdf else attachment; `?download=1`;
  `nosniff`; private cache), `DELETE /attachments/:id` (author or project-admin; row + blob).
  Graceful `503` when `env.blob` unset.
- `router.ts`: register the four routes with `access` scopes; **`openapi.ts` paths in the
  same commit** (parity test).
- Comment linkage: `createCommentInput` gains `attachmentIds?`; `addComment` batches
  `linkAttachmentsToEvent`.
- Card DTO: single-card GET returns `attachments`; board list returns `attachmentCounts`.
- **AC:** end-to-end over the API (curl/script): upload an image + a zip to a card, list,
  GET blob (right headers), delete; post a note with `attachmentIds` and confirm they link;
  wrong-tenant/no-access → 404; >25MB → 413. OpenAPI parity + `make test` green.

### KBR-26 — Web: attach on description + notes/handoffs
- `lib/api.ts`: `uploadAttachment`, `deleteAttachment`, `attachmentBlobUrl`; multipart path;
  comment-create sends `attachmentIds`.
- `CardModal.tsx`: attachment toolbar under the description (**+** + drag-drop), markdown
  injection (`![](url)` / `[📎 ](url)`), view-mode download strip.
- `Timeline.tsx`: composer **+** + drag-drop next to Note·Handoff tabs; collect uploaded ids
  → send on Post; render each entry's attachment download list.
- `Markdown.tsx`: `img` renderer scales attachment images (no `rehype-raw`).
- **AC (verify in running app):** drag an image into a description → inline render after
  save; **+** a PDF into a note → link renders + downloads; delete works; images inline,
  others download. Typecheck/lint/build green.

### KBR-27 — Web: board badges + Markdown polish
- `components/AttachmentBadges.tsx` + shared SVG glyph map (image/document/archive/misc).
- `CardItem.tsx`: right-justified badge row (counts by kind, hidden when zero) from
  `attachmentCounts`.
- Image sizing / link-glyph polish in `Markdown.tsx`.
- **AC:** a card with mixed attachments shows correct per-kind counts on the board; zero →
  no badges; build green.

### KBR-28 — Docs + production deploy + verification
- Docs: `.claude/CONTEXT.md` (note attachments + correct migration count), `USING_KBRELAY.md`
  (attachments in the card/DTO section), `packages/mcp/README.md` (get_card surfaces
  attachment metadata/URLs), `docs/v0.16.0/RELEASE_NOTES.md`.
- Deploy protocol: `wrangler d1 export` backup → `d1 migrations apply kbrelay --env prod
  --remote` → deploy Worker → deploy Pages → **prod smoke** (upload+download+delete an
  attachment on a throwaway card; confirm badge; confirm self-host build still boots).
- **AC:** feature live on `kbrelay.lalalimited.com`; prod smoke evidence on KBR-22; single
  clean commit (or per-ticket commits) on the branch.

---

## Sequencing / parallelism
- **Serial spine:** KBR-23 → 24 → 25 (each depends on the prior). 
- KBR-26 depends on 25 (needs the routes). KBR-27 depends on 25 (needs `attachmentCounts`)
  and can overlap KBR-26. KBR-28 is last (deploys everything).
- Every ticket keeps `make test` + `make check-boundaries` green and OpenAPI in parity.

## Risk register
- **Multipart in the Worker:** `request.formData()` is supported with `nodejs_compat`;
  stream the file part straight to `env.blob.put` (don't buffer the whole body).
- **fs adapter path traversal:** keys are server-built (`uuid` + `safeFilename`); still
  `path.resolve`-check that the final path stays under `BLOB_DIR`.
- **Boundary guards:** the S3/fs SDK + `node:fs` must stay under `runtime/node/**`; the R2
  types under `runtime/cf/**`. This is the most likely CI trip — verify early in KBR-23.
- **Parity test:** never add a route without its OpenAPI entry in the same commit.
