import { createContext } from 'react';

/**
 * Ticket-key autolinking (v0.17.0, KBR-65).
 *
 * A ticket key is `<project code>-<seq>` (e.g. `KBR-12`). Codes are 2–6
 * alphanumerics stored uppercased (shared `projectCode` schema). Keys are only
 * linkified when the code belongs to a project the signed-in user can access —
 * an unknown or inaccessible code stays plain text, so nothing leaks and
 * nothing renders as a dead link.
 */
export const TICKET_KEY_RE = /\b([A-Z0-9]{2,6})-(\d{1,7})\b/g;

// Segments that must never be linkified: fenced code, inline code, an existing
// markdown link (its label or target), or a bare URL (GFM autolinks those).
// Split-with-capture puts protected segments at odd indices.
const PROTECTED_RE = /(```[\s\S]*?```|`[^`]*`|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+)/g;

/** Sentinel href for a ticket-key link; the Markdown `a` renderer intercepts it. */
export const cardHref = (key: string): string => `#card-${key}`;

/**
 * Rewrite accessible ticket keys into markdown links with a `#card-…` sentinel
 * href. Pure + render-only: the stored text is never changed.
 */
export function linkifyTicketKeys(text: string, codes: ReadonlySet<string>): string {
  if (!text || codes.size === 0) return text;
  return text
    .split(PROTECTED_RE)
    .map((seg, i) => {
      if (i % 2 === 1 || !seg) return seg;
      return seg.replace(TICKET_KEY_RE, (whole, code: string) =>
        codes.has(code) ? `[${whole}](${cardHref(whole)})` : whole,
      );
    })
    .join('');
}

export interface CardLinks {
  /** Codes of the projects the signed-in user can access — the linkify gate. */
  codes: ReadonlySet<string>;
  /** Open a card by ticket key (cross-project). No-op if it can't be resolved. */
  openCard: (key: string) => void;
}

/**
 * Provided by BoardApp; consumed by Markdown (and the Timeline handoff slots)
 * so ticket keys deep down the tree become clickable without prop-threading.
 * Null (e.g. in guides or logged-out surfaces) disables linkification.
 */
export const CardLinksContext = createContext<CardLinks | null>(null);
