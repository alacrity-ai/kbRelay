/**
 * "Most recently viewed" project order, kept in localStorage (KBR-6). The
 * project switcher and browser sort by this so the boards you actually use
 * float to the top as a tenant's project count grows. Defensive: any storage
 * error degrades to "no recency" (falls back to the incoming order).
 */
const KEY = 'kbrelay.recentProjects';
const CAP = 50;

export function getRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Record that `id` was just opened — moves it to the front of the recency list. */
export function recordProjectView(id: string): void {
  try {
    const next = [id, ...getRecentIds().filter((x) => x !== id)].slice(0, CAP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recency is best-effort */
  }
}

/**
 * Return `projects` sorted most-recently-viewed first. Never-viewed projects
 * keep their incoming relative order (the API returns them createdAt-desc), so
 * a fresh user with no recency sees the current default order.
 */
export function orderByRecency<T extends { id: string }>(projects: T[]): T[] {
  const rank = new Map(getRecentIds().map((id, i) => [id, i] as const));
  return [...projects].sort((a, b) => {
    const ra = rank.get(a.id) ?? Infinity;
    const rb = rank.get(b.id) ?? Infinity;
    return ra - rb; // stable sort keeps equal-rank (unseen) items in place
  });
}
