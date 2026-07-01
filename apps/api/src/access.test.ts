import { describe, it, expect } from 'vitest';
import { routes } from './router';

/**
 * RBAC coverage net (v0.11.0). Every project-scoped route MUST declare an
 * `access` scope so the dispatcher enforces `requireProjectAccess`. This test
 * iterates the live router table, so a newly added project/card/column route
 * that forgets the guard fails CI here rather than silently leaking data.
 *
 * The two explicit exemptions are the only project-ish routes that are *not*
 * single-project gated:
 *   - GET  /api/v1/projects  — lists, filtered to the caller's access in-handler
 *   - POST /api/v1/projects  — create; any member may, and is auto-granted access
 */
const EXEMPT = new Set(['GET /api/v1/projects', 'POST /api/v1/projects']);

/** A route "touches a project resource" if its path is under projects/cards/columns. */
function isProjectScoped(pattern: string): boolean {
  return (
    pattern.startsWith('/api/v1/projects/') ||
    pattern === '/api/v1/projects' ||
    pattern.startsWith('/api/v1/cards/') ||
    pattern.startsWith('/api/v1/columns/')
  );
}

describe('RBAC route coverage', () => {
  for (const r of routes) {
    if (!isProjectScoped(r.pattern)) continue;
    const key = `${r.method} ${r.pattern}`;
    it(`${key} declares an access scope (or is exempt)`, () => {
      if (EXEMPT.has(key)) {
        expect(r.access, `${key} is exempt and must NOT declare access`).toBeUndefined();
      } else {
        expect(r.access, `${key} must declare an access scope`).toBeDefined();
        expect(['project', 'card', 'column']).toContain(r.access!.kind);
        // The named param must actually appear in the pattern.
        expect(r.pattern).toContain(`:${r.access!.param}`);
      }
    });
  }

  it('the exempt list only names routes that exist', () => {
    for (const key of EXEMPT) {
      const [method, pattern] = key.split(' ') as [string, string];
      expect(routes.some((r) => r.method === method && r.pattern === pattern), `exempt ${key} has no route`).toBe(true);
    }
  });
});
