import { useEffect, useState } from 'react';
import type {
  AnalyticsWindow,
  ColumnCountDto,
  LeaderboardEntry,
  ProjectAnalyticsDto,
  ReviewerEntry,
  TenantAnalyticsDto,
  ThroughputPoint,
} from '@kbrelay/shared';
import { ANALYTICS_WINDOWS, colorForUser, UNASSIGNED_COLOR } from '@kbrelay/shared';
import * as api from '../lib/api';

/**
 * Analytics (v0.19.0, KBR-102/104) — a full-page view with two scopes
 * (Project = the selected board, Workspace = everything you can see) and a
 * 7/30/90-day window. All visuals are hand-rolled inline SVG/CSS: the app has
 * zero charting dependencies and this keeps it that way.
 */

const CREATED_COLOR = '#64748b';
const COMPLETED_COLOR = '#10b981';

/** "3d 4h", "5h 12m", "18m" — coarse on purpose; analytics, not stopwatches. */
export function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ''}`;
}

const fmtCycle = (ms: number | null) => (ms == null ? '—' : fmtDuration(ms));

/** Dual-series bar chart: created vs completed per bucket. */
function ThroughputChart({ points, bucket }: { points: ThroughputPoint[]; bucket: 'day' | 'week' }) {
  const W = 720;
  const H = 150;
  const PAD = 4;
  const AXIS = 16;
  const max = Math.max(1, ...points.map((p) => Math.max(p.created, p.completed)));
  const group = (W - PAD * 2) / Math.max(1, points.length);
  const bar = Math.max(1.5, Math.min(10, group / 2 - 1));
  const y = (v: number) => H - AXIS - (v / max) * (H - AXIS - PAD);
  // Sparse x labels: first, last, and a few in between.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg
      className="anx-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Created vs completed per ${bucket}`}
    >
      <line x1={PAD} y1={H - AXIS} x2={W - PAD} y2={H - AXIS} stroke="var(--border)" strokeWidth="1" />
      {points.map((p, i) => {
        const x = PAD + i * group + group / 2;
        return (
          <g key={p.date}>
            <title>{`${p.date} — created ${p.created}, completed ${p.completed}`}</title>
            <rect x={x - bar - 0.5} y={y(p.created)} width={bar} height={H - AXIS - y(p.created)} fill={CREATED_COLOR} rx="1" />
            <rect x={x + 0.5} y={y(p.completed)} width={bar} height={H - AXIS - y(p.completed)} fill={COMPLETED_COLOR} rx="1" />
            {(i % labelEvery === 0 || i === points.length - 1) && (
              <text x={x} y={H - 4} textAnchor="middle" className="anx-chart-label">
                {p.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      <text x={PAD + 2} y={PAD + 8} className="anx-chart-label">{max}</text>
    </svg>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="anx-stat" title={hint}>
      <div className="anx-stat-value">{value}</div>
      <div className="anx-stat-label">{label}</div>
    </div>
  );
}

/** A labelled horizontal bar, scaled against the section max. */
function HBar({ label, count, max, color, badge }: { label: string; count: number; max: number; color: string; badge?: string }) {
  return (
    <div className="anx-hbar-row">
      <span className="anx-hbar-label">
        <span className="anx-dot" style={{ background: color }} />
        {label}
        {badge && <span className={`kind-badge ${badge}`}>{badge}</span>}
      </span>
      <span className="anx-hbar-track">
        <span className="anx-hbar-fill" style={{ width: `${(count / Math.max(1, max)) * 100}%`, background: color }} />
      </span>
      <span className="anx-hbar-count">{count}</span>
    </div>
  );
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const max = Math.max(1, ...entries.map((e) => e.completed));
  return (
    <div className="anx-panel">
      <h3>Leaderboard</h3>
      {entries.length === 0 ? (
        <p className="muted-note">No contributions in this window.</p>
      ) : (
        <>
          {entries.map((e) => (
            <div key={e.userId} className="anx-lb-row">
              <HBar
                label={e.name}
                count={e.completed}
                max={max}
                color={e.color ?? colorForUser(e.userId)}
                badge={e.kind === 'agent' ? 'agent' : undefined}
              />
              <span className="anx-lb-sub">{e.created} created · {e.comments} comments</span>
            </div>
          ))}
          <p className="anx-legend-note">Bar = cards completed (moved to Done) in the window.</p>
        </>
      )}
    </div>
  );
}

function Reviewers({ entries }: { entries: ReviewerEntry[] }) {
  const max = Math.max(1, ...entries.map((e) => e.reviewed));
  return (
    <div className="anx-panel">
      <h3>Top reviewers</h3>
      {entries.length === 0 ? (
        <p className="muted-note">No reviewed completions in this window.</p>
      ) : (
        entries.map((e) => (
          <HBar
            key={e.userId}
            label={e.name}
            count={e.reviewed}
            max={max}
            color={e.color ?? colorForUser(e.userId)}
            badge={e.kind === 'agent' ? 'agent' : undefined}
          />
        ))
      )}
    </div>
  );
}

function ColumnDist({ columns }: { columns: ColumnCountDto[] }) {
  const max = Math.max(1, ...columns.map((c) => c.count));
  return (
    <div className="anx-panel">
      <h3>Cards by column</h3>
      {columns.map((c) => (
        <HBar
          key={c.columnId}
          label={c.name}
          count={c.count}
          max={max}
          color={c.role === 'done' ? COMPLETED_COLOR : c.role ? 'var(--accent)' : UNASSIGNED_COLOR}
        />
      ))}
    </div>
  );
}

function ProjectTable({ dto }: { dto: TenantAnalyticsDto }) {
  return (
    <div className="anx-panel anx-projects">
      <h3>By project</h3>
      {dto.projects.length === 0 ? (
        <p className="muted-note">No projects visible to you.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Project</th><th>Created</th><th>Completed</th><th>Active</th><th>Avg cycle</th></tr>
          </thead>
          <tbody>
            {dto.projects.map((p) => (
              <tr key={p.projectId}>
                <td>
                  <span className="anx-dot" style={{ background: p.color ?? UNASSIGNED_COLOR }} />
                  {p.code && <span className="anx-proj-code">{p.code}</span>} {p.name}
                </td>
                <td>{p.created}</td>
                <td>{p.completed}</td>
                <td>{p.activeCards}</td>
                <td>{fmtCycle(p.avgCycleMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Analytics({ projectId, projectName }: { projectId: string | null; projectName?: string }) {
  const [tab, setTab] = useState<'project' | 'workspace'>(projectId ? 'project' : 'workspace');
  const [days, setDays] = useState<AnalyticsWindow>(30);
  const [data, setData] = useState<ProjectAnalyticsDto | TenantAnalyticsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setData(null);
    setError(null);
    const fetchIt =
      tab === 'project' && projectId
        ? api.getProjectAnalytics(projectId, days)
        : api.getTenantAnalytics(days);
    fetchIt
      .then((r) => { if (!stale) setData(r.analytics); })
      .catch((err) => { if (!stale) setError(err instanceof Error ? err.message : 'Failed to load analytics'); });
    return () => { stale = true; };
  }, [tab, days, projectId]);

  const totals = data?.totals;
  const quiet = totals && totals.created === 0 && totals.completed === 0 && totals.comments === 0;
  const completedPerDay = totals ? (totals.completed / days).toFixed(totals.completed >= days ? 0 : 1) : '—';

  return (
    <div className="anx-wrap">
      <div className="anx-head">
        <h2>Analytics</h2>
        <div className="anx-tabs" role="tablist" aria-label="Analytics scope">
          <button
            role="tab"
            aria-selected={tab === 'project'}
            className={tab === 'project' ? 'active' : ''}
            disabled={!projectId}
            title={projectId ? projectName : 'Select a project first'}
            onClick={() => setTab('project')}
          >
            Project
          </button>
          <button
            role="tab"
            aria-selected={tab === 'workspace'}
            className={tab === 'workspace' ? 'active' : ''}
            onClick={() => setTab('workspace')}
          >
            Workspace
          </button>
        </div>
        <div className="anx-window" role="group" aria-label="Time window">
          {ANALYTICS_WINDOWS.map((w) => (
            <button key={w} className={days === w ? 'active' : ''} onClick={() => setDays(w)}>
              {w}d
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="error anx-error">{error}</p>
      ) : !data ? (
        <div className="loading-wrap"><div className="spinner" /></div>
      ) : (
        <>
          <div className="anx-stats">
            <StatCard label="Created" value={data.totals.created} hint="Cards created in the window" />
            <StatCard label="Completed" value={data.totals.completed} hint="Cards moved to Done in the window" />
            <StatCard label="Active" value={data.totals.activeCards} hint="On the board now, not Done" />
            <StatCard label="Overdue" value={data.totals.overdue} hint="Past their due date, not Done" />
            <StatCard label="Avg cycle" value={fmtCycle(data.cycleTime.avgMs)} hint={`Start → Done, median ${fmtCycle(data.cycleTime.medianMs)} over ${data.cycleTime.samples} cards`} />
            <StatCard label="Done / day" value={completedPerDay} hint="Average completions per day in the window" />
          </div>

          <div className="anx-panel anx-throughput">
            <h3>
              Throughput <span className="anx-legend"><span className="anx-dot" style={{ background: CREATED_COLOR }} /> created <span className="anx-dot" style={{ background: COMPLETED_COLOR }} /> completed · per {data.bucket}</span>
            </h3>
            {quiet ? <p className="muted-note">No activity in this window.</p> : <ThroughputChart points={data.throughput} bucket={data.bucket} />}
          </div>

          <div className="anx-grid">
            {'columns' in data ? <ColumnDist columns={data.columns} /> : <ProjectTable dto={data} />}
            <Leaderboard entries={data.leaderboard} />
            <Reviewers entries={data.reviewers} />
          </div>
        </>
      )}
    </div>
  );
}
