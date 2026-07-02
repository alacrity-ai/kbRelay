import { describe, it, expect } from 'vitest';
import { linkifyTicketKeys } from './cardLinks';

const CODES = new Set(['KBR', 'OBL']);

describe('linkifyTicketKeys', () => {
  it('links a key whose code is accessible', () => {
    expect(linkifyTicketKeys('see KBR-12 for context', CODES))
      .toBe('see [KBR-12](#card-KBR-12) for context');
  });

  it('links multiple keys, mixed codes', () => {
    expect(linkifyTicketKeys('KBR-1 spun off OBL-24', CODES))
      .toBe('[KBR-1](#card-KBR-1) spun off [OBL-24](#card-OBL-24)');
  });

  it('leaves unknown codes plain (no existence leak, no dead link)', () => {
    expect(linkifyTicketKeys('see ZZZ-12 and JIRA-9', CODES)).toBe('see ZZZ-12 and JIRA-9');
  });

  it('does not match lowercase or partial-word keys', () => {
    expect(linkifyTicketKeys('kbr-12 stays, XKBR-12 stays', CODES))
      .toBe('kbr-12 stays, XKBR-12 stays');
  });

  it('skips inline code spans', () => {
    expect(linkifyTicketKeys('fix `KBR-12` later', CODES)).toBe('fix `KBR-12` later');
  });

  it('skips fenced code blocks', () => {
    const s = 'before\n```\ngit log KBR-12\n```\nKBR-12 after';
    expect(linkifyTicketKeys(s, CODES))
      .toBe('before\n```\ngit log KBR-12\n```\n[KBR-12](#card-KBR-12) after');
  });

  it('skips existing markdown links (label and target)', () => {
    const s = 'see [KBR-12 notes](https://x.dev/KBR-12) please';
    expect(linkifyTicketKeys(s, CODES)).toBe(s);
  });

  it('skips bare URLs (GFM autolinks them)', () => {
    const s = 'at https://example.com/KBR-12/detail now';
    expect(linkifyTicketKeys(s, CODES)).toBe(s);
  });

  it('skips mention sentinels already linkified upstream', () => {
    const s = 'ping [@Leif](#mention-leif) about KBR-3';
    expect(linkifyTicketKeys(s, CODES))
      .toBe('ping [@Leif](#mention-leif) about [KBR-3](#card-KBR-3)');
  });

  it('no-ops with an empty code set or empty text', () => {
    expect(linkifyTicketKeys('KBR-12', new Set())).toBe('KBR-12');
    expect(linkifyTicketKeys('', CODES)).toBe('');
  });
});
