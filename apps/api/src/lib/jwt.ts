/**
 * Minimal HS256 JWT signer + verifier on Web Crypto. No deps. Grounded in
 * houseops (`apps/api/src/lib/jwt.ts`).
 *
 * Claims are deliberately tiny: `uid` (user), `tid` (active tenant), plus
 * `iat`/`exp` (seconds since epoch). Verify enforces `alg === 'HS256'` to
 * block alg-confusion / `none` attacks, checks expiry, and requires both ids.
 */

export interface SessionClaims {
  uid: string;
  tid: string;
  iat: number;
  exp: number;
}

/** Sign a session token. `ttlSeconds` sets `exp` relative to now. */
export async function signSession(
  secret: string,
  claims: Pick<SessionClaims, 'uid' | 'tid'>,
  ttlSeconds: number,
): Promise<string> {
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionClaims = { ...claims, iat: now, exp: now + ttlSeconds };
  const enc = new TextEncoder();
  const headerB64 = b64urlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, bs(enc.encode(signingInput)));
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Verify + decode a session token. Returns null on any failure. */
export async function verifySession(secret: string, token: string): Promise<SessionClaims | null> {
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const enc = new TextEncoder();
  const key = await importHmacKey(secret);

  let ok: boolean;
  try {
    ok = await crypto.subtle.verify(
      'HMAC',
      key,
      bs(b64urlDecode(sigB64)),
      bs(enc.encode(`${headerB64}.${payloadB64}`)),
    );
  } catch {
    return null;
  }
  if (!ok) return null;

  let header: { alg?: string };
  let payload: SessionClaims;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64))) as { alg?: string };
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as SessionClaims;
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.uid !== 'string' || typeof payload.tid !== 'string') return null;
  return payload;
}

/** WebCrypto's strict typings want ArrayBuffer-backed views; ours always are. */
const bs = (x: Uint8Array): Uint8Array<ArrayBuffer> => x as Uint8Array<ArrayBuffer>;

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bs(new TextEncoder().encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const fixed = pad ? padded + '='.repeat(4 - pad) : padded;
  const bin = atob(fixed);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
