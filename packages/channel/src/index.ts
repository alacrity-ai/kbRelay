import { startChannel, type ChannelConfig } from './server.js';

/**
 * Entry point — reads config from the environment and starts the channel.
 * Env: KBRELAY_BASE_URL, KBRELAY_API_KEY (poll + reply), KBRELAY_CHANNEL_SECRET
 * (signed), KBRELAY_CHANNEL_PORT (default 8790), KBRELAY_CHANNEL_MODE
 * (signed|poll|both, default poll), KBRELAY_CHANNEL_POLL_MS (default 60000).
 */
export async function main(): Promise<void> {
  const mode = (process.env.KBRELAY_CHANNEL_MODE as ChannelConfig['mode']) || 'poll';
  const cfg: ChannelConfig = {
    baseUrl: process.env.KBRELAY_BASE_URL,
    apiKey: process.env.KBRELAY_API_KEY,
    secret: process.env.KBRELAY_CHANNEL_SECRET,
    port: Number(process.env.KBRELAY_CHANNEL_PORT ?? 8790),
    mode: mode === 'signed' || mode === 'both' ? mode : 'poll',
    pollMs: Number(process.env.KBRELAY_CHANNEL_POLL_MS ?? 60_000),
  };
  await startChannel(cfg);
}
