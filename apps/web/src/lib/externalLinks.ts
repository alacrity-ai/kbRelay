/** Helpers for the external card-links UI (KBR-91). The API stores a free-text
 *  `provider`; when a human just pastes a URL we derive a sensible one from the
 *  hostname so they don't have to think about it, and we pick a matching glyph
 *  family so links read like the attachment list rather than a raw emoji. */

/** Map a URL to a provider slug. Known hosts get a friendly name; everything
 *  else falls back to the bare hostname (sans `www.`), or `"link"` if the URL
 *  can't be parsed. Matches the free-text `provider` convention agents use. */
export function deriveProvider(url: string): string {
  let host: string;
  try {
    host = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'link';
  }
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) return 'gitlab';
  if (host.endsWith('.atlassian.net') || host === 'jira.com') return 'jira';
  if (host === 'linear.app') return 'linear';
  if (host === 'notion.so' || host.endsWith('.notion.so') || host === 'notion.site') return 'notion';
  if (host === 'figma.com' || host.endsWith('.figma.com')) return 'figma';
  if (host === 'docs.google.com' || host === 'drive.google.com') return 'google';
  return host || 'link';
}

/** Glyph family for a provider — a small, fixed set of line-icons (see LinkIcon)
 *  so the palette stays as tidy as the attachment kinds. */
export type LinkGlyph = 'git' | 'board' | 'design' | 'doc' | 'link';

export function providerGlyph(provider: string): LinkGlyph {
  switch (provider) {
    case 'github':
    case 'gitlab':
      return 'git';
    case 'jira':
    case 'linear':
      return 'board';
    case 'figma':
      return 'design';
    case 'notion':
    case 'google':
      return 'doc';
    default:
      return 'link';
  }
}

/** What to show as the link's text: the human title, else its external key,
 *  else a trimmed URL (host + path, no scheme). */
export function linkLabel(link: { title: string | null; externalKey: string | null; url: string }): string {
  if (link.title) return link.title;
  if (link.externalKey) return link.externalKey;
  try {
    const u = new URL(link.url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return u.hostname.replace(/^www\./, '') + path;
  } catch {
    return link.url;
  }
}
