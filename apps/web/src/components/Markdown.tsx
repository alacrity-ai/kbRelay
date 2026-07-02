import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { UserDto } from '@kbrelay/shared';

// Open links in a new tab, safely. react-markdown renders to React elements and
// does NOT emit raw HTML by default (no rehype-raw), so embedded HTML/scripts in
// card text can't execute — we keep that safe default. A `#mention-…` link is our
// sentinel for an @-mention chip (see linkifyMentions below).
const components: Components = {
  a({ node: _node, href, children, ...props }) {
    if (href && href.startsWith('#mention-')) {
      return <span className="mention-chip">{children}</span>;
    }
    // `children` MUST be rendered — omitting it emits an empty <a>, which erases
    // the link text (a bare autolinked URL then vanishes entirely).
    return <a href={href} {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
  // Attachment images (and any markdown image) render inline, scaled to a sane
  // max so a large upload doesn't blow out the card view (v0.16.0).
  img({ node: _node, ...props }) {
    return <img {...props} className="md-img" loading="lazy" />;
  },
};

const plugins = [remarkGfm, remarkBreaks];

// Same handle grammar as the server parser (email-safe: `@` not after a word char).
const HANDLE_RE = /(^|[^\w@])@([a-z0-9](?:[a-z0-9_-]{0,30}))/gi;

/**
 * Turn `@handle` (that resolves to a tenant user) into a markdown link with a
 * `#mention-…` sentinel href, which the `a` renderer above draws as a chip
 * showing `@DisplayName`. Code spans/blocks are protected (left verbatim), so a
 * handle inside `code` stays literal. Unresolved handles are left as plain text.
 */
function linkifyMentions(text: string, nameByHandle: Map<string, string>): string {
  if (!text.includes('@')) return text;
  // Split out fenced blocks and inline code; odd indices are code — skip them.
  const segments = text.split(/(```[\s\S]*?```|`[^`]*`)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg;
      return seg.replace(HANDLE_RE, (whole, pre: string, handle: string) => {
        const name = nameByHandle.get(handle.toLowerCase());
        return name ? `${pre}[@${name}](#mention-${handle.toLowerCase()})` : whole;
      });
    })
    .join('');
}

/** Render card text (description, acceptance criteria, timeline bodies) as markdown.
 *  Pass `users` to render @-mentions as chips. */
export default function Markdown({ children, users }: { children: string; users?: UserDto[] }) {
  const source = useMemo(() => {
    if (!users || users.length === 0) return children;
    const map = new Map<string, string>();
    for (const u of users) if (u.handle) map.set(u.handle.toLowerCase(), u.name);
    return linkifyMentions(children, map);
  }, [children, users]);

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
