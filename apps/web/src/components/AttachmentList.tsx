import type { AttachmentDto } from '@kbrelay/shared';
import { attachmentBlobUrl } from '../lib/api';
import { formatBytes } from '../lib/attachments';
import AttachmentIcon from './AttachmentIcon';

/** A card's attachments as a compact list of download links, with an optional
 *  remove (✕) affordance. */
export default function AttachmentList({
  items,
  onDelete,
}: {
  items: AttachmentDto[];
  onDelete?: (a: AttachmentDto) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="attach-list">
      {items.map((a) => (
        <li key={a.id} className="attach-item">
          <span className={`attach-glyph ${a.kind}`}>
            <AttachmentIcon kind={a.kind} />
          </span>
          <a className="attach-name" href={attachmentBlobUrl(a.id, true)} download={a.filename}>
            {a.filename}
          </a>
          <span className="attach-size">{formatBytes(a.sizeBytes)}</span>
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
  );
}
