#!/usr/bin/env node
/**
 * kbRelay one-command self-host launcher (KBR-120).
 *
 *   npx @alacrity-ai/kbrelay              start (migrate → serve → banner)
 *   npx @alacrity-ai/kbrelay mint-tenant  headless first-tenant bootstrap
 *
 * Replaces what docker-compose + .env.selfhost do for the Docker path: it
 * resolves a persistent data dir OUTSIDE the npx cache, generates/loads the
 * JWT secret, picks a free port, applies migrations, then runs the bundled
 * Node server (dist-node/server.js) with SPA_DIR/MIGRATIONS_DIR pointing
 * into this package. No repo clone, no Docker, no env-file editing.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { homedir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

// ── Node version gate (the esbuild bundle targets node22) ──────
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) {
  console.error(`\n  ✗ kbRelay needs Node 22 or newer (you have ${process.versions.node}).`);
  console.error('    Upgrade with e.g.:  nvm install 24 && nvm use 24\n');
  process.exit(1);
}

// ── Tiny arg parser: [subcommand] [--flag value]… ───────────────
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--version' || a === '-v') flags.version = true;
  else if (a === '--help' || a === '-h') flags.help = true;
  else if (a.startsWith('--')) {
    flags[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  } else positional.push(a);
}
const command = positional[0] ?? 'start';

if (flags.version) {
  console.log(pkg.version);
  process.exit(0);
}
if (flags.help || command === 'help') {
  console.log(`
  kbRelay self-host v${pkg.version}

  Usage:
    kbrelay [start]                          run the server (default)
      --port <n>        port to listen on (default 8080; walks to a free one)
      --data-dir <dir>  where the db/attachments/secret live
                        (default ~/.kbrelay, env KBRELAY_DATA_DIR)

    kbrelay mint-tenant --tenant <name> --name <you> --email <addr>
                        [--password <pw>] [--label <key label>]
                        headless workspace bootstrap (no browser needed);
                        prints an admin API token once

    kbrelay --version | --help
`);
  process.exit(0);
}

// ── Data dir: MUST live outside the npx cache so it survives upgrades ──
const dataDir = resolve(flags['data-dir'] ?? process.env.KBRELAY_DATA_DIR ?? join(homedir(), '.kbrelay'));
mkdirSync(join(dataDir, 'attachments'), { recursive: true });

// ── JWT secret: generate once, persist at 0600, never print ────
const secretPath = join(dataDir, 'jwt-secret');
if (!existsSync(secretPath)) {
  writeFileSync(secretPath, randomBytes(48).toString('base64'), { mode: 0o600 });
}
chmodSync(secretPath, 0o600);
const jwtSecret = readFileSync(secretPath, 'utf8').trim();

const baseEnv = {
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: `file:${join(dataDir, 'kbrelay.db')}`,
  BLOB_DIR: join(dataDir, 'attachments'),
  MIGRATIONS_DIR: join(pkgDir, 'migrations'),
  SPA_DIR: join(pkgDir, 'web'),
  JWT_SECRET: jwtSecret,
};

/** Apply migrations (idempotent — same tree as Cloudflare D1). */
function migrate(env) {
  const r = spawnSync(process.execPath, [join(pkgDir, 'dist-node', 'migrate.js')], {
    env,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('\n  ✗ Database migration failed — server not started.\n');
    process.exit(r.status ?? 1);
  }
}

// ── mint-tenant: headless bootstrap (migrate first: fresh DB has no tables) ──
if (command === 'mint-tenant') {
  migrate(baseEnv);
  const r = spawnSync(process.execPath, [join(pkgDir, 'dist-node', 'mint-tenant.js')], {
    env: {
      ...baseEnv,
      TENANT: String(flags.tenant ?? ''),
      NAME: String(flags.name ?? ''),
      EMAIL: String(flags.email ?? ''),
      PASSWORD: typeof flags.password === 'string' ? flags.password : '',
      LABEL: typeof flags.label === 'string' ? flags.label : '',
    },
    stdio: 'inherit',
  });
  process.exit(r.status ?? 0);
}

if (command !== 'start') {
  console.error(`\n  ✗ Unknown command "${command}" — try: kbrelay --help\n`);
  process.exit(1);
}

// ── Port: requested, else walk upward to the first free one ────
const requested = Number(flags.port ?? process.env.PORT ?? 8080);
function tryListen(port) {
  return new Promise((done) => {
    const probe = net
      .createServer()
      .once('error', () => done(false))
      .once('listening', () => probe.close(() => done(true)));
    probe.listen(port);
  });
}
let port = requested;
while (!(await tryListen(port))) {
  port++;
  if (port > requested + 50) {
    console.error(`\n  ✗ No free port found between ${requested} and ${requested + 50}.\n`);
    process.exit(1);
  }
}

const baseUrl = `http://localhost:${port}`;
const env = { ...baseEnv, PORT: String(port), PUBLIC_BASE_URL: baseUrl };

migrate(env);

const server = spawn(process.execPath, [join(pkgDir, 'dist-node', 'server.js')], {
  env,
  stdio: 'inherit',
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.kill(sig));
}
server.on('exit', (code) => process.exit(code ?? 0));

// ── Banner once the server actually answers ────────────────────
const deadline = Date.now() + 15_000;
let healthy = false;
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.ok) {
      healthy = true;
      break;
    }
  } catch {
    /* not up yet */
  }
  await sleep(250);
}

if (healthy) {
  const portNote = port === requested ? '' : `  (port ${requested} was busy)`;
  console.log(`
  ─────────────────────────────────────────────────────────────
  kbRelay ${pkg.version} is running  →  ${baseUrl}${portNote}

  First time here?
    1. Open ${baseUrl} and Sign up — that creates your
       workspace (you're the admin). No email setup needed.
    2. Mint an agent key in the app: Team & access → Agents.
    3. Attach an agent (Claude Code shown):
         claude mcp add kbrelay --scope user \\
           --env KBRELAY_BASE_URL=${baseUrl} \\
           --env KBRELAY_API_KEY=<your key> \\
           -- npx -y @alacrity-ai/kbrelaymcp

  Data lives in ${dataDir}
  Stop with Ctrl-C. Upgrade any time: npx @alacrity-ai/kbrelay@latest
  ─────────────────────────────────────────────────────────────
`);
} else {
  console.error(`\n  ⚠ Server process is running but ${baseUrl}/api/health didn't answer within 15s.`);
  console.error('    Check the log lines above for errors.\n');
}
