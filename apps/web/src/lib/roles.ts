import type { ColumnRole } from '@kbrelay/shared';

/**
 * Display metadata for column roles (v0.15.0) — shared by the board badge
 * (Column.tsx), the Project Settings role picker (ProjectSettings.tsx), and the
 * Claude Code guide's flow demo. `label` is the human name; `color` tints the
 * badge. Roles are semantic, independent of a column's own name/color.
 */
export const ROLE_META: Record<ColumnRole, { label: string; color: string }> = {
  ready: { label: 'Ready', color: '#0891b2' },
  in_progress: { label: 'In Progress', color: '#2563eb' },
  review: { label: 'In Review', color: '#d97706' },
  done: { label: 'Done', color: '#16a34a' },
  blocked: { label: 'Blocked', color: '#dc2626' },
};

/** Roles in display order (matches the default board left→right, minus Backlog). */
export const ROLE_ORDER: ColumnRole[] = ['ready', 'in_progress', 'review', 'done', 'blocked'];
