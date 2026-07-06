import type { CardLinkDto } from '@kbrelay/shared';
import { providerGlyph, linkLabel } from '../lib/externalLinks';
import LinkIcon from './LinkIcon';

/** A card's external links as a compact list of outbound links, with an optional
 *  remove (✕) affordance. Mirrors AttachmentList's shape and styling. */
export default function LinkList({
  items,
  onDelete,
}: {
  items: CardLinkDto[];
  onDelete?: (l: CardLinkDto) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="link-list">
      {items.map((l) => {
        const glyph = providerGlyph(l.provider);
        return (
          <li key={l.id} className="link-item">
            <span className={`link-glyph ${glyph}`}>
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
            {onDelete && (
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
