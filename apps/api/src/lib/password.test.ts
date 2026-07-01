import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, PASSWORD_ALGO } from './password';

describe('password hashing', () => {
  it('round-trips a correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const stored = await hashPassword('hunter2hunter2');
    expect(await verifyPassword('nope nope nope', stored)).toBe(false);
  });

  it('produces the self-describing stored format', async () => {
    const stored = await hashPassword('a-strong-password');
    const parts = stored.split('$');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(PASSWORD_ALGO);
    expect(Number(parts[1])).toBe(100_000);
    expect(parts[2]!.length).toBeGreaterThan(0);
    expect(parts[3]!.length).toBeGreaterThan(0);
  });

  it('salts — same password hashes differently each time', async () => {
    const a = await hashPassword('same-password-here');
    const b = await hashPassword('same-password-here');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password-here', a)).toBe(true);
    expect(await verifyPassword('same-password-here', b)).toBe(true);
  });

  it('returns false for a malformed stored value', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});
