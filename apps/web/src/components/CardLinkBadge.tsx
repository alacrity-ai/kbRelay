/** External-link count badge on a board card — a small 🔗 + count. Renders
 *  nothing when the card has no links. */
export default function CardLinkBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="link-badge" title={`${count} external link${count > 1 ? 's' : ''}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {count}
    </span>
  );
}
