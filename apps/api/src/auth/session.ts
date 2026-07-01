import type { Env } from '../env';
import type { AuthContext } from '@kbrelay/shared';
import { readSessionCookie } from '../lib/cookies';
import { verifySession } from '../lib/jwt';
import { loadSessionContext } from '../db/repos/auth';

/**
 * Resolve a `kbrelay_session` JWT cookie to an AuthContext (the human auth
 * path). Returns null on any failure — no cookie, no JWT_SECRET, bad/expired
 * signature, or a membership that no longer exists (stale cookie after the
 * user was removed from the tenant). The dispatcher renders null as 401.
 *
 * Runs only after bearer-token auth misses, so a valid token always wins.
 */
export async function authenticateSession(
  request: Request,
  env: Env,
): Promise<AuthContext | null> {
  const cookie = readSessionCookie(request);
  if (!cookie) return null;
  if (!env.JWT_SECRET) return null;

  const claims = await verifySession(env.JWT_SECRET, cookie);
  if (!claims) return null;

  return loadSessionContext(env, claims.tid, claims.uid);
}
