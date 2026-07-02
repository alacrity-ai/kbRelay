import { MAX_ATTACHMENT_BYTES } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, HttpError } from '../http';
import { tenantScope } from '../auth/tenant-scope';
import { getCard } from '../db/repos/cards';
import {
  classifyKind,
  attachmentBlobKey,
  newAttachmentId,
  createAttachment,
  getAttachment,
  getAttachmentRow,
  deleteAttachmentStmt,
  purgeBlobs,
} from '../db/repos/attachments';

/**
 * Attachment routes (v0.16.0). Upload is multipart (streamed straight to blob
 * storage); download/view is a proxied stream (same-origin, so the cookie/bearer
 * authorizes it — no signed URLs). RBAC: the upload is card-scoped; the rest use
 * the `attachment` access scope (attachment → card → project) declared in the
 * router. See docs/v0.16.0/0-ATTACHMENTS_DESIGN.md §4/§5/§7.
 */

/** POST /api/v1/cards/:id/attachments — upload one file (multipart `file`). */
export async function handleUploadAttachment(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  if (!ctx.env.blob) throw new HttpError(503, 'Attachments are not configured');

  const card = await getCard(ctx.env, tenantId, ctx.params.id!);
  if (!card) throw new HttpError(404, 'Card not found');

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    throw new HttpError(415, 'Expected multipart/form-data with a `file` part');
  }
  const entry = form.get('file');
  // A real upload is a File part (not a text field). Cast to the shape we use —
  // workers-types and Node both back this with a File/Blob at runtime.
  if (!entry || typeof entry === 'string') throw new HttpError(400, 'Missing `file` part');
  const file = entry as unknown as { size: number; type: string; name: string; stream(): ReadableStream };
  if (file.size === 0) throw new HttpError(400, 'Empty file');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new HttpError(413, 'File too large (max 25 MB)');

  const filename = file.name || 'file';
  const contentType = file.type || 'application/octet-stream';
  const kind = classifyKind(contentType, filename);
  const id = newAttachmentId();
  const blobKey = attachmentBlobKey(tenantId, card.id, id, filename);

  // Stream the bytes straight into storage (never buffer the whole body).
  await ctx.env.blob.put(blobKey, file.stream(), { contentType, size: file.size });

  const attachment = await createAttachment(ctx.env, {
    id,
    tenantId,
    cardId: card.id,
    blobKey,
    filename,
    contentType,
    sizeBytes: file.size,
    kind,
    createdBy: userId,
  });
  return jsonResponse(201, { attachment }, ctx.cors);
}

/** GET /api/v1/attachments/:id — the attachment's metadata (no bytes). */
export async function handleGetAttachment(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  const attachment = await getAttachment(ctx.env, tenantId, ctx.params.id!);
  if (!attachment) throw new HttpError(404, 'Attachment not found');
  return jsonResponse(200, { attachment }, ctx.cors);
}

/** GET /api/v1/attachments/:id/blob — stream the bytes back. */
export async function handleGetAttachmentBlob(ctx: RouteContext): Promise<Response> {
  const { tenantId } = tenantScope(ctx.auth);
  if (!ctx.env.blob) throw new HttpError(503, 'Attachments are not configured');

  const row = await getAttachmentRow(ctx.env, tenantId, ctx.params.id!);
  if (!row) throw new HttpError(404, 'Attachment not found');
  const obj = await ctx.env.blob.get(row.blob_key);
  if (!obj) throw new HttpError(404, 'Attachment bytes missing');

  // Render images + PDFs inline; force download for everything else (and when
  // ?download=1). nosniff so the browser can't reinterpret the declared type.
  const forceDownload = ctx.url.searchParams.get('download') === '1';
  const inline = !forceDownload && (row.content_type.startsWith('image/') || row.content_type === 'application/pdf');
  const safe = row.filename.replace(/"/g, '');

  return new Response(obj.body, {
    status: 200,
    headers: {
      ...ctx.cors,
      'content-type': row.content_type,
      'content-length': String(row.size_bytes),
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${safe}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=300',
    },
  });
}

/** DELETE /api/v1/attachments/:id — uploader or a tenant admin. */
export async function handleDeleteAttachment(ctx: RouteContext): Promise<Response> {
  const { tenantId, userId } = tenantScope(ctx.auth);
  const row = await getAttachmentRow(ctx.env, tenantId, ctx.params.id!);
  if (!row) throw new HttpError(404, 'Attachment not found');
  if (row.created_by !== userId && ctx.auth?.role !== 'admin') {
    throw new HttpError(403, 'Only the uploader or an admin can delete this attachment');
  }
  await ctx.env.db.batch([deleteAttachmentStmt(ctx.env, tenantId, row.id)]);
  await purgeBlobs(ctx.env, [row.blob_key]);
  return jsonResponse(200, { ok: true }, ctx.cors);
}
