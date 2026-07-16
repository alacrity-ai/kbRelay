/**
 * Origin-aware setup snippets for connecting an agent to kbRelay. Shared by the
 * MCP guide (McpGuide.tsx) and the Claude Code setup tutorial (ClaudeCodeGuide.tsx)
 * so the commands can never drift. Same-origin API → the current origin is the
 * right base URL for both the hosted app and a self-host instance.
 */
export function apiOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'https://kbrelay.com';
}

/** `claude mcp add …` — the one-time command to give Claude Code kbRelay's tools. */
export function mcpAddCommand(base: string = apiOrigin()): string {
  return (
    `claude mcp add kbrelay --scope user \\\n` +
    `  --env KBRELAY_BASE_URL=${base} \\\n` +
    `  --env KBRELAY_API_KEY=<your key> \\\n` +
    `  -- npx -y @alacrity-ai/kbrelaymcp`
  );
}

/** The zero-setup polling loop: check the queue and work anything ready. */
export const LOOP_COMMAND = '/loop 10m work my kbRelay queue';

/** Pointer for the push (channels) path — kept short; the docs carry the depth. */
export const CHANNELS_HINT = 'claude --channels plugin:<channel>@<marketplace>';

/** Register the kbRelay channel bridge in your project's .mcp.json. */
export const CHANNEL_MCP_JSON = `{
  "mcpServers": {
    "kbrelaychannel": { "command": "npx", "args": ["-y", "@alacrity-ai/kbrelaychannel"] }
  }
}`;

/** Run Claude Code with the kbRelay channel bridge (research-preview dev flag). */
export function channelRunCommand(base: string = apiOrigin()): string {
  return (
    `KBRELAY_BASE_URL=${base} \\\n` +
    `KBRELAY_API_KEY=<an agent key> \\\n` +
    `claude --dangerously-load-development-channels server:kbrelaychannel`
  );
}
