import { describe, it, expect } from 'vitest';
import { createCommentInput, classifyRedaction } from './events.ts';

describe('createCommentInput', () => {
  it('requires a non-empty body; type defaults are handled by the caller', () => {
    expect(createCommentInput.safeParse({ body: 'shipped it' }).success).toBe(true);
    expect(createCommentInput.safeParse({ body: '' }).success).toBe(false);
    expect(createCommentInput.safeParse({}).success).toBe(false);
  });

  it('accepts note and handoff types', () => {
    expect(createCommentInput.safeParse({ type: 'note', body: 'x' }).success).toBe(true);
    expect(createCommentInput.safeParse({ type: 'handoff', body: 'x' }).success).toBe(true);
    expect(createCommentInput.safeParse({ type: 'bogus', body: 'x' }).success).toBe(false);
  });

  it('accepts structured handoff meta and rejects unknown meta keys', () => {
    expect(
      createCommentInput.safeParse({
        type: 'handoff',
        body: 'done',
        meta: { summary: 's', evidence: ['commit:abc'], verify: ['smoke ok'], spunOff: ['card:x'] },
      }).success,
    ).toBe(true);
    expect(
      createCommentInput.safeParse({ type: 'handoff', body: 'done', meta: { bogus: 1 } }).success,
    ).toBe(false);
  });

  it('has input/output type parity (no zod default) so the API type checks', () => {
    // `type` omitted is valid; the handler defaults it to 'note'.
    const parsed = createCommentInput.parse({ body: 'x' });
    expect(parsed.type).toBeUndefined();
  });
});

describe('classifyRedaction', () => {
  const note = { kind: 'note' as const, authorUserId: 'u_claude', deletedAt: null };

  it('lets an author redact their own live comment', () => {
    expect(classifyRedaction(note, 'u_claude')).toEqual({ allowed: true, alreadyRedacted: false, error: null });
  });

  it('refuses redacting someone else’s comment (author-only)', () => {
    expect(classifyRedaction(note, 'u_leif')).toEqual({ allowed: false, alreadyRedacted: false, error: 'not_author' });
  });

  it('refuses redacting a system event (immutable audit spine)', () => {
    const sys = { kind: 'system' as const, authorUserId: 'u_claude', deletedAt: null };
    expect(classifyRedaction(sys, 'u_claude')).toEqual({ allowed: false, alreadyRedacted: false, error: 'not_comment' });
  });

  it('treats an already-redacted own comment as an idempotent no-op', () => {
    const dead = { kind: 'handoff' as const, authorUserId: 'u_claude', deletedAt: 123 };
    expect(classifyRedaction(dead, 'u_claude')).toEqual({ allowed: true, alreadyRedacted: true, error: null });
  });
});
