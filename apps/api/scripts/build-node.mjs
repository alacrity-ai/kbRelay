import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Bundle the self-host Node entrypoints (v0.12.0): the server + the migrate and
 * mint-tenant CLIs. Everything (repos, shared, zod, @whatwg-node) is bundled;
 * only the native SQLite client (`@libsql/client`/`libsql`) stays external and
 * is installed in the runtime image. Output: `apps/api/dist-node/*.js`.
 */
const api = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: {
    server: join(api, 'src/runtime/node/index.ts'),
    migrate: join(api, 'scripts/migrate-libsql.ts'),
    'mint-tenant': join(api, 'scripts/mint-tenant.ts'),
  },
  outdir: join(api, 'dist-node'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['@libsql/client', 'libsql'],
  // Let bundled CJS deps use require() under ESM.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
