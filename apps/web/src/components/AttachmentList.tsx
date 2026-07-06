import { useState } from 'react';
import type { AttachmentDto } from '@kbrelay/shared';
import { attachmentBlobUrl } from '../lib/api';
import { formatBytes } from '../lib/attachments';
import AttachmentIcon from './AttachmentIcon';
import AuthedDownloadLink from './AuthedDownloadLink';
import ImagePreviewModal from './ImagePreviewModal';

/** A card's attachments as a compact list of download links, with an optional
 *  remove (✕) affordance. Image rows get a Preview button that opens a
 *  zoom/pan lightbox (KBR-93). */
export default function AttachmentList({
  items,
  onDelete,
}: {
  items: AttachmentDto[];
  onDelete?: (a: AttachmentDto) => void;
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
          {a.kind === 'image' && (
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
          {onDelete && (
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
      <ImagePreviewModal
        images={items.filter((a) => a.kind === 'image')}
        startId={preview.id}
        onClose={() => setPreview(null)}
      />
    )}
    </>
  );
}
