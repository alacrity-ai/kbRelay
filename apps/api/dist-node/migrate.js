import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);

// scripts/migrate-libsql.ts
import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
var url = process.env.DATABASE_URL ?? "file:./kbrelay.db";
var dir = process.env.MIGRATIONS_DIR ?? join(process.cwd(), "migrations");
var client = createClient({ url });
await client.execute(
  "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)"
);
var appliedRs = await client.execute("SELECT name FROM _migrations");
var applied = new Set(appliedRs.rows.map((r) => String(r.name)));
var files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
var count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(join(dir, file), "utf8");
  const tx = await client.transaction("write");
  try {
    await tx.executeMultiple(sql);
    await tx.execute({
      sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
      args: [file, Date.now()]
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
console.log(count === 0 ? "[migrate] up to date" : `[migrate] applied ${count} migration(s)`);
client.close();
