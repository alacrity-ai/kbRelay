# v0.16.0 — File Attachments

Hang files off a card's **description**, a **note**, or a **handoff**. Images render
inline; everything else is a download link. Each card shows an at-a-glance badge row
of what's attached. Full Cloudflare ↔ self-host parity.

Design + plan: `docs/v0.16.0/0-ATTACHMENTS_DESIGN.md`,
`docs/v0.16.0/0-ATTACHMENTS_IMPLEMENTATION_PLAN.md`.

## Highlights

- **Storage `BlobStore` port** mirroring the `Db` port, with two adapters:
  - **Cloudflare:** R2 via the native `BLOB` binding (bucket `kbrelay-attachments`).
  - **Self-host:** a filesystem store under `BLOB_DIR` (default `/data/attachments`,
    in the existing data volume). A MinIO/S3 adapter is a future drop-in behind the
    same port. (`home-app`, the cited reference, turned out to be R2-only — so MinIO
    was never the established pattern; filesystem keeps the "one Node container"
    self-host promise with zero extra infra.)
- **Proxied upload + download** — multipart in, streamed out; same-origin so the
  session/bearer authorizes `<img src>` and download links with no signed URLs.
- **Data model** — `attachments` table (migration `0016`, additive), keyed by
  `(tenant, card, event?)`: `event_id` null = on the description, set = on that
  note/handoff. Server-side `kind` classification (image/document/archive/misc).
- **Security** — 25 MB cap; accept any type but never execute (explicit content-type
  + `nosniff`, inline only for image/pdf, no raw-HTML markdown); project-RBAC scoped
  (attachment → card → project, 404 on no-access); redacting a comment hard-deletes
  its attachment bytes; deleting a card purges its attachments.

## API

- `POST /api/v1/cards/:id/attachments` — upload (multipart `file`, ≤25 MB) → `AttachmentDto`.
- `GET /api/v1/attachments/:id` — metadata; `GET /api/v1/attachments/:id/blob` — bytes
  (inline for image/pdf, else attachment; `?download=1` forces download).
- `DELETE /api/v1/attachments/:id` — uploader or admin.
- `GET /api/v1/cards/:id` now returns `attachments[]`; the board list returns
  `attachmentCounts`; `POST …/comments` accepts `attachmentIds`.
- MCP `get_card` surfaces attachment metadata + URLs.

## Web

- Attachment toolbar (+ button + drag-drop) under the card description and in the
  note/handoff composer; uploads inject markdown and (for comments) link on post.
- Inline image rendering (scaled) + download links via the Markdown renderer.
- View-mode attachment strip (download / remove) and per-kind board card badges.

## Migration / deploy

- `0016_attachments.sql` — additive; the live `t_lala` tenant has zero attachments
  until one is created. Applied to prod D1 and self-host via the same SQL.
- New R2 buckets: `kbrelay-attachments` (prod), `kbrelay-attachments-dev`.
- `wrangler.toml` gains the `BLOB` R2 binding; `.env.selfhost.example` documents `BLOB_DIR`.

## Deferred

MinIO/S3 self-host adapter, presigned direct-to-storage transfer, orphan-upload GC,
MCP upload tool, thumbnailing/virus-scan, clipboard paste, drag-to-reorder.
