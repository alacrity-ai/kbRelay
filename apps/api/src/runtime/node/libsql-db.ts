import { createClient, type Client, type InArgs } from '@libsql/client';
import type { Db, DbStatement, DbRunResult } from '../shared/db';

/**
 * The self-host `Db` adapter (v0.12.0): wraps `@libsql/client` so
 * `prepare(sql).bind(...).first()/all()/run()` and `batch([...])` map onto
 * libsql's `execute`/`batch`, normalizing the result shape to match D1. Because
 * libsql is the same SQLite engine as D1, the exact migration SQL and repo
 * queries run unchanged — RETURNING, correlated subqueries, and atomic batch
 * groups all behave identically.
 */
class LibsqlStatement implements DbStatement {
  constructor(
    private readonly client: Client,
    private readonly sql: string,
    private readonly args: InArgs = [],
  ) {}

  bind(...args: unknown[]): DbStatement {
    return new LibsqlStatement(this.client, this.sql, args as InArgs);
  }

  async first<T>(): Promise<T | null> {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return (rs.rows[0] as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return { results: rs.rows as unknown as T[] };
  }

  async run(): Promise<DbRunResult> {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return { success: true, meta: { changes: Number(rs.rowsAffected ?? 0) } };
  }

  /** For batch: the raw libsql statement (used only by this adapter's batch). */
  toInStatement(): { sql: string; args: InArgs } {
    return { sql: this.sql, args: this.args };
  }
}

export interface LibsqlDb {
  db: Db;
  client: Client;
}

/** Build a libsql-backed `Db`. `url` is e.g. `file:/data/kbrelay.db`. */
export function createLibsqlDb(url: string): LibsqlDb {
  const client = createClient({ url });
  const db: Db = {
    prepare: (sql) => new LibsqlStatement(client, sql),
    // 'write' opens a write transaction so the group is atomic (D1 batch parity).
    batch: (stmts) =>
      client.batch(
        stmts.map((s) => (s as LibsqlStatement).toInStatement()),
        'write',
      ),
  };
  return { db, client };
}
