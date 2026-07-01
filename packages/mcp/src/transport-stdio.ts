import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { KbRelayClient } from './client.js';
import { createServer } from './server.js';

/**
 * stdio entrypoint. Resolves config, logs the active base URL to **stderr**
 * (stdout is reserved for the JSON-RPC protocol), and connects the server over
 * stdio. Thrown config errors propagate to the bin shim, which prints them and
 * exits 2.
 */
export async function startStdio(): Promise<void> {
  const config = loadConfig();
  process.stderr.write(`[kbrelaymcp] kbRelay MCP server → ${config.baseUrl}\n`);
  const client = new KbRelayClient(config);
  const server = createServer({ client });
  await server.connect(new StdioServerTransport());
}
