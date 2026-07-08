import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(pkgDir, 'bin', 'kbrelay.mjs');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

const run = (args, env = {}) =>
  spawnSync(process.execPath, [bin, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });

test('--version prints the package version', () => {
  const r = run(['--version']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('--help documents start, mint-tenant, and the flags', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  for (const needle of ['mint-tenant', '--port', '--data-dir', 'KBRELAY_DATA_DIR']) {
    assert.ok(r.stdout.includes(needle), `help should mention ${needle}`);
  }
});

test('unknown command fails with a pointer to --help', () => {
  const r = run(['frobnicate']);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes('Unknown command'));
});

test('data dir + 0600 jwt-secret are created before any subcommand runs', () => {
  // "frobnicate" errors out, but data-dir setup happens first — which is exactly
  // what we want to assert without needing the built dist-node artifacts.
  const dir = mkdtempSync(join(tmpdir(), 'kbrelay-test-'));
  const dataDir = join(dir, 'data');
  run(['frobnicate', '--data-dir', dataDir]);
  assert.ok(existsSync(join(dataDir, 'attachments')), 'attachments dir exists');
  const mode = statSync(join(dataDir, 'jwt-secret')).mode & 0o777;
  assert.equal(mode, 0o600, 'jwt-secret is 0600');
  const secret = readFileSync(join(dataDir, 'jwt-secret'), 'utf8');
  assert.ok(secret.length >= 48, 'secret is long');
  // Second run must NOT rotate the secret (sessions would all invalidate).
  run(['frobnicate', '--data-dir', dataDir]);
  assert.equal(readFileSync(join(dataDir, 'jwt-secret'), 'utf8'), secret, 'secret is stable');
});
