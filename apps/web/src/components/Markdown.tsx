import { Children, isValidElement, useContext, useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { UserDto } from '@kbrelay/shared';
import { isAttachmentUrl } from '../lib/authedBlob';
import { CardLinksContext, linkifyTicketKeys, type CardLinks } from '../lib/cardLinks';
import AuthedImage from './AuthedImage';
import AuthedDownloadLink from './AuthedDownloadLink';

/** Flatten markdown link/children into plain text (for a download filename). */
function nodeText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(nodeText).join('');
  return '';
}

// Open links in a new tab, safely. react-markdown renders to React elements and
// does NOT emit raw HTML by default (no rehype-raw), so embedded HTML/scripts in
// card text can't execute — we keep that safe default. A `#mention-…` link is our
// sentinel for an @-mention chip (see linkifyMentions below); a `#card-…` link is
// the ticket-key sentinel (see lib/cardLinks) and opens that card in place.
/** Swap the default disabled task checkbox for a live one (depth ≤ 2 — the
 *  input sits directly in the li, or inside its first <p> in a loose list). */
function replaceTaskInput(children: ReactNode, onToggle: () => void, depth = 0): ReactNode {
  if (depth > 2) return children;
  let replaced = false;
  return Children.map(children, (child) => {
    if (replaced || !isValidElement(child)) return child;
    if (child.type === 'input') {
      replaced = true;
      const checked = Boolean((child.props as { checked?: boolean }).checked);
      return (
        <input type="checkbox" className="task-toggle" checked={checked} onChange={onToggle} />
      );
    }
    if (child.type === 'p') {
      const inner = replaceTaskInput((child.props as { children?: ReactNode }).children, onToggle, depth + 1);
      return <p>{inner}</p>;
    }
    return child;
  });
}

function makeComponents(cardLinks: CardLinks | null, onToggleTask?: (line: number) => void): Components {
  return {
    // Interactive checklists (v0.17.0, KBR-59): when a toggle handler is given
    // (card view mode — NOT timeline comments), a task item's checkbox becomes
    // live; a click toggles the item's source line. The li's node position maps
    // the rendered item back to that line.
    li({ node, children, className, ...props }) {
      const isTask = typeof className === 'string' && className.includes('task-list-item');
      const line = node?.position?.start.line;
      if (!isTask || !onToggleTask || line == null) {
        return <li className={className} {...props}>{children}</li>;
      }
      return (
        <li className={`${className} task-live`} {...props}>
          {replaceTaskInput(children, () => onToggleTask(line))}
        </li>
      );
    },
    a({ node: _node, href, children, ...props }) {
      if (href && href.startsWith('#mention-')) {
        return <span className="mention-chip">{children}</span>;
      }
      if (href && href.startsWith('#card-') && cardLinks) {
        const key = href.slice('#card-'.length);
        return (
          <a
            href={href}
            className="card-link"
            title={`Open ${key}`}
            onClick={(e) => { e.preventDefault(); cardLinks.openCard(key); }}
          >
            {children}
          </a>
        );
      }
      // Attachment links are auth-gated — download via an authenticated fetch
      // (a bare <a href> would 401; see lib/authedBlob). Filename from the link
      // text (our injected label is "📎 filename").
      if (isAttachmentUrl(href)) {
        const filename = nodeText(children).replace(/^📎\s*/, '').trim() || undefined;
        return <AuthedDownloadLink href={href!} filename={filename}>{children}</AuthedDownloadLink>;
      }
      // `children` MUST be rendered — omitting it emits an empty <a>, which erases
      // the link text (a bare autolinked URL then vanishes entirely).
      return <a href={href} {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    // Attachment images fetch with auth then render from an object URL (v0.16.0);
    // other images render natively. Both scaled via .md-img.
    img({ node: _node, src, alt, ...props }) {
      if (isAttachmentUrl(typeof src === 'string' ? src : undefined)) {
        return <AuthedImage src={src as string} alt={typeof alt === 'string' ? alt : undefined} />;
      }
      return <img src={src} alt={alt} {...props} className="md-img" loading="lazy" />;
    },
  };
}

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
 *  Pass `users` to render @-mentions as chips. Ticket keys (`KBR-12`) linkify when
 *  a CardLinksContext provider is above us (see lib/cardLinks). Pass `onToggleTask`
 *  to make task-list checkboxes live (view mode only — never for timeline comments;
 *  the toggle receives the item's 1-based source line, valid against `children`
 *  because the mention/key preprocessing never adds or removes lines). */
export default function Markdown({
  children,
  users,
  onToggleTask,
}: {
  children: string;
  users?: UserDto[];
  onToggleTask?: (line: number) => void;
}) {
  const cardLinks = useContext(CardLinksContext);

  const source = useMemo(() => {
    let text = children;
    if (users && users.length > 0) {
      const map = new Map<string, string>();
      for (const u of users) if (u.handle) map.set(u.handle.toLowerCase(), u.name);
      text = linkifyMentions(text, map);
    }
    // After mentions: the `[@Name](#mention-…)` links they emit are protected as
    // markdown links, so a key inside one can't be double-wrapped.
    if (cardLinks) text = linkifyTicketKeys(text, cardLinks.codes);
    return text;
  }, [children, users, cardLinks]);

  const components = useMemo(() => makeComponents(cardLinks, onToggleTask), [cardLinks, onToggleTask]);

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
