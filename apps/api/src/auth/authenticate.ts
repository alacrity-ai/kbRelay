import type { Env } from '../env';
import type { AuthContext, UserKind, Role } from '@kbrelay/shared';
import { colorForUser } from '@kbrelay/shared';

/**
 * Resolve an `Authorization: Bearer <token>` header to an AuthContext.
 *
 * Tokens are never stored in plaintext — we sha256 the presented token
 * and look up the hash in `api_tokens`, joining `users` for the actor.
 * Returns null on any failure (missing header, unknown/revoked token),
 * which the dispatcher renders as 401.
 *
 * Best-effort updates `last_used_at` so we can see stale tokens later.
 */
export async function authenticate(request: Request, env: Env): Promise<AuthContext | null> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;

  const token = match[1]!.trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);

  // Role prefers the membership in the token's tenant (admin/member), falling
  // back to the legacy 4-rank users.role for tokens minted before memberships.
  const row = await env.db.prepare(
    `SELECT t.id       AS token_id,
            t.tenant_id AS tenant_id,
            u.id        AS user_id,
            u.name      AS user_name,
            u.kind      AS user_kind,
            COALESCE(m.role, u.role) AS user_role,
            u.color     AS user_color
       FROM api_tokens t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN memberships m ON m.tenant_id = t.tenant_id AND m.user_id = u.id
      WHERE t.token_hash = ? AND t.revoked_at IS NULL`,
  )
    .bind(tokenHash)
    .first<{
      token_id: string;
      tenant_id: string;
      user_id: string;
      user_name: string;
      user_kind: string;
      user_role: string | null;
      user_color: string | null;
    }>();

  if (!row) return null;

  // Best-effort last-used stamp; never block auth on it.
  try {
    await env.db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?')
      .bind(Date.now(), row.token_id)
      .run();
  } catch {
    /* ignore */
  }

  return {
    tokenId: row.token_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    userName: row.user_name,
    userKind: row.user_kind as UserKind,
    role: (row.user_role as Role | null) ?? null,
    color: row.user_color ?? colorForUser(row.user_id),
  };
}

/** sha256 → lowercase hex. Used for token hashing at auth + mint time. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
