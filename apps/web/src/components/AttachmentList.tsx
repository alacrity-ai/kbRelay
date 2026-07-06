import { useState } from 'react';
import type { AttachmentDto } from '@kbrelay/shared';
import { attachmentBlobUrl } from '../lib/api';
import { formatBytes, isPreviewableAttachment } from '../lib/attachments';
import AttachmentIcon from './AttachmentIcon';
import AuthedDownloadLink from './AuthedDownloadLink';
import AttachmentPreviewModal from './AttachmentPreviewModal';

/** A card's attachments as a compact list of download links, with an optional
 *  remove (✕) affordance. Image (KBR-93) and markdown/txt (KBR-95) rows get a
 *  Preview button that opens the zoom/pan + markdown lightbox. */
export default function AttachmentList({
  items,
  onDelete,
  canDelete,
}: {
  items: AttachmentDto[];
  onDelete?: (a: AttachmentDto) => void;
  /** Per-row gate for the ✕ (KBR-101: uploader or admin only). Default: all. */
  canDelete?: (a: AttachmentDto) => boolean;
}) {
  const [preview, setPreview] = useState<AttachmentDto | null>(null);
  if (items.length === 0) return null;
  return (
    <>
    <ul className="attach-list">
      {items.map((a) => (
        <li key={a.id} className="attach-item">
          <span className={`attach-glyph ${a.kind}`}>
            <AttachmentIcon kind={a.kind} />
          </span>
          <AuthedDownloadLink className="attach-name" href={attachmentBlobUrl(a.id, true)} filename={a.filename}>
            {a.filename}
          </AuthedDownloadLink>
          <span className="attach-size">{formatBytes(a.sizeBytes)}</span>
          {isPreviewableAttachment(a) && (
            <button
              type="button"
              className="attach-preview"
              title={`Preview ${a.filename}`}
              aria-label={`Preview ${a.filename}`}
              onClick={() => setPreview(a)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
          {onDelete && (canDelete?.(a) ?? true) && (
            <button
              type="button"
              className="attach-del"
              title="Remove attachment"
              aria-label={`Remove ${a.filename}`}
              onClick={() => onDelete(a)}
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
    {preview && (
      <AttachmentPreviewModal
        items={items.filter(isPreviewableAttachment)}
        startId={preview.id}
        onClose={() => setPreview(null)}
      />
    )}
    </>
  );
}
