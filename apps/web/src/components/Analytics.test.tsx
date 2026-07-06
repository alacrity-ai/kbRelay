import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { ProjectAnalyticsDto, TenantAnalyticsDto } from '@kbrelay/shared';
import Analytics, { fmtDuration } from './Analytics';

vi.mock('../lib/api', () => ({
  getProjectAnalytics: vi.fn(),
  getTenantAnalytics: vi.fn(),
}));
import * as api from '../lib/api';

const core = {
  windowDays: 30 as const,
  since: 0,
  until: 1,
  bucket: 'day' as const,
  totals: { created: 4, completed: 3, activeCards: 1, overdue: 1, comments: 5 },
  throughput: [
    { date: '2026-07-01', created: 2, completed: 1 },
    { date: '2026-07-02', created: 2, completed: 2 },
  ],
  cycleTime: { avgMs: 3 * 3_600_000, medianMs: 2 * 3_600_000, samples: 3 },
  leaderboard: [
    { userId: 'u_a', name: 'Ada', kind: 'human' as const, color: '#f00', completed: 2, created: 3, comments: 4 },
    { userId: 'u_b', name: 'Bot', kind: 'agent' as const, color: null, completed: 1, created: 1, comments: 1 },
  ],
  reviewers: [{ userId: 'u_a', name: 'Ada', kind: 'human' as const, color: '#f00', reviewed: 2 }],
};

const projectDto: ProjectAnalyticsDto = {
  ...core,
  projectId: 'p1',
  columns: [
    { columnId: 'c1', name: 'Ready', role: 'ready', count: 1 },
    { columnId: 'c2', name: 'Done', role: 'done', count: 3 },
  ],
};

const tenantDto: TenantAnalyticsDto = {
  ...core,
  projects: [
    { projectId: 'p1', name: 'Board One', code: 'ANA', color: '#0f0', created: 4, completed: 3, activeCards: 1, avgCycleMs: 3_600_000 },
  ],
};

beforeEach(() => {
  cleanup();
  vi.mocked(api.getProjectAnalytics).mockResolvedValue({ analytics: projectDto });
  vi.mocked(api.getTenantAnalytics).mockResolvedValue({ analytics: tenantDto });
  vi.mocked(api.getProjectAnalytics).mockClear();
  vi.mocked(api.getTenantAnalytics).mockClear();
});

describe('Analytics', () => {
  it('renders project stats, columns, leaderboard, and reviewers', async () => {
    render(<Analytics projectId="p1" projectName="Board One" />);
    expect(await screen.findByText('Completed')).toBeTruthy();
    expect(api.getProjectAnalytics).toHaveBeenCalledWith('p1', 30);
    // Stat values.
    expect(screen.getByText('4')).toBeTruthy(); // created
    expect(screen.getByText('3h')).toBeTruthy(); // avg cycle
    // Column distribution (project scope).
    expect(screen.getByText('Cards by column')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
    // Leaderboard order + agent badge.
    expect(screen.getAllByText('Ada').length).toBe(2); // leaderboard + reviewers
    expect(screen.getByText('Bot')).toBeTruthy();
    expect(screen.getAllByText('agent').length).toBeGreaterThan(0);
    expect(screen.getByText('Top reviewers')).toBeTruthy();
  });

  it('switches to workspace scope and shows the project table', async () => {
    render(<Analytics projectId="p1" projectName="Board One" />);
    await screen.findByText('Cards by column');
    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }));
    expect(await screen.findByText('By project')).toBeTruthy();
    expect(api.getTenantAnalytics).toHaveBeenCalledWith(30);
    expect(screen.getByText('Board One')).toBeTruthy();
    expect(screen.getByText('ANA')).toBeTruthy();
  });

  it('window selector refetches with the chosen days', async () => {
    render(<Analytics projectId="p1" projectName="Board One" />);
    await screen.findByText('Cards by column');
    fireEvent.click(screen.getByRole('button', { name: '7d' }));
    await waitFor(() => expect(api.getProjectAnalytics).toHaveBeenCalledWith('p1', 7));
  });

  it('defaults to workspace (project tab disabled) with no project selected', async () => {
    render(<Analytics projectId={null} />);
    expect(await screen.findByText('By project')).toBeTruthy();
    expect(api.getTenantAnalytics).toHaveBeenCalledWith(30);
    expect((screen.getByRole('tab', { name: 'Project' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('surfaces API errors', async () => {
    vi.mocked(api.getProjectAnalytics).mockRejectedValue(new Error('nope'));
    render(<Analytics projectId="p1" />);
    expect(await screen.findByText('nope')).toBeTruthy();
  });
});

describe('fmtDuration', () => {
  it('formats coarsely across scales', () => {
    expect(fmtDuration(30_000)).toBe('<1m');
    expect(fmtDuration(18 * 60_000)).toBe('18m');
    expect(fmtDuration(5 * 3_600_000 + 12 * 60_000)).toBe('5h 12m');
    expect(fmtDuration(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h');
    expect(fmtDuration(2 * 86_400_000)).toBe('2d');
  });
});
