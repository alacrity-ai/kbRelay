import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UserDto } from '@kbrelay/shared';
import { CardLinksContext } from '../lib/cardLinks';
import Markdown from './Markdown';

const html = (s: string, users?: UserDto[]) =>
  renderToStaticMarkup(<Markdown users={users}>{s}</Markdown>);

/**
 * Guards the link renderer: a bare http(s) URL must autolink AND keep its
 * visible text — the original bug emitted an empty <a>, erasing the URL.
 */
describe('Markdown links', () => {
  it('autolinks a bare URL and keeps the text (never erases it)', () => {
    const out = html('PR from lane maxwell:\nhttps://github.com/Connected2FiberTeam/cb-actions-runners/pull/30');
    expect(out).toContain('href="https://github.com/Connected2FiberTeam/cb-actions-runners/pull/30"');
    // The URL text is present between the tags, not an empty <a></a>.
    expect(out).toContain('>https://github.com/Connected2FiberTeam/cb-actions-runners/pull/30</a>');
    expect(out).not.toMatch(/<a[^>]*><\/a>/);
  });

  it('keeps the label text for [label](url)', () => {
    const out = html('see [the docs](https://example.com) here');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('>the docs</a>');
  });

  it('leaves non-URL plain text untouched', () => {
    expect(html('just plain words, nothing to link')).toContain('just plain words, nothing to link');
  });

  it('still renders @-mentions as chips (not links)', () => {
    const users = [{ id: 'u1', name: 'Leif', kind: 'human', role: null, color: '#000', handle: 'leif' }] as UserDto[];
    const out = html('ping @leif please', users);
    expect(out).toContain('mention-chip');
    expect(out).toContain('@Leif');
  });
});

/** Ticket-key autolinks (v0.17.0, KBR-65): render-level guard that the sentinel
 *  survives react-markdown and the `a` renderer draws the card-link chip. */
describe('Markdown ticket-key autolinks', () => {
  const withLinks = (s: string) =>
    renderToStaticMarkup(
      <CardLinksContext.Provider value={{ codes: new Set(['KBR']), openCard: () => {} }}>
        <Markdown>{s}</Markdown>
      </CardLinksContext.Provider>,
    );

  it('renders an accessible key as a card-link chip', () => {
    const out = withLinks('see KBR-12 for context');
    expect(out).toContain('card-link');
    expect(out).toContain('href="#card-KBR-12"');
    expect(out).toContain('>KBR-12</a>');
  });

  it('leaves keys in code spans and unknown codes plain', () => {
    const out = withLinks('run `git show KBR-12` and see ZZZ-9');
    expect(out).not.toContain('card-link');
    expect(out).toContain('ZZZ-9');
  });

  it('does not linkify without a provider', () => {
    const out = renderToStaticMarkup(<Markdown>{'see KBR-12'}</Markdown>);
    expect(out).not.toContain('card-link');
    expect(out).toContain('KBR-12');
  });
});

/** Interactive checklists (v0.17.0, KBR-59): checkboxes go live only when a
 *  toggle handler is passed (card view mode), never by default (comments). */
describe('Markdown task lists', () => {
  const md = '- [ ] first\n- [x] second';

  it('renders live, enabled checkboxes when onToggleTask is passed', () => {
    const out = renderToStaticMarkup(<Markdown onToggleTask={() => {}}>{md}</Markdown>);
    expect(out).toContain('task-toggle');
    expect(out).toContain('task-live');
    expect(out).not.toContain('disabled');
  });

  it('keeps checkboxes static without a handler (timeline comments)', () => {
    const out = renderToStaticMarkup(<Markdown>{md}</Markdown>);
    expect(out).not.toContain('task-toggle');
    expect(out).toContain('disabled');
  });
});
