import { describe, it, expect } from 'vitest';
import { routes } from './router';
import { OPENAPI_SPEC } from './openapi';

/**
 * Contract parity: the OpenAPI doc agents read must exactly match the
 * routes the Worker serves. Every authenticated /api/v1 route has a spec
 * entry, and every spec path+method has a route. Prevents silent drift.
 */

const toOpenApiPath = (pattern: string) => pattern.replace(/:([^/]+)/g, '{$1}');

const specPaths = OPENAPI_SPEC.paths as Record<string, Record<string, unknown>>;

describe('OpenAPI ↔ router parity', () => {
  const v1Routes = routes.filter((r) => r.pattern.startsWith('/api/v1/'));

  for (const r of v1Routes) {
    it(`route ${r.method} ${r.pattern} is documented`, () => {
      const path = toOpenApiPath(r.pattern);
      expect(specPaths[path], `missing spec path ${path}`).toBeDefined();
      expect(
        specPaths[path]![r.method.toLowerCase()],
        `missing ${r.method} on ${path}`,
      ).toBeDefined();
    });
  }

  it('every documented path+method maps to a real route', () => {
    for (const [path, methods] of Object.entries(specPaths)) {
      for (const method of Object.keys(methods)) {
        const match = routes.find(
          (r) => toOpenApiPath(r.pattern) === path && r.method.toLowerCase() === method,
        );
        expect(match, `spec documents ${method.toUpperCase()} ${path} but no route serves it`).toBeTruthy();
      }
    }
  });
});
