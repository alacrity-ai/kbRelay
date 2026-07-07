import { describe, it, expect } from 'vitest';
import { handleDocs } from './docs';
import { routes } from './router';
import type { RouteContext } from './router';

/** Minimal context — handleDocs is static and ignores everything in it. */
const ctx = {} as unknown as RouteContext;

describe('GET /docs (Scalar UI)', () => {
  it('is registered as a public route', () => {
    const route = routes.find((r) => r.method === 'GET' && r.pattern === '/docs');
    expect(route, 'no GET /docs route').toBeDefined();
    expect(route!.public, '/docs must be public').toBe(true);
  });

  it('returns an HTML page', async () => {
    const res = handleDocs(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toMatch(/<!doctype html>/i);
  });

  it('boots Scalar against the OpenAPI spec', async () => {
    const body = await handleDocs(ctx).text();
    // Points the renderer at our spec, and boots the pinned standalone bundle.
    expect(body).toContain('/api/openapi.json');
    expect(body).toContain('Scalar.createApiReference');
    expect(body).toContain('@scalar/api-reference@');
  });
});
