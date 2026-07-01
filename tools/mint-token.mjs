#!/usr/bin/env node
/**
 * Mint an API token for a kbRelay user.
 *
 *   node tools/mint-token.mjs --target=local|dev|prod --tenant=<slug> --user=<name> --label=<label>
 *
 * Generates a 32-byte token, stores ONLY its sha256 hash in api_tokens
 * (via `wrangler d1 execute`), and prints the plaintext once. Give the
 * plaintext to the human (they paste it into the web UI) or the agent.
 *
 * target → database / env / locality:
 *   local → kbrelay-dev  --env dev  --local
 *   dev   → kbrelay-dev  --env dev  --remote
 *   prod  → kbrelay      --env prod --remote
 */
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const target = args.target ?? 'local';
const tenantSlug = args.tenant ?? 'lala';
const userName = args.user ?? 'claude';
const label = String(args.label ?? `${userName}-main`).replace(/[^\w.-]/g, '');

const TARGETS = {
  local: { db: 'kbrelay-dev', env: 'dev', locality: '--local' },
  dev: { db: 'kbrelay-dev', env: 'dev', locality: '--remote' },
  prod: { db: 'kbrelay', env: 'prod', locality: '--remote' },
};
const t = TARGETS[target];
if (!t) {
  console.error(`Unknown --target=${target}. Use local | dev | prod.`);
  process.exit(1);
}

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'api');

/** Run a SQL statement against the chosen D1 and return parsed JSON results. */
function d1(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', t.db, '--env', t.env, t.locality, '--json', '--command', sql],
    { cwd: apiDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // wrangler prints a JSON array of statement results; grab the first with results.
  const jsonStart = out.indexOf('[');
  const parsed = JSON.parse(out.slice(jsonStart));
  return parsed[0]?.results ?? [];
}

const esc = (s) => String(s).replace(/'/g, "''");

// 1. Resolve the user within the tenant (case-insensitive on name).
const rows = d1(
  `SELECT u.id AS user_id, u.tenant_id AS tenant_id, u.name AS name, u.kind AS kind
     FROM users u JOIN tenants t ON t.id = u.tenant_id
    WHERE t.slug = '${esc(tenantSlug)}' AND lower(u.name) = lower('${esc(userName)}')`,
);
if (rows.length === 0) {
  console.error(`No user "${userName}" in tenant "${tenantSlug}" on target=${target}.`);
  console.error('Has the seed migration (0002_seed_lala.sql) been applied to this database?');
  process.exit(1);
}
const { user_id, tenant_id, name, kind } = rows[0];

// 2. Mint token + hash.
const token = randomBytes(32).toString('hex'); // 64-char hex plaintext
const tokenHash = createHash('sha256').update(token).digest('hex');
const tokenId = 'tok_' + randomBytes(8).toString('hex');
const now = Date.now();

// 3. Store the hash (never the plaintext).
d1(
  `INSERT INTO api_tokens (id, tenant_id, user_id, token_hash, label, created_at)
   VALUES ('${tokenId}', '${esc(tenant_id)}', '${esc(user_id)}', '${tokenHash}', '${esc(label)}', ${now})`,
);

// 4. Show the plaintext once.
console.log('');
console.log('  ✅ Token minted (store it now — it is not recoverable):');
console.log('');
console.log(`     tenant : ${tenantSlug}`);
console.log(`     user   : ${name} (${kind})`);
console.log(`     label  : ${label}`);
console.log(`     target : ${target} (${t.db})`);
console.log('');
console.log(`     TOKEN  : ${token}`);
console.log('');
console.log('  Use it as:  Authorization: Bearer <TOKEN>');
console.log('');
