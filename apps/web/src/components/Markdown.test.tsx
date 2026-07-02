import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UserDto } from '@kbrelay/shared';
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
