import type { Env } from '../../env';
import type {
  AnalyticsCore,
  AnalyticsWindow,
  ColumnCountDto,
  CycleTimeStats,
  LeaderboardEntry,
  ProjectAnalyticsDto,
  ProjectBreakdownEntry,
  ReviewerEntry,
  TenantAnalyticsDto,
  ThroughputPoint,
} from '@kbrelay/shared';

/**
 * Analytics aggregates (v0.19.0, KBR-103). Strategy: a handful of narrow
 * row-fetches (window-bounded, index-backed by idx_card_events_tenant_time),
 * aggregated in code. Boards are small (hundreds of cards, thousands of
 * events); code-side aggregation keeps the SQL portable across D1/libsql and
 * the definitions in one readable place.
 *
 * "Completed" = a `moved` event whose target column's CURRENT role is `done`
 * (roles are mutable and un-historied; this mirrors auto-archive's join). One
 * card counts once per window — its latest done-entry wins for timing and
 * leaderboard attribution.
 */

const DAY_MS = 86_400_000;
const LEADERBOARD_CAP = 20;
const REVIEWERS_CAP = 10;

interface ProjectRef {
  id: string;
  name?: string;
  code?: string | null;
  color?: string | null;
}

interface CreatedRow {
  id: string;
  project_id: string;
  created_by: string;
  created_at: number;
}

interface DoneMoveRow {
  card_id: string;
  author_user_id: string | null;
  created_at: number;
  project_id: string;
}

interface UserRow {
  id: string;
  name: string;
  kind: 'human' | 'agent';
  color: string | null;
}

/** UTC bucket key: the day, or the Monday of the week, as YYYY-MM-DD. */
function bucketKey(ms: number, bucket: 'day' | 'week'): string {
  const d = new Date(ms);
  if (bucket === 'week') {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  }
  return d.toISOString().slice(0, 10);
}

