import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  emailSchema,
  passwordSchema,
  registerInput,
  loginInput,
  resetPasswordInput,
  createTokenInput,
} from './accounts.ts';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Leif@Example.COM ')).toBe('leif@example.com');
  });
  it('is idempotent', () => {
    const once = normalizeEmail('Foo@Bar.io');
    expect(normalizeEmail(once)).toBe(once);
  });
});

describe('emailSchema', () => {
  it('normalizes valid emails', () => {
    expect(emailSchema.parse(' Leif@Example.com ')).toBe('leif@example.com');
  });
  it('rejects malformed emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
    expect(emailSchema.safeParse('a@b').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('requires at least 8 characters', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('longenough').success).toBe(true);
  });
  it('rejects absurdly long input', () => {
    expect(passwordSchema.safeParse('x'.repeat(201)).success).toBe(false);
  });
});

describe('registerInput', () => {
  it('accepts and normalizes a full payload', () => {
    const parsed = registerInput.parse({
      email: 'NEW@User.com',
      password: 'supersecret',
      name: '  Ada  ',
      tenantName: '  Acme  ',
    });
    expect(parsed.email).toBe('new@user.com');
    expect(parsed.name).toBe('Ada');
    expect(parsed.tenantName).toBe('Acme');
  });
  it('rejects a short password', () => {
    expect(
      registerInput.safeParse({ email: 'a@b.com', password: 'x', name: 'A', tenantName: 'T' })
        .success,
    ).toBe(false);
  });
  it('rejects empty name / tenantName', () => {
    expect(
      registerInput.safeParse({ email: 'a@b.com', password: 'password', name: '', tenantName: 'T' })
        .success,
    ).toBe(false);
    expect(
      registerInput.safeParse({ email: 'a@b.com', password: 'password', name: 'A', tenantName: ' ' })
        .success,
    ).toBe(false);
  });
});

describe('loginInput', () => {
  it('normalizes the email and keeps the password verbatim', () => {
    const parsed = loginInput.parse({ email: 'USER@X.com', password: ' spaces kept ' });
    expect(parsed.email).toBe('user@x.com');
    expect(parsed.password).toBe(' spaces kept ');
  });
  it('rejects an empty password', () => {
    expect(loginInput.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('resetPasswordInput', () => {
  it('requires a token and a valid password', () => {
    expect(resetPasswordInput.safeParse({ token: 't', password: 'longenough' }).success).toBe(true);
    expect(resetPasswordInput.safeParse({ token: '', password: 'longenough' }).success).toBe(false);
    expect(resetPasswordInput.safeParse({ token: 't', password: 'short' }).success).toBe(false);
  });
});

describe('createTokenInput', () => {
  it('trims and requires a label', () => {
    expect(createTokenInput.parse({ label: '  my key ' }).label).toBe('my key');
    expect(createTokenInput.safeParse({ label: '   ' }).success).toBe(false);
  });
});
