import type { CardLinkDto } from '@kbrelay/shared';
import { providerGlyph, linkLabel } from '../lib/externalLinks';
import LinkIcon from './LinkIcon';

/** A card's external links as a compact list of outbound links, with an optional
 *  remove (✕) affordance. Mirrors AttachmentList's shape and styling. */
export default function LinkList({
  items,
  onDelete,
  canDelete,
}: {
  items: CardLinkDto[];
  onDelete?: (l: CardLinkDto) => void;
  /** Per-row gate for the ✕ (KBR-101: creator or admin only). Default: all. */
  canDelete?: (l: CardLinkDto) => boolean;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="link-list">
      {items.map((l) => {
        const glyph = providerGlyph(l.provider);
        return (
          <li key={l.id} className="link-item">
            <span className={`link-glyph lg-${glyph}`}>
              <LinkIcon glyph={glyph} />
            </span>
            <a
              className="link-name"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              title={l.url}
            >
              {linkLabel(l)}
            </a>
            <span className="link-provider">{l.provider}</span>
            {onDelete && (canDelete?.(l) ?? true) && (
              <button
                type="button"
                className="link-del"
                title="Remove link"
                aria-label={`Remove link ${linkLabel(l)}`}
                onClick={() => onDelete(l)}
              >
                ✕
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
