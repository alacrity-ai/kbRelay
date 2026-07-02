import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFsBlobStore } from './fs-blob';

/** Drain a web ReadableStream to a Buffer. */
async function drain(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

describe('createFsBlobStore (self-host adapter)', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'kbrelay-blob-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips put → get → delete (bytes)', async () => {
    const store = createFsBlobStore(root);
    const key = 'attachments/t_x/card_y/uuid-hello.txt';
    const bytes = new TextEncoder().encode('hello attachments');

    await store.put(key, bytes, { contentType: 'text/plain' });

    const got = await store.get(key);
    expect(got).not.toBeNull();
    expect(got!.size).toBe(bytes.byteLength);
    expect((await drain(got!.body)).toString()).toBe('hello attachments');

    await store.delete(key);
    expect(await store.get(key)).toBeNull();
  });

  it('stores nested keys as paths under the root', async () => {
    const store = createFsBlobStore(root);
    const key = 'attachments/t_a/card_b/uuid-file.bin';
    await store.put(key, new Uint8Array([1, 2, 3]), { contentType: 'application/octet-stream' });
    // The object key doubles as the on-disk relative path.
    expect([...(await readFile(join(root, key)))]).toEqual([1, 2, 3]);
  });

  it('get() returns null for a missing key', async () => {
    const store = createFsBlobStore(root);
    expect(await store.get('nope/missing.bin')).toBeNull();
  });

  it('delete() of a missing key is a no-op (idempotent)', async () => {
    const store = createFsBlobStore(root);
    await expect(store.delete('nope/missing.bin')).resolves.toBeUndefined();
  });

  it('rejects keys that escape the storage root', async () => {
    const store = createFsBlobStore(root);
    await expect(
      store.put('../escape.txt', new Uint8Array([0]), { contentType: 'text/plain' }),
    ).rejects.toThrow(/escapes storage root/);
  });
});
