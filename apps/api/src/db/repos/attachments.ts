import type { Env } from '../../env';
import type { DbStatement } from '../../runtime/shared/db';
import type { AttachmentDto, AttachmentKind, AttachmentCounts } from '@kbrelay/shared';
import { EMPTY_ATTACHMENT_COUNTS } from '@kbrelay/shared';
import { newId } from '../ids';

interface AttachmentRow {
  id: string;
  tenant_id: string;
  card_id: string;
  event_id: string | null;
  blob_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: string;
  created_by: string;
  created_at: number;
}

/** The bytes-streaming URL for an attachment (same-origin; cookie/bearer rides along). */
export function attachmentUrl(id: string): string {
  return `/api/v1/attachments/${id}/blob`;
}

function toDto(r: AttachmentRow): AttachmentDto {
  return {
    id: r.id,
    cardId: r.card_id,
    eventId: r.event_id,
    filename: r.filename,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    kind: r.kind as AttachmentKind,
    createdBy: r.created_by,
    createdAt: r.created_at,
    url: attachmentUrl(r.id),
  };
}

// ── classification + key building ──────────────────────────────
const ARCHIVE_MIME = /(zip|x-7z|x-rar|x-tar|gzip|x-bzip2|x-xz|compressed)/;
const ARCHIVE_EXT = /\.(zip|7z|rar|tar|gz|tgz|bz2|xz)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif|ico|tiff?)$/i;
const DOC_MIME = /^(application\/pdf|application\/msword|application\/vnd\.(openxmlformats|ms-|oasis)|application\/rtf|application\/json|text\/)/;
const DOC_EXT = /\.(pdf|md|markdown|txt|csv|tsv|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|json|log|xml|yaml|yml)$/i;

/** Classify an upload into the four board-badge buckets. Order matters: an image
 *  or archive MIME/extension wins before the broad document/text bucket. */
export function classifyKind(contentType: string, filename: string): AttachmentKind {
  const ct = (contentType || '').toLowerCase();
  const fn = (filename || '').toLowerCase();
  if (ct.startsWith('image/') || IMAGE_EXT.test(fn)) return 'image';
  if (ARCHIVE_MIME.test(ct) || ARCHIVE_EXT.test(fn)) return 'archive';
  if (DOC_MIME.test(ct) || DOC_EXT.test(fn)) return 'document';
  return 'misc';
}

/** Sanitize a filename into a safe blob-key segment (lowercase, [a-z0-9._-]). */
export function safeFilename(name: string): string {
  const base = (name || 'file').split(/[\\/]/).pop() ?? 'file';
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 100);
  return clean || 'file';
}

/** Tenant/card-prefixed object key: `attachments/{tenant}/{card}/{id}-{safeName}`. */
export function attachmentBlobKey(tenantId: string, cardId: string, id: string, filename: string): string {
  return `attachments/${tenantId}/${cardId}/${id}-${safeFilename(filename)}`;
}

/** Fresh attachment id (call before building the blob key, so the key embeds it). */
export function newAttachmentId(): string {
  return newId('att');
}

// ── writes ─────────────────────────────────────────────────────
export interface AttachmentInsert {
  id: string;
  tenantId: string;
  cardId: string;
  eventId?: string | null;
  blobKey: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  createdBy: string;
}

