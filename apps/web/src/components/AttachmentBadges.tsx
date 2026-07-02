import type { AttachmentCounts, AttachmentKind } from '@kbrelay/shared';
import AttachmentIcon from './AttachmentIcon';

const ORDER: AttachmentKind[] = ['image', 'document', 'archive', 'misc'];

/** Right-justified per-kind attachment count badges on a board card (v0.16.0).
 *  Renders nothing when there are no attachments. */
export default function AttachmentBadges({ counts }: { counts?: AttachmentCounts }) {
  if (!counts) return null;
  const shown = ORDER.filter((k) => counts[k] > 0);
  if (shown.length === 0) return null;
  return (
    <span className="attach-badges">
      {shown.map((k) => (
        <span key={k} className={`attach-badge ${k}`} title={`${counts[k]} ${k}${counts[k] > 1 ? 's' : ''}`}>
          <AttachmentIcon kind={k} size={13} />
          {counts[k]}
        </span>
      ))}
    </span>
  );
}
