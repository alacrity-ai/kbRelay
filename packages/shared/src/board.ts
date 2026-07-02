import { z } from 'zod';

/**
 * Board domain: projects → columns → cards. Types are the wire shapes
 * returned by the API; the zod schemas validate mutation inputs at the
 * Worker boundary and are reused by the typed web client.
 */

export type ProjectStatus = 'active' | 'archived';

/**
 * A column's semantic role (v0.15.0). Optional — a column with no role is
 * neutral (e.g. Backlog). Roles give columns weight without hard-coding names:
 * `ready` = fair game to work, `in_progress` = an agent has picked it up,
 * `review` = handed back for a human, `done` = closed, `blocked` = stuck.
 * At most one column per project may hold a given role (enforced in the repo).
 */
export type ColumnRole = 'ready' | 'in_progress' | 'review' | 'done' | 'blocked';
export const COLUMN_ROLES: readonly ColumnRole[] = [
  'ready',
  'in_progress',
  'review',
  'done',
  'blocked',
];

export interface ProjectDto {
  id: string;
  name: string;
  /** Short prefix for ticket keys, e.g. "OBL". Null only for un-backfilled legacy. */
  code: string | null;
  description: string | null;
  color: string | null;
  status: ProjectStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  /** Total cards in the project. Present on the list endpoint (for the project
   *  browser's badges); undefined on single-project fetches. */
  cardCount?: number;
}

export interface ColumnDto {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
  position: number;
  /** Semantic role, or null for a neutral column. See {@link ColumnRole}. */
  role: ColumnRole | null;
  createdAt: number;
}

export interface CardDto {
  id: string;
  projectId: string;
  columnId: string;
  /** Human ticket key, e.g. "OBL-1" (= project.code + "-" + seq). Null if the
   *  project has no code yet. Derived server-side; not editable. */
  key: string | null;
  /** Per-project sequence number behind the key. */
  seq: number | null;
  /** The descriptive text (was `title` before v0.7.0). */
  summary: string;
  description: string | null;
  acceptanceCriteria: string | null;
  color: string | null;
  position: number;
  assigneeUserId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * An actionable card in the caller's queue (GET /me/queue, v0.15.0): a card
 * assigned to the caller that sits in a `ready`-role column. Enriched with the
 * owning project's code + name so an agent needs no follow-up lookup.
 */
export interface QueueCardDto extends CardDto {
  projectCode: string | null;
  projectName: string;
}

// ── shared field validators ────────────────────────────────
const name = z.string().trim().min(1).max(120);
const color = z.string().trim().max(32).nullable().optional();
const longText = z.string().max(20_000).nullable().optional();
const position = z.number().finite().optional();
const idRef = z.string().min(1).max(64);
/** Project code: 2–6 alphanumerics, stored uppercased. Drives ticket keys. */
const code = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{2,6}$/, 'code must be 2–6 letters or digits')
  .transform((s) => s.toUpperCase());

// ── Projects ───────────────────────────────────────────────
export const createProjectInput = z.object({
  name,
  code,
  description: longText,
  color,
});
export type CreateProjectInput = z.infer<typeof createProjectInput>;

export const patchProjectInput = z.object({
  name: name.optional(),
  code: code.optional(),
  description: longText,
  color,
  status: z.enum(['active', 'archived']).optional(),
});
export type PatchProjectInput = z.infer<typeof patchProjectInput>;

// ── Columns ────────────────────────────────────────────────
/** Column role validator: one of the roles, or null to clear it. */
const columnRole = z.enum(COLUMN_ROLES as [ColumnRole, ...ColumnRole[]]).nullable().optional();

export const createColumnInput = z.object({
  name,
  color,
  position,
  role: columnRole,
});
export type CreateColumnInput = z.infer<typeof createColumnInput>;

export const patchColumnInput = z.object({
  name: name.optional(),
  color,
  position,
  role: columnRole,
});
export type PatchColumnInput = z.infer<typeof patchColumnInput>;

// ── Cards ──────────────────────────────────────────────────
// `summary` is the descriptive text (was `title` before v0.7.0). The ticket key
// (CODE-N) is auto-assigned server-side and not settable. Card color is derived
// from the assignee (v0.2.0).
export const createCardInput = z.object({
  summary: name,
  description: longText,
  acceptanceCriteria: longText,
  columnId: idRef.optional(), // defaults to the first column server-side
  assigneeUserId: idRef.nullable().optional(),
  position,
});
export type CreateCardInput = z.infer<typeof createCardInput>;

// A PATCH that sets columnId + position is a "move".
export const patchCardInput = z.object({
  summary: name.optional(),
  description: longText,
  acceptanceCriteria: longText,
  columnId: idRef.optional(),
  assigneeUserId: idRef.nullable().optional(),
  position,
});
export type PatchCardInput = z.infer<typeof patchCardInput>;

/**
 * The columns every new project is seeded with, in order, with roles pre-wired
 * (v0.15.0). `Backlog` is intentionally role-less (a neutral staging lane); the
 * rest carry the semantic roles that drive the human⇄agent flow. See
 * docs/v0.15.0/2-HUMAN_AGENT_FLOWS_DESIGN.md §1.8.
 */
export const DEFAULT_COLUMNS: ReadonlyArray<{ name: string; color: string; role: ColumnRole | null }> = [
  { name: 'Backlog', color: '#64748b', role: null },
  { name: 'Blocked', color: '#dc2626', role: 'blocked' },
  { name: 'Ready', color: '#0891b2', role: 'ready' },
  { name: 'In Progress', color: '#2563eb', role: 'in_progress' },
  { name: 'In Review', color: '#d97706', role: 'review' },
  { name: 'Done', color: '#16a34a', role: 'done' },
];
