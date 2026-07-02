import { mkdir, writeFile, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { BlobStore, BlobObject, BlobPutOpts } from '../shared/blob';

/**
 * The self-host `BlobStore` adapter (v0.16.0): stores attachment bytes on the
 * local filesystem under BLOB_DIR (default /data/attachments, alongside the
 * SQLite db in the container's data volume). The object key doubles as the
 * relative path; a resolve-check keeps every path inside the root (keys are
 * server-built from a uuid + sanitized filename, but we guard against traversal
 * regardless). Content-type isn't persisted — the attachment DB row is the
 * source of truth on read, so `get` only returns the byte stream + size.
 *
 * `node:*` imports are confined to `runtime/node/**` per the boundary guard;
 * this file never reaches the Worker bundle.
 */
export function createFsBlobStore(root: string): BlobStore {
  const rootResolved = resolve(root);

  const pathFor = (key: string): string => {
    const full = resolve(rootResolved, key);
    if (full !== rootResolved && !full.startsWith(rootResolved + sep)) {
      throw new Error('blob key escapes storage root');
    }
    return full;
  };

  return {
    async put(key, body, _opts: BlobPutOpts) {
      const full = pathFor(key);
      await mkdir(dirname(full), { recursive: true });
      const data =
        body instanceof ReadableStream
          ? Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0])
          : body instanceof Uint8Array
            ? body
            : Buffer.from(body);
      await writeFile(full, data);
    },

    async get(key): Promise<BlobObject | null> {
      const full = pathFor(key);
      try {
        const st = await stat(full);
        const web = Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
        return { body: web, size: st.size };
      } catch {
        return null;
      }
    },

    async delete(key) {
      try {
        await unlink(pathFor(key));
      } catch {
        /* already gone — delete is idempotent */
      }
    },
  };
}
