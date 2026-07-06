import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_ATTACHMENT_BYTES, type AuthContext, type AttachmentDto, type AttachmentCounts } from '@kbrelay/shared';
import { createLibsqlDb } from '../runtime/node/libsql-db';
import { createFsBlobStore } from '../runtime/node/fs-blob';
import type { Env } from '../env';
import type { RouteContext } from '../router';
import { registerTenant } from '../db/repos/auth';
import { createProject } from '../db/repos/projects';
import { createCard } from '../db/repos/cards';
import {
  handleUploadAttachment,
  handleGetAttachment,
  handleGetAttachmentBlob,
  handleDeleteAttachment,
} from './attachments';
import { handleGetCard, handleListCards } from './cards';

/**
 * Attachment route integration (v0.16.0, KBR-26). Drives the actual handlers
 * against a real fs blob store + in-memory libsql: the multipart upload →
 * blob.put → DB row → streamed download → delete path, plus card-DTO enrichment.
 * Exercises the exact bytes-round-trip the API serves, no live server needed.
 */
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

let env: Env;
let auth: AuthContext;
let root: string;
let projectId: string;
let cardId: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'kbrelay-route-blob-'));
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  env = {
    db,
    blob: createFsBlobStore(root),
    ALLOWED_ORIGINS: '*',
    PUBLIC_BASE_URL: 'http://localhost:8080',
    JWT_SECRET: 'test-secret',
  } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@route.example',
    password: 'ownerpassword',
    name: 'Route Owner',
    tenantName: 'Route Co',
  });
  auth = {
    tenantId: reg.tenantId,
    userId: reg.userId,
    userName: 'Route Owner',
    userKind: 'human',
    role: 'admin',
    color: '#000000',
    tokenId: null,
  };
  const project = await createProject(env, reg.tenantId, reg.userId, { name: 'Board', code: 'RTE' });
  projectId = project.id;
  const card = await createCard(env, reg.tenantId, projectId, reg.userId, { summary: 'Card' });
  cardId = card.id;
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function ctx(request: Request, params: Record<string, string>): RouteContext {
  return { request, env, url: new URL(request.url), params, cors: {}, auth, waitUntil: () => {} };
}

/** Run a handler, normalizing a thrown HttpError to `{ status }` (the dispatcher
 *  does this catch in production — here we do it so we can assert error codes). */
async function attempt(p: Promise<Response>): Promise<{ status: number }> {
  try {
    const res = await p;
    return { status: res.status };
  } catch (e) {
    return { status: (e as { status?: number }).status ?? 500 };
  }
}

async function upload(name: string, type: string, bytes: Uint8Array): Promise<{ status: number; body: { attachment: AttachmentDto } }> {
  const fd = new FormData();
  fd.set('file', new File([bytes], name, { type }));
  const req = new Request(`http://x/api/v1/cards/${cardId}/attachments`, { method: 'POST', body: fd });
  try {
    const res = await handleUploadAttachment(ctx(req, { id: cardId }));
    return { status: res.status, body: await res.json() };
  } catch (e) {
    return { status: (e as { status?: number }).status ?? 500, body: undefined };
  }
}

const PNG = new TextEncoder().encode('\x89PNG\r\n\x1a\nfake-image-bytes');
const ZIP = new TextEncoder().encode('PK\x03\x04fake-archive');

describe('attachment routes', () => {
  it('uploads a file, classifies it, and returns a DTO with a url', async () => {
    const { status, body } = await upload('shot.png', 'image/png', PNG);
    expect(status).toBe(201);
    expect(body.attachment.kind).toBe('image');
    expect(body.attachment.filename).toBe('shot.png');
    expect(body.attachment.sizeBytes).toBe(PNG.byteLength);
    expect(body.attachment.url).toBe(`/api/v1/attachments/${body.attachment.id}/blob`);
  });

  it('rejects a request with no file part (400)', async () => {
    const req = new Request(`http://x/api/v1/cards/${cardId}/attachments`, { method: 'POST', body: new FormData() });
    expect((await attempt(handleUploadAttachment(ctx(req, { id: cardId })))).status).toBe(400);
  });

  it('rejects an over-size upload (413)', async () => {
    const big = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    const { status } = await upload('big.bin', 'application/octet-stream', big);
    expect(status).toBe(413);
  });

  it('streams the bytes back — images inline, byte-exact', async () => {
    const { body } = await upload('pic.png', 'image/png', PNG);
    const id = body.attachment.id;
    const res = await handleGetAttachmentBlob(
      ctx(new Request(`http://x/api/v1/attachments/${id}/blob`), { id }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toContain('inline');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const got = new Uint8Array(await res.arrayBuffer());
    expect(got).toEqual(PNG);
  });

  it('forces attachment disposition for non-images and for ?download=1', async () => {
    const { body } = await upload('bundle.zip', 'application/zip', ZIP);
    const id = body.attachment.id;
    const zipRes = await handleGetAttachmentBlob(ctx(new Request(`http://x/api/v1/attachments/${id}/blob`), { id }));
    expect(zipRes.headers.get('content-disposition')).toContain('attachment');

    const { body: img } = await upload('a.png', 'image/png', PNG);
    const dl = await handleGetAttachmentBlob(
      ctx(new Request(`http://x/api/v1/attachments/${img.attachment.id}/blob?download=1`), { id: img.attachment.id }),
    );
    expect(dl.headers.get('content-disposition')).toContain('attachment');
  });

  it('enriches the single-card GET with attachments[] and the board list with counts', async () => {
    const card = await createCard(env, auth.tenantId, projectId, auth.userId, { summary: 'Enrich' });
    const req = new Request(`http://x/api/v1/cards/${card.id}/attachments`, { method: 'POST', body: (() => {
      const fd = new FormData(); fd.set('file', new File([PNG], 'e.png', { type: 'image/png' })); return fd;
    })() });
    await handleUploadAttachment(ctx(req, { id: card.id }));

    const getRes = await handleGetCard(ctx(new Request(`http://x/api/v1/cards/${card.id}`), { id: card.id }));
    const getBody = (await getRes.json()) as { card: { attachments: AttachmentDto[] } };
    expect(getBody.card.attachments.map((a) => a.kind)).toEqual(['image']);

    const listRes = await handleListCards(ctx(new Request(`http://x/api/v1/projects/${projectId}/cards`), { id: projectId }));
    const listBody = (await listRes.json()) as { cards: Array<{ id: string; attachmentCounts: AttachmentCounts }> };
    const enriched = listBody.cards.find((c) => c.id === card.id);
    expect(enriched?.attachmentCounts).toEqual({ image: 1, document: 0, archive: 0, misc: 0 });
  });

  it('deletes an attachment (row + blob); then it 404s', async () => {
    const { body } = await upload('gone.png', 'image/png', PNG);
    const id = body.attachment.id;
    const del = await handleDeleteAttachment(ctx(new Request(`http://x/api/v1/attachments/${id}`, { method: 'DELETE' }), { id }));
    expect(del.status).toBe(200);
    expect((await attempt(handleGetAttachment(ctx(new Request(`http://x/api/v1/attachments/${id}`), { id })))).status).toBe(404);
  });
});
