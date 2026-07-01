import { createRequire } from 'node:module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { KbRelayClient } from './client.js';
import { allTools } from './tools/index.js';

// Single source of truth for the advertised version: the package's own
// package.json (resolved at runtime — dist/server.js sits one dir under the
// package root). Avoids the hardcoded string drifting from the npm version.
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

/**
 * The low-level MCP server: advertises `allTools` for ListTools, and for
 * CallTool finds the tool by name, validates+runs it (zod validation happens
 * inside the tool's runner), and returns the JSON result as text content
 * (`isError: true` on failure).
 */
export function createServer(opts: { client: KbRelayClient }): Server {
  const server = new Server(
    { name: 'kbrelaymcp', version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = allTools.find((t) => t.name === req.params.name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
    }
    try {
      const result = await tool.run(req.params.arguments, opts.client);
      return { content: [{ type: 'text', text: JSON.stringify(result ?? { ok: true }, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      };
    }
  });

  return server;
}
