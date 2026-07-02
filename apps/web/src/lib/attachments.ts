import type { AttachmentDto, AttachmentKind } from '@kbrelay/shared';
import { attachmentBlobUrl } from './api';

/** Markdown injected into a text field when an attachment is added: images render
 *  inline; everything else becomes a labelled download link. */
export function attachmentMarkdown(a: AttachmentDto): string {
  const url = attachmentBlobUrl(a.id);
  return a.kind === 'image' ? `![${a.filename}](${url})` : `[📎 ${a.filename}](${url})`;
}

/** Compact byte size, e.g. "12 KB", "1.4 MB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const KIND_LABEL: Record<AttachmentKind, string> = {
  image: 'image',
  document: 'document',
  archive: 'archive',
  misc: 'file',
};

/**
 * Remove an attachment's markdown reference (`![…](…/attachments/ID/blob)` or
 * `[…](…/attachments/ID/blob)`) from a text field when the attachment is
 * deleted, replacing it with a small marker so the description doesn't keep a
 * dangling image/link (KBR-34).
 */
export function stripAttachmentMarkdown(text: string | null | undefined, attachmentId: string): string {
  if (!text) return text ?? '';
  const re = new RegExp(`!?\\[[^\\]]*\\]\\(/api/v1/attachments/${attachmentId}/blob\\)`, 'g');
  return text.replace(re, '_🗑 attachment removed_');
}
