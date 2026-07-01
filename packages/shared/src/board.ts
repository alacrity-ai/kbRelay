import { z } from 'zod';

/**
 * Board domain: projects → columns → cards. Types are the wire shapes
 * returned by the API; the zod schemas validate mutation inputs at the
 * Worker boundary and are reused by the typed web client.
 */

export type ProjectStatus = 'active' | 'archived';

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
export const createColumnInput = z.object({
  name,
  color,
  position,
});
export type CreateColumnInput = z.infer<typeof createColumnInput>;

export const patchColumnInput = z.object({
  name: name.optional(),
  color,
  position,
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

/** The 4 columns every new project is seeded with, in order. */
export const DEFAULT_COLUMNS: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Todo', color: '#64748b' },
  { name: 'In Progress', color: '#2563eb' },
  { name: 'In Review', color: '#d97706' },
  { name: 'Done', color: '#16a34a' },
];
