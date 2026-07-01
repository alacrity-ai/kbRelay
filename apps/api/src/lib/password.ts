/**
 * Password hashing — PBKDF2-HMAC-SHA-256 via Web Crypto (identical on the
 * Cloudflare Worker runtime and in Node/vitest). Grounded in houseops
 * (`apps/api/src/lib/password.ts`).
 *
 * Stored form (in `users.password_hash`, algo tag in `users.password_algo`):
 *   pbkdf2-sha256$<iterations>$<base64 salt>$<base64 derived key>
 *
 * Verification is constant-time to avoid leaking hash bytes via timing.
 */

const ALGO = 'pbkdf2-sha256';
const ITERATIONS = 100_000;
const SALT_BYTES = 32;
const KEY_BYTES = 32;

/** Hash a plaintext password into the self-describing stored form. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await pbkdf2(password, salt, ITERATIONS, KEY_BYTES);
  return `${ALGO}$${ITERATIONS}$${b64encode(salt)}$${b64encode(derived)}`;
}

/** Constant-time verify of a plaintext against a stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== ALGO) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = b64decode(parts[2]!);
    expected = b64decode(parts[3]!);
  } catch {
    return false;
  }
  const actual = await pbkdf2(password, salt, iterations, expected.length);
  return timingSafeEqual(actual, expected);
}

/** The algo tag stored in `users.password_algo`. */
export const PASSWORD_ALGO = ALGO;

/** WebCrypto's strict typings want ArrayBuffer-backed views; ours always are. */
const bs = (x: Uint8Array): Uint8Array<ArrayBuffer> => x as Uint8Array<ArrayBuffer>;

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    bs(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bs(salt), iterations },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
