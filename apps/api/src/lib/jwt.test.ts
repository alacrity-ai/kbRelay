import { describe, it, expect } from 'vitest';
import { signSession, verifySession } from './jwt';

const SECRET = 'test-secret-please-ignore';

describe('jwt sessions', () => {
  it('signs and verifies, preserving claims', async () => {
    const token = await signSession(SECRET, { uid: 'u_1', tid: 't_1' }, 3600);
    const claims = await verifySession(SECRET, token);
    expect(claims).not.toBeNull();
    expect(claims!.uid).toBe('u_1');
    expect(claims!.tid).toBe('t_1');
    expect(claims!.exp).toBeGreaterThan(claims!.iat);
  });

  it('rejects an expired token', async () => {
    const token = await signSession(SECRET, { uid: 'u_1', tid: 't_1' }, -10);
    expect(await verifySession(SECRET, token)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(SECRET, { uid: 'u_1', tid: 't_1' }, 3600);
    expect(await verifySession('other-secret', token)).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await signSession(SECRET, { uid: 'u_1', tid: 't_1' }, 3600);
    const [h, , s] = token.split('.');
    const forgedPayload = btoa(JSON.stringify({ uid: 'u_evil', tid: 't_1', iat: 0, exp: 9e9 }))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(await verifySession(SECRET, `${h}.${forgedPayload}.${s}`)).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifySession(SECRET, 'not.a.jwt')).toBeNull();
    expect(await verifySession(SECRET, 'onlyonepart')).toBeNull();
    expect(await verifySession('', 'a.b.c')).toBeNull();
  });
});
