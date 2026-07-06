import type { LinkGlyph } from '../lib/externalLinks';

/** A clean line-icon per external-link glyph family (git / board / design / doc
 *  / link). Same drawing style, stroke, and sizing as AttachmentIcon so links
 *  and attachments read as one visual system. */
export default function LinkIcon({ glyph, size = 16 }: { glyph: LinkGlyph; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (glyph) {
    case 'git':
      // git-branch: two nodes on a line with a fork
      return (
        <svg {...p}>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      );
    case 'board':
      // kanban columns
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18" />
        </svg>
      );
    case 'design':
      // vector pen node
      return (
        <svg {...p}>
          <path d="M12 19 5 12l7-7 7 7-7 7Z" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...p}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    default:
      // chain-link
      return (
        <svg {...p}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
  }
}