/** Every bucket key covering [since, until], zero-filled by the caller. */
function bucketKeys(since: number, until: number, bucket: 'day' | 'week'): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${bucketKey(since, bucket)}T00:00:00Z`);
  const step = bucket === 'week' ? 7 : 1;
  while (cursor.getTime() <= until) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return keys;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/**
 * D1 caps bound parameters at 100 per statement (libsql allows ~32k, so tests
 * won't catch an overrun — prod did, on the first tenant-wide call). Any
 * IN (...) over an unbounded id list must go through here.
 */
const BIND_CHUNK = 80;
async function chunkedIn<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += BIND_CHUNK) {
    out.push(...(await run(ids.slice(i, i + BIND_CHUNK))));
  }
  return out;
}

function emptyCore(windowDays: AnalyticsWindow, since: number, until: number, bucket: 'day' | 'week'): AnalyticsCore {
  return {
    windowDays,
    since,
    until,
    bucket,
    totals: { created: 0, completed: 0, activeCards: 0, overdue: 0, comments: 0 },
    throughput: bucketKeys(since, until, bucket).map((date) => ({ date, created: 0, completed: 0 })),
    cycleTime: { avgMs: null, medianMs: null, samples: 0 },
    leaderboard: [],
    reviewers: [],
  };
}

interface CoreComputation {
  core: AnalyticsCore;
  /** Per-project rollups for the workspace breakdown. */
  byProject: Map<string, { created: number; completed: number; activeCards: number; cycleSamples: number[] }>;
}

async function computeCore(
  env: Env,
  tenantId: string,
  projectIds: string[],
  windowDays: AnalyticsWindow,
  now: number,
): Promise<CoreComputation> {
  const until = now;
  const since = until - windowDays * DAY_MS;
  const bucket: 'day' | 'week' = windowDays >= 90 ? 'week' : 'day';

  const byProject = new Map<string, { created: number; completed: number; activeCards: number; cycleSamples: number[] }>();
  const proj = (id: string) => {
    let p = byProject.get(id);
    if (!p) {
      p = { created: 0, completed: 0, activeCards: 0, cycleSamples: [] };
      byProject.set(id, p);
    }
    return p;
  };

  if (projectIds.length === 0) {
    return { core: emptyCore(windowDays, since, until, bucket), byProject };
  }
  const projIn = `c.project_id IN (${placeholders(projectIds.length)})`;

  // ── Cards created in the window ──
  const createdRows =
    (
      await env.db
        .prepare(`SELECT c.id, c.project_id, c.created_by, c.created_at FROM cards c WHERE c.tenant_id = ? AND c.created_at >= ? AND ${projIn}`)
        .bind(tenantId, since, ...projectIds)
        .all<CreatedRow>()
    ).results ?? [];

  // ── Done-entries in the window (completion events) ──
  const doneMoves =
    (
      await env.db
        .prepare(
          `SELECT e.card_id, e.author_user_id, e.created_at, c.project_id
             FROM card_events e
             JOIN cards c ON c.id = e.card_id AND c.tenant_id = e.tenant_id
             JOIN columns col ON col.id = json_extract(e.meta_json, '$.to.id') AND col.tenant_id = e.tenant_id
            WHERE e.tenant_id = ? AND e.kind = 'system' AND e.event_type = 'moved'
              AND e.created_at >= ? AND col.role = 'done' AND ${projIn}`,
        )
        .bind(tenantId, since, ...projectIds)
        .all<DoneMoveRow>()
    ).results ?? [];

  // Dedupe to one completion per card — the latest done-entry wins.
  const completions = new Map<string, DoneMoveRow>();
  for (const row of doneMoves) {
    const prev = completions.get(row.card_id);
    if (!prev || row.created_at > prev.created_at) completions.set(row.card_id, row);
  }
  const completedIds = [...completions.keys()];

  // ── Cycle time: first in_progress-entry (fallback: card creation) → done ──
  const cycleStart = new Map<string, number>();
  const reviewerOf = new Map<string, string | null>();
  if (completedIds.length > 0) {
    const starts = await chunkedIn(completedIds, async (chunk) =>
      (
        await env.db
          .prepare(
            `SELECT e.card_id, MIN(e.created_at) AS start_at
               FROM card_events e
               JOIN columns col ON col.id = json_extract(e.meta_json, '$.to.id') AND col.tenant_id = e.tenant_id
              WHERE e.tenant_id = ? AND e.kind = 'system' AND e.event_type = 'moved'
                AND col.role = 'in_progress' AND e.card_id IN (${placeholders(chunk.length)})
              GROUP BY e.card_id`,
          )
          .bind(tenantId, ...chunk)
          .all<{ card_id: string; start_at: number }>()
      ).results ?? [],
    );
    for (const s of starts) cycleStart.set(s.card_id, s.start_at);

    const meta = await chunkedIn(completedIds, async (chunk) =>
      (
        await env.db
          .prepare(`SELECT id, created_at, reviewer_user_id FROM cards WHERE tenant_id = ? AND id IN (${placeholders(chunk.length)})`)
          .bind(tenantId, ...chunk)
          .all<{ id: string; created_at: number; reviewer_user_id: string | null }>()
      ).results ?? [],
    );
    for (const m of meta) {
      if (!cycleStart.has(m.id)) cycleStart.set(m.id, m.created_at);
      reviewerOf.set(m.id, m.reviewer_user_id);
    }
  }

  // ── Board-now counts: active + overdue ──
  const activeRows =
    (
      await env.db
        .prepare(
          `SELECT c.project_id, COUNT(*) AS n,
                  SUM(CASE WHEN c.due_at IS NOT NULL AND c.due_at < ? THEN 1 ELSE 0 END) AS overdue
             FROM cards c
             JOIN columns col ON col.id = c.column_id AND col.tenant_id = c.tenant_id
            WHERE c.tenant_id = ? AND c.archived_at IS NULL
              AND (col.role IS NULL OR col.role <> 'done') AND ${projIn}
            GROUP BY c.project_id`,
        )
        .bind(now, tenantId, ...projectIds)
        .all<{ project_id: string; n: number; overdue: number }>()
    ).results ?? [];

  // ── Comments (notes + handoffs) in the window, per author ──
  const commentRows =
    (
      await env.db
        .prepare(
          `SELECT e.author_user_id, COUNT(*) AS n
             FROM card_events e
             JOIN cards c ON c.id = e.card_id AND c.tenant_id = e.tenant_id
            WHERE e.tenant_id = ? AND e.kind IN ('note','handoff') AND e.deleted_at IS NULL
              AND e.created_at >= ? AND ${projIn}
            GROUP BY e.author_user_id`,
        )
        .bind(tenantId, since, ...projectIds)
        .all<{ author_user_id: string | null; n: number }>()
    ).results ?? [];

  // ── Aggregate in code ──
  const throughputMap = new Map<string, ThroughputPoint>();
  for (const date of bucketKeys(since, until, bucket)) throughputMap.set(date, { date, created: 0, completed: 0 });
  const bump = (ms: number, field: 'created' | 'completed') => {
    const point = throughputMap.get(bucketKey(ms, bucket));
    if (point) point[field] += 1;
  };

  const createdBy = new Map<string, number>();
  for (const row of createdRows) {
    bump(row.created_at, 'created');
    proj(row.project_id).created += 1;
    createdBy.set(row.created_by, (createdBy.get(row.created_by) ?? 0) + 1);
  }

  const completedBy = new Map<string, number>();
  const cycleSamples: number[] = [];
  for (const done of completions.values()) {
    bump(done.created_at, 'completed');
    const p = proj(done.project_id);
    p.completed += 1;
    if (done.author_user_id) completedBy.set(done.author_user_id, (completedBy.get(done.author_user_id) ?? 0) + 1);
    const start = cycleStart.get(done.card_id);
    if (start !== undefined && done.created_at >= start) {
      const sample = done.created_at - start;
      cycleSamples.push(sample);
      p.cycleSamples.push(sample);
    }
  }

  let activeCards = 0;
  let overdue = 0;
  for (const row of activeRows) {
    activeCards += row.n;
    overdue += row.overdue;
    proj(row.project_id).activeCards += row.n;
  }

  const commentsBy = new Map<string, number>();
  let comments = 0;
  for (const row of commentRows) {
    comments += row.n;
    if (row.author_user_id) commentsBy.set(row.author_user_id, (commentsBy.get(row.author_user_id) ?? 0) + row.n);
  }

  const reviewedBy = new Map<string, number>();
  for (const id of completedIds) {
    const reviewer = reviewerOf.get(id);
    if (reviewer) reviewedBy.set(reviewer, (reviewedBy.get(reviewer) ?? 0) + 1);
  }

  // ── Resolve users once for both boards ──
  const userIds = [...new Set([...createdBy.keys(), ...completedBy.keys(), ...commentsBy.keys(), ...reviewedBy.keys()])];
  const users = new Map<string, UserRow>();
  if (userIds.length > 0) {
    const rows = await chunkedIn(userIds, async (chunk) =>
      (
        await env.db
          .prepare(`SELECT id, name, kind, color FROM users WHERE id IN (${placeholders(chunk.length)})`)
          .bind(...chunk)
          .all<UserRow>()
      ).results ?? [],
    );
    for (const u of rows) users.set(u.id, u);
  }
  const userOf = (id: string): UserRow => users.get(id) ?? { id, name: 'Unknown', kind: 'human', color: null };

  const leaderboard: LeaderboardEntry[] = userIds
    .filter((id) => (completedBy.get(id) ?? 0) + (createdBy.get(id) ?? 0) + (commentsBy.get(id) ?? 0) > 0)
    .map((id) => {
      const u = userOf(id);
      return {
        userId: id,
        name: u.name,
        kind: u.kind,
        color: u.color,
        completed: completedBy.get(id) ?? 0,
        created: createdBy.get(id) ?? 0,
        comments: commentsBy.get(id) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.completed - a.completed || b.created - a.created || b.comments - a.comments || a.name.localeCompare(b.name),
    )
    .slice(0, LEADERBOARD_CAP);

  const reviewers: ReviewerEntry[] = [...reviewedBy.entries()]
    .map(([id, reviewed]) => {
      const u = userOf(id);
      return { userId: id, name: u.name, kind: u.kind, color: u.color, reviewed };
    })
    .sort((a, b) => b.reviewed - a.reviewed || a.name.localeCompare(b.name))
    .slice(0, REVIEWERS_CAP);

  cycleSamples.sort((a, b) => a - b);
  const cycleTime: CycleTimeStats = {
    avgMs:
      cycleSamples.length > 0 ? Math.round(cycleSamples.reduce((sum, v) => sum + v, 0) / cycleSamples.length) : null,
    medianMs: median(cycleSamples),
    samples: cycleSamples.length,
  };

  return {
    core: {
      windowDays,
      since,
      until,
      bucket,
      totals: { created: createdRows.length, completed: completions.size, activeCards, overdue, comments },
      throughput: [...throughputMap.values()],
      cycleTime,
      leaderboard,
      reviewers,
    },
    byProject,
  };
}

export async function projectAnalytics(
  env: Env,
  tenantId: string,
  projectId: string,
  windowDays: AnalyticsWindow,
  now: number,
): Promise<ProjectAnalyticsDto> {
  const { core } = await computeCore(env, tenantId, [projectId], windowDays, now);
  const columnRows =
    (
      await env.db
        .prepare(
          `SELECT col.id AS column_id, col.name, col.role, COUNT(c.id) AS n
             FROM columns col
             LEFT JOIN cards c ON c.column_id = col.id AND c.archived_at IS NULL
            WHERE col.tenant_id = ? AND col.project_id = ?
            GROUP BY col.id
            ORDER BY col.position ASC`,
        )
        .bind(tenantId, projectId)
        .all<{ column_id: string; name: string; role: string | null; n: number }>()
    ).results ?? [];
  const columns: ColumnCountDto[] = columnRows.map((r) => ({
    columnId: r.column_id,
    name: r.name,
    role: r.role,
    count: r.n,
  }));
  return { ...core, projectId, columns };
}

export async function tenantAnalytics(
  env: Env,
  tenantId: string,
  access: { userId: string; isAdmin: boolean },
  windowDays: AnalyticsWindow,
  now: number,
): Promise<TenantAnalyticsDto> {
  // RBAC in-query shape matches /v1/search: members see granted projects only.
  const accessClause = access.isAdmin
    ? ''
    : ' AND EXISTS (SELECT 1 FROM project_access pa WHERE pa.project_id = p.id AND pa.user_id = ?)';
  const accessBinds = access.isAdmin ? [] : [access.userId];
  const projects =
    (
      await env.db
        .prepare(
          `SELECT p.id, p.name, p.code, p.color FROM projects p
            WHERE p.tenant_id = ? AND p.status = 'active'${accessClause}
            ORDER BY p.name ASC`,
        )
        .bind(tenantId, ...accessBinds)
        .all<ProjectRef>()
    ).results ?? [];

  const { core, byProject } = await computeCore(env, tenantId, projects.map((p) => p.id), windowDays, now);

  const breakdown: ProjectBreakdownEntry[] = projects
    .map((p) => {
      const agg = byProject.get(p.id) ?? { created: 0, completed: 0, activeCards: 0, cycleSamples: [] };
      const avgCycleMs =
        agg.cycleSamples.length > 0
          ? Math.round(agg.cycleSamples.reduce((sum, v) => sum + v, 0) / agg.cycleSamples.length)
          : null;
      return {
        projectId: p.id,
        name: p.name ?? '',
        code: p.code ?? null,
        color: p.color ?? null,
        created: agg.created,
        completed: agg.completed,
        activeCards: agg.activeCards,
        avgCycleMs,
      };
    })
    .sort((a, b) => b.completed - a.completed || b.created - a.created || a.name.localeCompare(b.name));

  return { ...core, projects: breakdown };
}
