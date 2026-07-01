import { describe, it, expect } from 'vitest';
import {
  parseHandles,
  resolveMentionRecipients,
  diffRecipients,
  markMentionsReadInput,
} from './mentions.ts';

const USERS = [
  { id: 'u_leif', handle: 'leif' },
  { id: 'u_joe', handle: 'joe' },
  { id: 'u_claude', handle: 'claude' },
  { id: 'u_nohandle', handle: null },
];

describe('parseHandles', () => {
  it('matches a single handle', () => {
    expect(parseHandles('hey @joe look')).toEqual(['joe']);
  });

  it('matches multiple distinct handles', () => {
    expect(parseHandles('@joe and @leif').sort()).toEqual(['joe', 'leif']);
  });

  it('collapses repeats — count never matters', () => {
    expect(parseHandles('@joe @joe @joe @joe')).toEqual(['joe']);
  });

  it('does NOT match inside an email address', () => {
    expect(parseHandles('mail foo@bar.com now')).toEqual([]);
    expect(parseHandles('a.b@example.org')).toEqual([]);
  });

  it('matches at start of string and after punctuation', () => {
    expect(parseHandles('@joe starts')).toEqual(['joe']);
    expect(parseHandles('(@joe) and @leif.').sort()).toEqual(['joe', 'leif']);
  });

  it('is case-insensitive and lowercases', () => {
    expect(parseHandles('@JOE @Leif').sort()).toEqual(['joe', 'leif']);
  });

  it('does not match a bare @ or @ followed by space', () => {
    expect(parseHandles('email me @ home')).toEqual([]);
    expect(parseHandles('@')).toEqual([]);
  });

  it('handles empty / null', () => {
    expect(parseHandles('')).toEqual([]);
    expect(parseHandles(null)).toEqual([]);
    expect(parseHandles(undefined)).toEqual([]);
  });
});

describe('resolveMentionRecipients', () => {
  it('resolves known handles to user ids, distinct', () => {
    expect(resolveMentionRecipients('@joe @joe @leif', USERS, 'u_leif').sort()).toEqual([
      'u_joe',
    ]); // leif is the author → dropped; joe resolves once
  });

  it('drops the author (no self-mention)', () => {
    expect(resolveMentionRecipients('@joe', USERS, 'u_joe')).toEqual([]);
  });

  it('drops unknown handles', () => {
    expect(resolveMentionRecipients('@ghost @joe', USERS, 'u_leif')).toEqual(['u_joe']);
  });

  it('a user with a null handle can never be resolved', () => {
    // there is no handle text that maps to u_nohandle
    expect(resolveMentionRecipients('@nohandle', USERS, 'u_leif')).toEqual([]);
  });
});

describe('diffRecipients — the reconcile heuristics', () => {
  it('add-only when a mention appears', () => {
    expect(diffRecipients(['u_joe'], [])).toEqual({ add: ['u_joe'], remove: [] });
  });

  it('remove-only when a mention disappears', () => {
    expect(diffRecipients([], ['u_joe'])).toEqual({ add: [], remove: ['u_joe'] });
  });

  it('count invariant: still-present recipient is a no-op (×3 → ×1)', () => {
    // both texts resolve to the same set {u_joe}; nothing changes.
    const wanted = resolveMentionRecipients('@joe', USERS, 'u_leif');
    const existing = ['u_joe'];
    expect(diffRecipients(wanted, existing)).toEqual({ add: [], remove: [] });
  });

  it('retract only when the LAST occurrence is gone (×3 → ×0)', () => {
    const wanted = resolveMentionRecipients('no mentions here', USERS, 'u_leif');
    expect(diffRecipients(wanted, ['u_joe'])).toEqual({ add: [], remove: ['u_joe'] });
  });

  it('mixed: remove one, keep another', () => {
    // was {joe, sue}; now only {joe} present → remove sue, keep joe
    expect(diffRecipients(['u_joe'], ['u_joe', 'u_sue'])).toEqual({
      add: [],
      remove: ['u_sue'],
    });
  });

  it('swap: add + remove in one edit', () => {
    expect(diffRecipients(['u_leif'], ['u_joe'])).toEqual({
      add: ['u_leif'],
      remove: ['u_joe'],
    });
  });
});

describe('markMentionsReadInput', () => {
  it('accepts all:true', () => {
    expect(markMentionsReadInput.safeParse({ all: true }).success).toBe(true);
  });
  it('accepts a non-empty mentionIds array', () => {
    expect(markMentionsReadInput.safeParse({ mentionIds: ['men_1'] }).success).toBe(true);
  });
  it('rejects empty payloads', () => {
    expect(markMentionsReadInput.safeParse({}).success).toBe(false);
    expect(markMentionsReadInput.safeParse({ mentionIds: [] }).success).toBe(false);
    expect(markMentionsReadInput.safeParse({ all: false }).success).toBe(false);
  });
});
