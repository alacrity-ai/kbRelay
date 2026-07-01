/**
 * The `Db` port (v0.12.0). Deliberately shaped like the **D1 binding's own
 * surface**, so kbRelay's repos change by a rename (`env.db` → `env.db`), not a
 * rewrite. Two concrete implementations satisfy it:
 *
 *  - Cloudflare: the D1 binding itself (`runtime/cf` passes `env.db` straight
 *    through — it structurally satisfies this port).
 *  - Self-host: a thin `@libsql/client` adapter (`runtime/node/libsql-db.ts`)
 *    that normalizes libsql's result shape to match D1's.
 *
 * `batch` is the only transaction primitive kbRelay uses; both backends run it
 * atomically, so parity is trivial. Repos build `DbStatement`s via
 * `env.db.prepare(...)` and hand them to the SAME `env.db.batch(...)`, so a
 * runtime's statements are only ever consumed by its own batch.
 */
export interface Db {
  prepare(sql: string): DbStatement;
  batch(stmts: DbStatement[]): Promise<unknown>;
}

export interface DbStatement {
  bind(...args: unknown[]): DbStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<DbRunResult>;
}

export interface DbRunResult {
  success: boolean;
  /** Rows affected — used for "did anything change?" checks (revoke, etc.). */
  meta: { changes: number };
}
