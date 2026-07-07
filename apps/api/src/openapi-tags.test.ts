import { describe, it, expect } from 'vitest';
import { OPENAPI_SPEC, handleOpenApi } from './openapi';
import { routes } from './router';
import { TAGS, TAG_GROUPS, tagForPath, buildEnrichedSpec } from './openapi-tags';
import type { RouteContext } from './router';

const tagNames = new Set(TAGS.map((t) => t.name));
const specPaths = Object.keys(OPENAPI_SPEC.paths as Record<string, unknown>);

describe('OpenAPI tag grouping', () => {
  it('assigns every documented path a defined tag (no fallthrough)', () => {
    for (const path of specPaths) {
      const tag = tagForPath(path);
      expect(tagNames.has(tag), `path ${path} → unknown tag "${tag}"`).toBe(true);
    }
  });

  it('assigns every live v1 route a defined tag', () => {
    for (const r of routes.filter((r) => r.pattern.startsWith('/api/v1/'))) {
      const openApiPath = r.pattern.replace(/:([^/]+)/g, '{$1}');
      expect(tagNames.has(tagForPath(openApiPath))).toBe(true);
    }
  });

  it('places every tag in exactly one group, and every group tag is defined', () => {
    const grouped: string[] = [];
    for (const g of TAG_GROUPS) {
      for (const t of g.tags) {
        expect(tagNames.has(t), `group "${g.name}" references undefined tag "${t}"`).toBe(true);
        grouped.push(t);
      }
    }
    // Bijection: each defined tag grouped once, no duplicates.
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(new Set(grouped)).toEqual(tagNames);
  });

  it('enriches the spec: tags + x-tagGroups + every operation tagged', () => {
    const spec = buildEnrichedSpec(OPENAPI_SPEC);
    expect(spec.tags).toBe(TAGS);
    expect(spec['x-tagGroups']).toBe(TAG_GROUPS);
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        expect(op.tags, `${method.toUpperCase()} ${path} has no tag`).toEqual([tagForPath(path)]);
      }
    }
  });

  it('does not mutate the canonical OPENAPI_SPEC', () => {
    const firstOp = Object.values(OPENAPI_SPEC.paths as Record<string, Record<string, { tags?: unknown }>>)[0];
    const firstMethod = Object.values(firstOp)[0];
    expect(firstMethod.tags).toBeUndefined();
  });

  it('serves the enriched spec from GET /api/openapi.json', async () => {
    const res = handleOpenApi({ cors: {} } as unknown as RouteContext);
    const body = JSON.parse(await res.text());
    expect(Array.isArray(body['x-tagGroups'])).toBe(true);
    expect(body.tags.length).toBe(TAGS.length);
  });
});
