import { z } from 'zod';

/**
 * Labels (v0.17.0, KBR-62): flat, per-project, capped, filterable — a palette,
 * not a taxonomy. Deliberate refusals: no tenant-global labels, no
 * descriptions, no nesting, no auto-label rules, no label-required policies.
 */

/** Hard cap per project (enforced on create, 409 over). If 12 isn't enough,
 *  the board is misusing labels as a field system. */
export const MAX_LABELS_PER_PROJECT = 12;

export interface LabelDto {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: number;
}

/** The label shape embedded on card payloads: enough to render a chip and to
 *  let an agent reason by name — never by id. */
export interface CardLabel {
  id: string;
  name: string;
  color: string;
}

const labelName = z.string().trim().min(1).max(32);
const labelColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex');

export const createLabelInput = z.object({ name: labelName, color: labelColor });
export type CreateLabelInput = z.infer<typeof createLabelInput>;

export const patchLabelInput = z
  .object({ name: labelName.optional(), color: labelColor.optional() })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: 'Provide name and/or color',
  });
export type PatchLabelInput = z.infer<typeof patchLabelInput>;
