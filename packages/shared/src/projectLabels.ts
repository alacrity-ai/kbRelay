import { z } from 'zod';

/**
 * Project labels (KBR-84): tenant-wide buckets a project can carry several of
 * ("Side gigs", "Day Job", "Home stuff"). Unlike card labels (per-project),
 * these are TENANT-scoped — the same label spans many projects. Flat and
 * capped: a palette for organising boards, not a taxonomy.
 */

/** Hard cap per tenant (enforced on create, 409 over). A tenant with more than
 *  this many organising buckets is using labels as a field system. */
export const MAX_PROJECT_LABELS_PER_TENANT = 24;

export interface ProjectLabelDto {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

const projectLabelName = z.string().trim().min(1).max(32);
const projectLabelColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex');

export const createProjectLabelInput = z.object({ name: projectLabelName, color: projectLabelColor });
export type CreateProjectLabelInput = z.infer<typeof createProjectLabelInput>;

export const patchProjectLabelInput = z
  .object({ name: projectLabelName.optional(), color: projectLabelColor.optional() })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: 'Provide name and/or color',
  });
export type PatchProjectLabelInput = z.infer<typeof patchProjectLabelInput>;

/**
 * Replace a project's label set. Web sends `labelIds`; agents may send
 * `labelNames` (case-insensitive, resolved within the tenant). Exactly one of
 * the two must be present; `{ labelIds: [] }` clears all labels.
 */
export const setProjectLabelsInput = z
  .object({
    labelIds: z.array(z.string()).optional(),
    labelNames: z.array(z.string()).optional(),
  })
  .refine((v) => v.labelIds !== undefined || v.labelNames !== undefined, {
    message: 'Provide labelIds or labelNames',
  });
export type SetProjectLabelsInput = z.infer<typeof setProjectLabelsInput>;
