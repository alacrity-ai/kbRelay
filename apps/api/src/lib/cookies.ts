import type { Env } from '../env';

/**
 * Session cookie helpers. The cookie is always HttpOnly + SameSite=Lax +
 * Path=/. `Secure` flips on for any non-`http://` deploy (i.e. everywhere
 * but local dev), keyed off PUBLIC_BASE_URL. Grounded in houseops.
 */

export const SESSION_COOKIE = 'kbrelay_session';

/** 30 days — the session lifetime. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function isSecureContext(env: Env): boolean {
  return !env.PUBLIC_BASE_URL?.startsWith('http://');
}

export function buildSetCookie(env: Env, token: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${ttlSeconds}`,
  ];
  if (isSecureContext(env)) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie(env: Env): string {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (isSecureContext(env)) parts.push('Secure');
  return parts.join('; ');
}

/** Pull the raw session cookie value out of the request, or null. */
export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('cookie') ?? '';
  if (!header) return null;
  for (const entry of header.split(';')) {
    const trimmed = entry.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    if (trimmed.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = trimmed.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}
