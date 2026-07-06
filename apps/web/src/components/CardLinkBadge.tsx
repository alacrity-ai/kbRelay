import LinkIcon from './LinkIcon';

/** External-link count badge on a board card — a small 🔗 line-icon + count.
 *  Styled to match AttachmentBadges (same size, weight, spacing). Renders
 *  nothing when the card has no links. */
export default function CardLinkBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="link-badge" title={`${count} external link${count > 1 ? 's' : ''}`}>
      <LinkIcon glyph="link" size={13} />
      {count}
    </span>
  );
}
