/**
 * Attachments (v0.16.0). A file hung off a card's **description** (`eventId`
 * null) or a specific **note / handoff** (`eventId` set). `kind` is classified
 * server-side so the board badge row and the inline-vs-download decision are
 * consistent across API + web. See docs/v0.16.0/0-ATTACHMENTS_DESIGN.md.
 */

export type AttachmentKind = 'image' | 'document' | 'archive' | 'misc';
export const ATTACHMENT_KINDS: readonly AttachmentKind[] = [
  'image',
  'document',
  'archive',
  'misc',
];

/** Max upload size in bytes (25 MB). Enforced server-side (413 over it). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface AttachmentDto {
  id: string;
  cardId: string;
  /** Null = attached to the card description; set = attached to that timeline comment. */
  eventId: string | null;
  /** Original filename, for display + the download filename. */
  filename: string;
  contentType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  createdBy: string;
  createdAt: number;
  /** Same-origin URL to stream the bytes. Append `?download=1` to force download. */
  url: string;
}

/** Per-kind attachment counts for a card — surfaced on the board list DTO. */
export interface AttachmentCounts {
  image: number;
  document: number;
  archive: number;
  misc: number;
}

/** Zero counts (a card with no attachments). */
export const EMPTY_ATTACHMENT_COUNTS: AttachmentCounts = {
  image: 0,
  document: 0,
  archive: 0,
  misc: 0,
};
