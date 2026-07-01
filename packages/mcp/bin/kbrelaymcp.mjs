#!/usr/bin/env node
// kbRelay MCP — the binary `npx @alacrity-ai/kbrelaymcp` runs. Resolves the
// compiled stdio entrypoint relative to this shim and starts it. Any failure
// (missing config, transport error) prints to stderr — stdout is reserved for
// JSON-RPC — and exits 2.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

try {
  const mod = await import(join(here, '..', 'dist', 'transport-stdio.js'));
  await mod.startStdio();
} catch (err) {
  process.stderr.write(`[kbrelaymcp] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}
