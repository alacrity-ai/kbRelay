import { describe, it, expect } from 'vitest';
import { resilientDb } from './resilient-db';
import { HttpError } from '../../http';
import type { Db, DbStatement } from '../shared/db';

// Fast options so retry/timeout paths run in milliseconds.
const FAST = { timeoutMs: 30, readAttempts: 3, backoffMs: 1 };

const lost = () => new Error('D1_ERROR: Network connection lost.');
const hang = () => new Promise<never>(() => {}); // never settles → hits the timeout

/** A fake Db whose statement methods are driven by the supplied callbacks. */
function fakeDb(handlers: {
  first?: () => Promise<unknown>;
  all?: () => Promise<unknown>;
  run?: () => Promise<unknown>;
  batch?: (stmts: DbStatement[]) => Promise<unknown>;
}): { db: Db; prepared: DbStatement[] } {
  const prepared: DbStatement[] = [];
  const make = (): DbStatement => {
    const stmt: DbStatement = {
      bind: () => stmt,
      first: <T>() => (handlers.first?.() ?? Promise.resolve(null)) as Promise<T | null>,
      all: <T>() => (handlers.all?.() ?? Promise.resolve({ results: [] })) as Promise<{ results: T[] }>,
      run: () => (handlers.run?.() ?? Promise.resolve({ success: true, meta: { changes: 0 } })) as ReturnType<DbStatement['run']>,
    };
    return stmt;
  };
  const db: Db = {
    prepare: () => {
      const s = make();
      prepared.push(s);
      return s;
    },
    batch: (stmts) => handlers.batch?.(stmts) ?? Promise.resolve([]),
  };
  return { db, prepared };
}

describe('resilientDb (KBR-108)', () => {
  it('retries a transient read error, then succeeds', async () => {
    let calls = 0;
    const { db } = fakeDb({
      first: () => {
        calls += 1;
        return calls < 2 ? Promise.reject(lost()) : Promise.resolve({ ok: 1 });
      },
    });
    const out = await resilientDb(db, FAST).prepare('SELECT 1').bind().first();
    expect(out).toEqual({ ok: 1 });
    expect(calls).toBe(2); // failed once, retried, succeeded
  });

  it('exhausts transient retries → 503 with Retry-After', async () => {
    let calls = 0;
    const { db } = fakeDb({ first: () => { calls += 1; return Promise.reject(lost()); } });
    await expect(resilientDb(db, FAST).prepare('SELECT 1').first()).rejects.toMatchObject({
      status: 503,
      headers: { 'Retry-After': '2' },
    });
    expect(calls).toBe(FAST.readAttempts);
  });

  it('surfaces a real (non-transient) query error unchanged — not a 503', async () => {
    let calls = 0;
    const { db } = fakeDb({
      first: () => { calls += 1; return Promise.reject(new Error('SQLITE_CONSTRAINT: UNIQUE failed')); },
    });
    await expect(resilientDb(db, FAST).prepare('X').first()).rejects.toThrow(/SQLITE_CONSTRAINT/);
    expect(calls).toBe(1); // not retried
  });

  it('times out a hung read and returns 503', async () => {
    const { db } = fakeDb({ all: () => hang() });
    const err = await resilientDb(db, FAST).prepare('SELECT *').all().catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);
  });

  it('does NOT retry writes (run) — a transient failure maps straight to 503', async () => {
    let calls = 0;
    const { db } = fakeDb({ run: () => { calls += 1; return Promise.reject(lost()); } });
    await expect(resilientDb(db, FAST).prepare('INSERT ...').run()).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1); // writes are never auto-retried
  });

  it('batch unwraps wrapped statements to the real ones', async () => {
    let received: DbStatement[] | null = null;
    const { db, prepared } = fakeDb({ batch: (stmts) => { received = stmts; return Promise.resolve([]); } });
    const r = resilientDb(db, FAST);
    const s1 = r.prepare('A').bind(1);
    const s2 = r.prepare('B');
    await r.batch([s1, s2]);
    // The real batch must receive the underlying statements, not the wrappers.
    expect(received).not.toBeNull();
    expect(received!.every((s) => prepared.includes(s))).toBe(true);
    expect(received!.some((s) => s === (s1 as unknown))).toBe(false);
  });
});
