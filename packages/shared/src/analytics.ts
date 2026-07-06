/**
 * Analytics DTOs (v0.19.0, KBR-102/103) — read-only aggregates over cards +
 * card_events. Project and workspace scopes share the same core shape; the
 * project payload adds the live column distribution, the workspace payload a
 * per-project breakdown.
 *
 * Definitions the API commits to:
 *   completed — a card is completed when a `moved` event lands it in the
 *     column whose CURRENT role is `done`. Multiple done-entries in a window
 *     count the card once (latest entry wins for timing/attribution). Events
 *     survive archiving, so archived-after-done cards still count; deleted
 *     cards do not (their events are purged).
 *   cycle time — first entry into the `in_progress`-role column (falling back
 *     to card creation when a card skips straight ahead) → the completing
 *     done-entry.
 */

export const ANALYTICS_WINDOWS = [7, 30, 90] as const;
export type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number];
export const DEFAULT_ANALYTICS_WINDOW: AnalyticsWindow = 30;

export interface AnalyticsTotals {
  /** Cards created in the window. */
  created: number;
  /** Distinct cards completed (moved into the done-role column) in the window. */
  completed: number;
  /** On the board now: not archived, not sitting in the done-role column. */
  activeCards: number;
  /** Past due now: due_at < now, not archived, not done. */
  overdue: number;
  /** Notes + handoffs posted in the window (redactions excluded). */
  comments: number;
}

export interface ThroughputPoint {
  /** Bucket start, `YYYY-MM-DD` (UTC). Daily at 7/30 days, weekly at 90. */
  date: string;
  created: number;
  completed: number;
}

export interface ColumnCountDto {
  columnId: string;
  name: string;
  role: string | null;
  /** Non-archived cards currently in the column. */
  count: number;
}

export interface CycleTimeStats {
  avgMs: number | null;
  medianMs: number | null;
  /** Completed cards the stats are computed over. */
  samples: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  kind: 'human' | 'agent';
  color: string | null;
  /** Cards this user moved into done (completions they performed). */
  completed: number;
  /** Cards this user created. */
  created: number;
  /** Notes + handoffs this user posted. */
  comments: number;
}

export interface ReviewerEntry {
  userId: string;
  name: string;
  kind: 'human' | 'agent';
  color: string | null;
  /** Cards completed in the window that carry this user as reviewer. */
  reviewed: number;
}

/** Shape shared by both scopes. */
export interface AnalyticsCore {
  windowDays: AnalyticsWindow;
  /** Window bounds, epoch ms: [since, until). */
  since: number;
  until: number;
  bucket: 'day' | 'week';
  totals: AnalyticsTotals;
  throughput: ThroughputPoint[];
  cycleTime: CycleTimeStats;
  leaderboard: LeaderboardEntry[];
  reviewers: ReviewerEntry[];
}

export interface ProjectAnalyticsDto extends AnalyticsCore {
  projectId: string;
  /** Live distribution of non-archived cards across the board's columns. */
  columns: ColumnCountDto[];
}

export interface ProjectBreakdownEntry {
  projectId: string;
  name: string;
  code: string | null;
  color: string | null;
  created: number;
  completed: number;
  activeCards: number;
  avgCycleMs: number | null;
}

export interface TenantAnalyticsDto extends AnalyticsCore {
  /** Per-project breakdown over the caller's accessible projects. */
  projects: ProjectBreakdownEntry[];
}

export interface ProjectAnalyticsResponse {
  analytics: ProjectAnalyticsDto;
}

export interface TenantAnalyticsResponse {
  analytics: TenantAnalyticsDto;
}
