import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Self-host migration runner (v0.12.0). Applies the SAME `apps/api/migrations/
 * *.sql` files (the single source shared with D1) to a libsql database, tracking
 * applied names in a `_migrations` ledger so it's idempotent. Because the dialect
 * is identical, no per-file changes are needed — the same SQL text runs.
 *
 *   DATABASE_URL=file:/data/kbrelay.db  MIGRATIONS_DIR=./migrations  node migrate-libsql.js
 */
const url = process.env.DATABASE_URL ?? 'file:./kbrelay.db';
const dir = process.env.MIGRATIONS_DIR ?? join(process.cwd(), 'migrations');

const client = createClient({ url });

await client.execute(
  'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
);
const appliedRs = await client.execute('SELECT name FROM _migrations');
const applied = new Set(appliedRs.rows.map((r) => String(r.name)));

const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(join(dir, file), 'utf8');
  const tx = await client.transaction('write');
  try {
    await tx.executeMultiple(sql); // SQLite parses comments + multiple statements
    await tx.execute({
      sql: 'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
      args: [file, Date.now()],
    });
    await tx.commit();
    console.log(`[migrate] applied ${file}`);
    count++;
  } catch (err) {
    await tx.rollback();
    console.error(`[migrate] FAILED on ${file}:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
console.log(count === 0 ? '[migrate] up to date' : `[migrate] applied ${count} migration(s)`);
client.close();
