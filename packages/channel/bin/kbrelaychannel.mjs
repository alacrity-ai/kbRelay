#!/usr/bin/env node
// kbRelay channel plugin — `npx @alacrity-ai/kbrelaychannel` runs this. Resolves
// the compiled entry relative to this shim and starts it. stdout is reserved for
// JSON-RPC (the MCP channel transport); diagnostics go to stderr.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

try {
  const mod = await import(join(here, '..', 'dist', 'index.js'));
  await mod.main();
} catch (err) {
  process.stderr.write(`[kbrelaychannel] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}
