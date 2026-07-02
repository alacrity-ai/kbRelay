/**
 * The `BlobStore` port (v0.16.0) — the attachments storage seam, the exact
 * sibling of the `Db` port (`./db.ts`). Deliberately shaped like R2's own
 * surface, so on Cloudflare the adapter is a near-passthrough of the R2 binding.
 * Two concrete implementations satisfy it:
 *
 *  - Cloudflare: an R2 binding wrapper (`runtime/cf/bindings.ts`).
 *  - Self-host: a filesystem store rooted at BLOB_DIR (`runtime/node/fs-blob.ts`),
 *    living in the same /data volume as the SQLite db. A future MinIO/S3 adapter
 *    would implement this same interface with no other change.
 *
 * Named `BlobStore` (not `Blob`) so it never shadows the global web `Blob`.
 * Handlers reach it only via `env.blob`, never a raw R2/fs handle — the same
 * discipline `check-no-inline-db` enforces for `env.db`.
 */

/** Bodies we accept on upload: a stream (Worker `File.stream()`), or bytes. */
export type BlobBody = ReadableStream | ArrayBuffer | Uint8Array;

export interface BlobPutOpts {
  /** MIME type stored as the object's content-type (R2 uses it; fs ignores it —
   *  the attachment row is the source of truth for content-type on read). */
  contentType: string;
  /** Byte length when known. Advisory; adapters may ignore it. */
  size?: number;
}

export interface BlobObject {
  /** The object's bytes as a web ReadableStream, to hand straight to a Response. */
  body: ReadableStream;
  /** Byte length of the stored object. */
  size: number;
}

export interface BlobStore {
  /** Store `body` under `key`, overwriting any existing object. */
  put(key: string, body: BlobBody, opts: BlobPutOpts): Promise<void>;
  /** Fetch an object, or `null` if the key doesn't exist. */
  get(key: string): Promise<BlobObject | null>;
  /** Remove an object. Idempotent — deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
}