/** Prepared INSERT (unexecuted) so it can be composed into a batch. */
export function insertAttachmentStmt(env: Env, a: AttachmentInsert): DbStatement {
  return env.db.prepare(
    `INSERT INTO attachments
       (id, tenant_id, card_id, event_id, blob_key, filename, content_type, size_bytes, kind, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    a.id,
    a.tenantId,
    a.cardId,
    a.eventId ?? null,
    a.blobKey,
    a.filename,
    a.contentType,
    a.sizeBytes,
    a.kind,
    a.createdBy,
    Date.now(),
  );
}

/** Insert an attachment row (bytes must already be in blob storage) → DTO. */
export async function createAttachment(env: Env, a: AttachmentInsert): Promise<AttachmentDto> {
  await env.db.batch([insertAttachmentStmt(env, a)]);
  const row = await getAttachmentRow(env, a.tenantId, a.id);
  if (!row) throw new Error('Attachment insert did not return row');
  return toDto(row);
}

/**
 * Link a set of (card-scoped, currently unlinked) attachments to a timeline
 * event. Returns a prepared UPDATE to compose into the comment's batch, or null
 * if there's nothing to link. Constrained to the same card + `event_id IS NULL`
 * so it can never steal another card's or an already-linked attachment.
 */
export function linkAttachmentsToEventStmt(
  env: Env,
  tenantId: string,
  cardId: string,
  eventId: string,
  ids: string[],
): DbStatement | null {
  if (!ids.length) return null;
  const placeholders = ids.map(() => '?').join(', ');
  return env.db.prepare(
    `UPDATE attachments SET event_id = ?
      WHERE tenant_id = ? AND card_id = ? AND event_id IS NULL AND id IN (${placeholders})`,
  ).bind(eventId, tenantId, cardId, ...ids);
}

// ── reads ──────────────────────────────────────────────────────
export async function getAttachmentRow(env: Env, tenantId: string, id: string): Promise<AttachmentRow | null> {
  return env.db.prepare('SELECT * FROM attachments WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<AttachmentRow>();
}

export async function getAttachment(env: Env, tenantId: string, id: string): Promise<AttachmentDto | null> {
  const row = await getAttachmentRow(env, tenantId, id);
  return row ? toDto(row) : null;
}

/** All attachments for a card, oldest → newest. */
export async function listCardAttachments(env: Env, tenantId: string, cardId: string): Promise<AttachmentDto[]> {
  const rs = await env.db.prepare(
    'SELECT * FROM attachments WHERE tenant_id = ? AND card_id = ? ORDER BY created_at ASC, id ASC',
  )
    .bind(tenantId, cardId)
    .all<AttachmentRow>();
  return (rs.results ?? []).map(toDto);
}

/**
 * Per-kind attachment counts for a set of cards, in one grouped query — for the
 * board list badges. Cards with no attachments are simply absent from the map;
 * callers default them to EMPTY_ATTACHMENT_COUNTS.
 */
export async function attachmentCountsForCards(
  env: Env,
  tenantId: string,
  cardIds: string[],
): Promise<Record<string, AttachmentCounts>> {
  const out: Record<string, AttachmentCounts> = {};
  if (!cardIds.length) return out;
  const placeholders = cardIds.map(() => '?').join(', ');
  const rs = await env.db.prepare(
    `SELECT card_id, kind, COUNT(*) AS n
       FROM attachments
      WHERE tenant_id = ? AND card_id IN (${placeholders})
      GROUP BY card_id, kind`,
  )
    .bind(tenantId, ...cardIds)
    .all<{ card_id: string; kind: string; n: number }>();
  for (const r of rs.results ?? []) {
    const counts = (out[r.card_id] ??= { ...EMPTY_ATTACHMENT_COUNTS });
    if (r.kind in counts) counts[r.kind as AttachmentKind] = Number(r.n);
  }
  return out;
}

/** Counts for a single card. */
export async function attachmentCountsForCard(env: Env, tenantId: string, cardId: string): Promise<AttachmentCounts> {
  const map = await attachmentCountsForCards(env, tenantId, [cardId]);
  return map[cardId] ?? { ...EMPTY_ATTACHMENT_COUNTS };
}

// ── deletes + cascade helpers ──────────────────────────────────
export async function blobKeysForCard(env: Env, tenantId: string, cardId: string): Promise<string[]> {
  const rs = await env.db.prepare('SELECT blob_key FROM attachments WHERE tenant_id = ? AND card_id = ?')
    .bind(tenantId, cardId)
    .all<{ blob_key: string }>();
  return (rs.results ?? []).map((r) => r.blob_key);
}

export async function blobKeysForEvent(env: Env, tenantId: string, eventId: string): Promise<string[]> {
  const rs = await env.db.prepare('SELECT blob_key FROM attachments WHERE tenant_id = ? AND event_id = ?')
    .bind(tenantId, eventId)
    .all<{ blob_key: string }>();
  return (rs.results ?? []).map((r) => r.blob_key);
}

export function deleteAttachmentsForCardStmt(env: Env, tenantId: string, cardId: string): DbStatement {
  return env.db.prepare('DELETE FROM attachments WHERE tenant_id = ? AND card_id = ?').bind(tenantId, cardId);
}

export function deleteAttachmentsForEventStmt(env: Env, tenantId: string, eventId: string): DbStatement {
  return env.db.prepare('DELETE FROM attachments WHERE tenant_id = ? AND event_id = ?').bind(tenantId, eventId);
}

/** All blob keys for a whole project's cards — gather BEFORE deleting rows so the
 *  bytes can be purged afterwards (KBR-43). */
export async function blobKeysForProject(env: Env, tenantId: string, projectId: string): Promise<string[]> {
  const rs = await env.db.prepare(
    `SELECT blob_key FROM attachments
      WHERE tenant_id = ? AND card_id IN (SELECT id FROM cards WHERE project_id = ? AND tenant_id = ?)`,
  ).bind(tenantId, projectId, tenantId).all<{ blob_key: string }>();
  return (rs.results ?? []).map((r) => r.blob_key);
}

export function deleteAttachmentsForProjectStmt(env: Env, tenantId: string, projectId: string): DbStatement {
  return env.db.prepare(
    `DELETE FROM attachments
      WHERE tenant_id = ? AND card_id IN (SELECT id FROM cards WHERE project_id = ? AND tenant_id = ?)`,
  ).bind(tenantId, projectId, tenantId);
}

export function deleteAttachmentStmt(env: Env, tenantId: string, id: string): DbStatement {
  return env.db.prepare('DELETE FROM attachments WHERE tenant_id = ? AND id = ?').bind(tenantId, id);
}

/**
 * Purge blob bytes for a set of keys (idempotent — a missing key is not an
 * error). The DB rows are already gone by the time this runs, so callers should
 * run it OFF the response path via `ctx.waitUntil` (KBR-41): it never blocks the
 * delete, and a big card/board doesn't stall the request.
 *
 * Hardening: deletes run with bounded concurrency (not one-at-a-time) with a
 * single retry per key. Any keys that still fail are logged with a stable prefix
 * so orphaned bytes are recoverable (grep logs / future reconciliation sweep) —
 * a dead-letter table would be the next step if leaks prove common, but that's a
 * schema change we don't need for this best-effort cleanup.
 */
const PURGE_CONCURRENCY = 12;
export async function purgeBlobs(env: Env, keys: string[]): Promise<void> {
  if (!env.blob || !keys.length) return;
  const blob = env.blob;
  const queue = [...keys];
  const failed: string[] = [];

  async function worker(): Promise<void> {
    for (let key = queue.pop(); key !== undefined; key = queue.pop()) {
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          await blob.delete(key);
          ok = true;
        } catch {
          /* retry once, then give up on this key */
        }
      }
      if (!ok) failed.push(key);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PURGE_CONCURRENCY, keys.length) }, () => worker()),
  );
  if (failed.length) {
    console.error(`[purgeBlobs] orphaned ${failed.length}/${keys.length} blob(s) after retry:`, failed.join(', '));
  }
}
