import type { RouteContext } from './router';

/**
 * GET /docs — human-facing API + product documentation (KBR-109).
 *
 * Renders the OpenAPI spec (served at /api/openapi.json, whose `info.description`
 * carries the functionality tour + MCP setup) with **Scalar**. We hand-roll the
 * HTML rather than use `@scalar/hono-api-reference` because kbRelay's router is a
 * custom route table, not Hono. Scalar's standalone bundle is loaded from the
 * jsDelivr CDN, pinned so the page can't shift under us on a Scalar release.
 *
 * Served by the Worker (not the Pages SPA): the spec lives here, it's colocated
 * with the API contract, and it works identically in the self-host runtime. The
 * `kbrelay.lalalimited.com/docs` Worker route (wrangler.toml) points this path at
 * the Worker; everything else on the host stays with Pages.
 */

// Pinned Scalar standalone bundle. Bump deliberately (verify /docs after).
const SCALAR_VERSION = '1.62.4';
const SCALAR_CDN = `https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}`;

const SCALAR_CONFIG = {
  url: '/api/openapi.json',
  pageTitle: 'kbRelay API Reference',
  // Match the app's dark brand chrome; users can still toggle.
  darkMode: true,
  layout: 'modern',
  searchHotKey: 'k',
  hideDownloadButton: false,
  metaData: {
    title: 'kbRelay — API, MCP & Product Documentation',
    description:
      'Reference for kbRelay: a multi-tenant kanban board where humans and ' +
      'agents relay work. Functionality guide, REST API, and MCP setup.',
  },
  // Default the interactive "Try it" auth to the bearer scheme; the user pastes
  // their own key (persisted locally). We never ship a real key here.
  authentication: { preferredSecurityScheme: 'bearerAuth' },
} as const;

const DOCS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>kbRelay — API, MCP &amp; Product Documentation</title>
    <meta
      name="description"
      content="Reference for kbRelay: functionality guide, REST API, and MCP setup for the kanban board where humans and agents relay work."
    />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <style>
      /* Brand-dark background so there's no white flash before Scalar boots. */
      html, body { margin: 0; background: #0b1220; }
      #app:empty::after {
        content: 'Loading kbRelay documentation…';
        display: block;
        padding: 3rem;
        color: #94a3b8;
        font: 500 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR_CDN}"></script>
    <script>
      Scalar.createApiReference('#app', ${JSON.stringify(SCALAR_CONFIG)});
    </script>
  </body>
</html>
`;

/** GET /docs — public. Serves the Scalar-rendered documentation page. */
export function handleDocs(_ctx: RouteContext): Response {
  return new Response(DOCS_HTML, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short cache: the HTML shell is tiny and we want spec/version changes to
      // surface promptly. The pinned CDN bundle itself is immutable/long-cached.
      'cache-control': 'public, max-age=300',
    },
  });
}
