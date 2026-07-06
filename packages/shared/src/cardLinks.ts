/**
 * Card links (external references). A pointer from a card to an external system
 * — a Jira issue, a GitHub PR, a design doc. `provider` names the system,
 * `externalKey` is that system's own id when known (so a card can be *found* by
 * it via GET /projects/:id/card-links?provider=&externalKey=), and `url` is the
 * thing to open. Data-only (no bytes), so it's a plain JSON CRUD.
 */

import { z } from 'zod';

export interface CardLinkDto {
  id: string;
  cardId: string;
  /** The external system, e.g. "jira" | "github" | "notion" (free text). */
  provider: string;
  /** That system's own id, e.g. "OBL-1234" / "org/repo#42". Null when unknown. */
  externalKey: string | null;
  /** The URL to open. */
  url: string;
  /** Optional human label. Null = show the url / provider. */
  title: string | null;
  createdBy: string;
  createdAt: number;
}

export const createCardLinkInput = z.object({
  provider: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(2048),
  externalKey: z.string().trim().min(1).max(120).nullable().optional(),
  title: z.string().trim().min(1).max(200).nullable().optional(),
});
export type CreateCardLinkInput = z.infer<typeof createCardLinkInput>;

/** One hit from a find-cards-by-link lookup: the card + the matching link. */
export interface CardLinkMatch {
  cardId: string;
  cardKey: string | null;
  cardSummary: string;
  link: CardLinkDto;
}
