import type { Db, DbStatement } from '../shared/db';
import { HttpError } from '../../http';

/**
 * Resilient D1 wrapper (KBR-108).
 *
 * During the 2026-07-06 Cloudflare Durable Objects incident, D1 threw
 * `D1_ERROR: Network connection lost` and hung; with no timeout on D1 calls,
 * DB-touching endpoints waited 9–45s (wall time ~1000% over normal) and
 * returned 500s / timed out. This wraps the D1-backed `Db` port so a stuck or
 * flapping D1:
 *
 *   - **fails fast** — a per-query timeout so a hung call aborts in a few
 *     seconds instead of 45s,
 *   - **retries transient transport errors on reads** (idempotent) with short
 *     backoff, masking brief DO flaps,
 *   - **surfaces a clean 503 + Retry-After** (never a long hang / opaque 500)
 *     when it genuinely can't recover, so web + MCP clients back off.
 *
 * Writes (`run` / `batch`) get the timeout + 503 mapping but are **not**
 * auto-retried — a retried write could double-apply. Real query errors
 * (constraint violations, etc.) pass through unchanged; only transient
 * transport failures and timeouts become 503.
 *
 * Cloudflare-only: applied in `buildCfBindings`. Self-host libsql runs in-process
 * with no network flap, so it uses the raw port.
 */

export interface ResilientOptions {
  /** Per-attempt timeout in ms (default 2500). */
  timeoutMs?: number;
  /** Max attempts for an idempotent read (default 3; 1 = no retry). */
  readAttempts?: number;
  /** Base backoff between read retries in ms, multiplied by attempt (default 150). */
  backoffMs?: number;
}

const DEFAULTS = { timeoutMs: 2500, readAttempts: 3, backoffMs: 150 };

// Transient D1 / Durable Object transport failures — worth a retry (reads) and,
// if unrecoverable, a 503 rather than a 500. The incident's signature was
// "D1_ERROR: Network connection lost." Kept deliberately narrow so genuine
// query errors (SQL/constraint) are never masked.
const TRANSIENT =
  /network connection lost|connection (?:lost|reset|refused)|reset because|storage caused|not currently available|internal error|too many requests|overloaded/i;

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT.test(msg);
}

class TimeoutError extends Error {}

function withTimeout<T>(op: () => Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TimeoutError(`D1 timeout after ${ms}ms: ${label}`));
    }, ms);
    op().then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function unavailable(): HttpError {
  return new HttpError(503, 'Database temporarily unavailable, please retry.', undefined, {
    'Retry-After': '2',
  });
}

/** Marks the real underlying statement on a wrapper so `batch` can unwrap it. */
const INNER = Symbol('kbrelay.d1.innerStatement');

export function resilientDb(inner: Db, opts: ResilientOptions = {}): Db {
  const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
  const readAttempts = opts.readAttempts ?? DEFAULTS.readAttempts;
  const backoffMs = opts.backoffMs ?? DEFAULTS.backoffMs;

  async function read<T>(op: () => Promise<T>, label: string): Promise<T> {
    for (let attempt = 1; attempt <= readAttempts; attempt++) {
      try {
        return await withTimeout(op, timeoutMs, label);
      } catch (err) {
        const retryable = err instanceof TimeoutError || isTransient(err);
        if (!retryable) throw err; // a real query error — surface it unchanged
        if (attempt < readAttempts) await sleep(backoffMs * attempt);
      }
    }
    throw unavailable(); // exhausted transient/timeout → clean 503
  }

  async function write<T>(op: () => Promise<T>, label: string): Promise<T> {
    try {
      return await withTimeout(op, timeoutMs, label);
    } catch (err) {
      if (err instanceof TimeoutError || isTransient(err)) throw unavailable();
      throw err; // real error (constraint, etc.) — unchanged, no retry
    }
  }

  function wrap(stmt: DbStatement, sql: string): DbStatement {
    const w: DbStatement = {
      bind: (...args: unknown[]) => wrap(stmt.bind(...args), sql),
      first: <T>() => read<T | null>(() => stmt.first<T>(), `first: ${sql}`),
      all: <T>() => read<{ results: T[] }>(() => stmt.all<T>(), `all: ${sql}`),
      run: () => write(() => stmt.run(), `run: ${sql}`),
    };
    (w as unknown as Record<symbol, unknown>)[INNER] = stmt;
    return w;
  }

  return {
    prepare: (sql: string) => wrap(inner.prepare(sql), sql),
    batch: (stmts: DbStatement[]) => {
      // Repos build statements via this wrapper's prepare(), so unwrap to the
      // real underlying statements before handing them to the real batch.
      const real = stmts.map(
        (s) => ((s as unknown as Record<symbol, unknown>)[INNER] as DbStatement | undefined) ?? s,
      );
      return write(() => inner.batch(real), 'batch');
    },
  };
}
