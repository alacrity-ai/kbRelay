import { randomBytes } from 'node:crypto';
import { buildNodeBindings } from '../src/runtime/node/bindings';
import { registerTenant, createToken } from '../src/db/repos/auth';

/**
 * Offline tenant bootstrap for self-host (v0.12.0) — the no-email equivalent of
 * self-registration. Creates a tenant + admin owner (+ starter agent) and mints
 * a first API token, printing the plaintext once. Reuses `registerTenant` so the
 * result is byte-identical to a web sign-up.
 *
 *   TENANT="Acme" NAME="Ada Owner" EMAIL=you@acme.com [PASSWORD=…] [LABEL=admin-key] \
 *     node mint-tenant.js
 *
 * NOTE: env vars arrive as "" (not undefined) when the Makefile forwards an
 * unset var via `-e VAR="$(VAR)"`, so we treat empty/whitespace as absent —
 * otherwise `?? default` never fires and you'd get a nameless owner / empty
 * password.
 */
const val = (v?: string): string => (v ?? '').trim();

const tenantName = val(process.env.TENANT);
const email = val(process.env.EMAIL);
const name = val(process.env.NAME) || val(process.env.OWNER_NAME); // NAME preferred; OWNER_NAME is a back-compat alias
const providedPassword = val(process.env.PASSWORD);
const label = val(process.env.LABEL) || 'admin-key';

function fail(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`);
  console.error('  Usage: TENANT="Workspace" NAME="Your Name" EMAIL=you@example.com [PASSWORD=…] [LABEL=admin-key]\n');
  process.exit(1);
}

const missing = ([['TENANT', tenantName], ['NAME', name], ['EMAIL', email]] as const)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) fail(`Missing required: ${missing.join(', ')}`);
if (providedPassword && providedPassword.length < 8) fail('PASSWORD must be at least 8 characters');

// No password given → generate a strong one (and print it once, below).
const generatedPassword = !providedPassword;
const password = providedPassword || randomBytes(12).toString('base64url');

const { env } = buildNodeBindings(process.env);

try {
  const { tenantId, userId } = await registerTenant(env, { email, password, name, tenantName });
  const { secret } = await createToken(env, tenantId, userId, label);

  console.log('');
  console.log('  ✅ Tenant created (store the token — it is not recoverable):');
  console.log('');
  console.log(`     workspace : ${tenantName}`);
  console.log(`     admin     : ${name} <${email}>`);
  if (generatedPassword) console.log(`     password  : ${password}   (generated — change it after signing in)`);
  console.log(`     API token : ${secret}`);
  console.log('');
  console.log('  Use the token as:  Authorization: Bearer <token>');
  console.log('');
} catch (err) {
  // e.g. "That email is already registered" (HttpError from registerTenant).
  fail(err instanceof Error ? err.message : String(err));
}
