import type { AuthContext } from '@kbrelay/shared';
import { HttpError } from '../http';

/**
 * Pull the tenant/user scope off an authenticated request. Every
 * tenant-scoped repo call takes this and filters by `tenantId`, so
 * cross-tenant reads/writes are structurally impossible to express.
 *
 * Throws 401 if called on a route that wasn't authenticated (a
 * programming error — protected routes always have `auth`).
 */
export function tenantScope(auth: AuthContext | null): { tenantId: string; userId: string } {
  if (!auth) throw new HttpError(401, 'Authentication required');
  return { tenantId: auth.tenantId, userId: auth.userId };
}
