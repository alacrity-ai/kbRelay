import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { createServerAdapter } from '@whatwg-node/server';
import { dispatch } from '../shared/dispatch';
import { buildNodeBindings } from './bindings';

/**
 * kbRelay self-host entrypoint (v0.12.0). One Node process serves both the API
 * (`/api/*` → the shared `dispatch` over a libsql `db`) and the built SPA
 * (everything else → static files from `SPA_DIR`, SPA-fallback to index.html),
 * giving the same-origin `/api` model without Cloudflare. Node 24 provides
 * global `Request`/`Response`, so `dispatch` runs unchanged.
 */
const { env } = buildNodeBindings(process.env);
const PORT = Number(process.env.PORT ?? 8080);
const SPA_DIR = process.env.SPA_DIR ?? join(process.cwd(), 'web');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

/** Read a file under SPA_DIR, guarding against path traversal. Null if missing. */
async function readSpaFile(relPath: string): Promise<{ body: Buffer; type: string } | null> {
  const clean = normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const full = join(SPA_DIR, clean);
  if (!full.startsWith(SPA_DIR)) return null;
  try {
    const body = await readFile(full);
    return { body, type: MIME[extname(full)] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const hit = (await readSpaFile(rel)) ?? (extname(rel) ? null : await readSpaFile('index.html'));
  if (!hit) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(hit.body), { headers: { 'content-type': hit.type } });
}

const adapter = createServerAdapter(async (request: Request) => {
  const url = new URL(request.url);
  if (url.pathname === '/api/health' || url.pathname.startsWith('/api/')) {
    // No execution-context in Node; fire-and-forget work just runs in-process.
    return dispatch(request, env, (p) => void Promise.resolve(p).catch(() => {}));
  }
  return serveStatic(url.pathname);
});

const server = createServer(adapter);
server.listen(PORT, () => {
  console.log(`[kbrelay] self-host listening on :${PORT} (db=${process.env.DATABASE_URL ?? 'file:./kbrelay.db'})`);
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`[kbrelay] ${sig} — shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
