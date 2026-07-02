import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLibsqlDb } from '../../runtime/node/libsql-db';
import type { Env } from '../../env';
import { registerTenant } from './auth';
import { createProject, deleteProject } from './projects';
import { createCard, deleteCard } from './cards';
import { addComment, redactComment, listTimeline } from './card_events';
import {
  classifyKind,
  safeFilename,
  attachmentBlobKey,
  newAttachmentId,
  createAttachment,
  getAttachment,
  listCardAttachments,
  attachmentCountsForCard,
  attachmentCountsForCards,
  purgeBlobs,
  type AttachmentInsert,
} from './attachments';

/**
 * Attachments data-layer tests (v0.16.0, KBR-25). In-memory libsql with the
 * SAME migration tree as prod (incl. 0016). Covers classification, create/read,
 * per-kind counts (single + batch), comment linkage via addComment's
 * attachmentIds, and the two cascades (delete-card, redact-comment). No blob
 * store is wired (env.blob undefined) — purgeBlobs no-ops, rows are the SoT.
 */
const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let env: Env;
let tenantId: string;
let userId: string;
let projectId: string;

beforeAll(async () => {
  const { db, client } = createLibsqlDb(':memory:');
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    await client.executeMultiple(await readFile(join(migrationsDir, f), 'utf8'));
  }
  env = {
    db,
    ALLOWED_ORIGINS: '*',
    PUBLIC_BASE_URL: 'http://localhost:8080',
    JWT_SECRET: 'test-secret',
  } as Env;

  const reg = await registerTenant(env, {
    email: 'owner@att.example',
    password: 'ownerpassword',
    name: 'Att Owner',
    tenantName: 'Att Co',
  });
  tenantId = reg.tenantId;
  userId = reg.userId;
  const project = await createProject(env, tenantId, userId, { name: 'Board', code: 'ATT' });
  projectId = project.id;
});

async function makeCard(summary: string): Promise<string> {
  const card = await createCard(env, tenantId, projectId, userId, { summary });
  return card.id;
}

function insert(cardId: string, filename: string, contentType: string, over: Partial<AttachmentInsert> = {}): AttachmentInsert {
  const id = newAttachmentId();
  return {
    id,
    tenantId,
    cardId,
    blobKey: attachmentBlobKey(tenantId, cardId, id, filename),
    filename,
    contentType,
    sizeBytes: 123,
    kind: classifyKind(contentType, filename),
    createdBy: userId,
    ...over,
  };
}

describe('classifyKind', () => {
  it('classifies images', () => {
    expect(classifyKind('image/png', 'a.png')).toBe('image');
    expect(classifyKind('', 'photo.JPG')).toBe('image');
    expect(classifyKind('image/webp', 'x')).toBe('image');
  });
  it('classifies archives (before documents)', () => {
    expect(classifyKind('application/zip', 'a.zip')).toBe('archive');
    expect(classifyKind('', 'bundle.7z')).toBe('archive');
    expect(classifyKind('application/x-rar', 'x')).toBe('archive');
  });
  it('classifies documents', () => {
    expect(classifyKind('application/pdf', 'a.pdf')).toBe('document');
    expect(classifyKind('text/plain', 'notes.txt')).toBe('document');
    expect(classifyKind('', 'sheet.csv')).toBe('document');
    expect(classifyKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'd.docx')).toBe('document');
  });
  it('falls back to misc', () => {
    expect(classifyKind('application/octet-stream', 'cert.cer')).toBe('misc');
    expect(classifyKind('', 'thing.xyz')).toBe('misc');
  });
});

describe('safeFilename', () => {
  it('strips paths and unsafe chars, lowercases', () => {
    expect(safeFilename('/etc/../My File (1).PNG')).toBe('my-file-1-.png');
    expect(safeFilename('')).toBe('file');
    expect(safeFilename('..')).toBe('file');
  });
});

describe('create / read', () => {
  it('creates an attachment and reads it back with a url', async () => {
    const cardId = await makeCard('has attachment');
    const dto = await createAttachment(env, insert(cardId, 'shot.png', 'image/png'));
    expect(dto.kind).toBe('image');
    expect(dto.eventId).toBeNull();
    expect(dto.url).toBe(`/api/v1/attachments/${dto.id}/blob`);

    const got = await getAttachment(env, tenantId, dto.id);
    expect(got?.filename).toBe('shot.png');

    const list = await listCardAttachments(env, tenantId, cardId);
    expect(list.map((a) => a.id)).toEqual([dto.id]);
  });

  it('getAttachment is tenant-scoped (wrong tenant → null)', async () => {
    const cardId = await makeCard('scoped');
    const dto = await createAttachment(env, insert(cardId, 'a.pdf', 'application/pdf'));
    expect(await getAttachment(env, 't_other', dto.id)).toBeNull();
  });
});

describe('counts', () => {
  it('groups per-kind for a card and across cards', async () => {
    const cardId = await makeCard('counts');
    await createAttachment(env, insert(cardId, 'a.png', 'image/png'));
    await createAttachment(env, insert(cardId, 'b.jpg', 'image/jpeg'));
    await createAttachment(env, insert(cardId, 'c.pdf', 'application/pdf'));
    await createAttachment(env, insert(cardId, 'd.zip', 'application/zip'));

    const single = await attachmentCountsForCard(env, tenantId, cardId);
    expect(single).toEqual({ image: 2, document: 1, archive: 1, misc: 0 });

    const empty = await makeCard('no attachments');
    const batch = await attachmentCountsForCards(env, tenantId, [cardId, empty]);
    expect(batch[cardId]).toEqual({ image: 2, document: 1, archive: 1, misc: 0 });
    expect(batch[empty]).toBeUndefined(); // absent → caller defaults to zeros
  });
});

describe('comment linkage (addComment attachmentIds)', () => {
  it('links card-scoped attachments to the new event; ignores foreign ids', async () => {
    const cardId = await makeCard('note with files');
    const otherCard = await makeCard('other');
    const a = await createAttachment(env, insert(cardId, 'log.txt', 'text/plain'));
    const foreign = await createAttachment(env, insert(otherCard, 'x.txt', 'text/plain'));

    await addComment(env, tenantId, cardId, userId, {
      type: 'note',
      body: 'see attached',
      attachmentIds: [a.id, foreign.id],
    });

    const timeline = await listTimeline(env, tenantId, cardId);
    const note = timeline.find((e) => e.kind === 'note')!;

    const relinked = await getAttachment(env, tenantId, a.id);
    expect(relinked?.eventId).toBe(note.id); // linked to this card's note

    const untouched = await getAttachment(env, tenantId, foreign.id);
    expect(untouched?.eventId).toBeNull(); // different card — not stolen
  });
});

describe('cascade', () => {
  it('deleteCard removes the card\'s attachments', async () => {
    const cardId = await makeCard('to delete');
    const dto = await createAttachment(env, insert(cardId, 'a.png', 'image/png'));
    await deleteCard(env, tenantId, cardId);
    expect(await getAttachment(env, tenantId, dto.id)).toBeNull();
  });

  it('redactComment removes that comment\'s attachments', async () => {
    const cardId = await makeCard('to redact');
    const a = await createAttachment(env, insert(cardId, 'secret.txt', 'text/plain'));
    const note = await addComment(env, tenantId, cardId, userId, {
      type: 'note',
      body: 'leaked file',
      attachmentIds: [a.id],
    });
    expect((await getAttachment(env, tenantId, a.id))?.eventId).toBe(note.id);

    await redactComment(env, tenantId, cardId, note.id, userId);
    expect(await getAttachment(env, tenantId, a.id)).toBeNull(); // bytes+row gone
  });
});

/**
 * KBR-41 (harden blob purge, run off the response path) + KBR-43 (project delete
 * must cascade attachments + mentions, not just cards). deleteCard/deleteProject
 * now RETURN the blob keys so the route can purge via ctx.waitUntil.
 */
describe('KBR-41/43: complete cascades + hardened off-path purge', () => {
  it('deleteCard returns the blob keys to purge (rows already gone)', async () => {
    const cardId = await makeCard('return keys');
    const ins = insert(cardId, 'a.png', 'image/png');
    await createAttachment(env, ins);
    const keys = await deleteCard(env, tenantId, cardId);
    expect(keys).toEqual([ins.blobKey]);
    expect(await getAttachment(env, tenantId, ins.id)).toBeNull();
  });

  it('deleteProject cascades attachments + mentions and returns every blob key', async () => {
    const project = await createProject(env, tenantId, userId, { name: 'Doomed', code: 'DOOM' });
    const c1 = (await createCard(env, tenantId, project.id, userId, { summary: 'c1' })).id;
    const c2 = (await createCard(env, tenantId, project.id, userId, { summary: 'c2' })).id;
    const a1 = insert(c1, 'x.png', 'image/png');
    const a2 = insert(c2, 'y.zip', 'application/zip');
    await createAttachment(env, a1);
    await createAttachment(env, a2);
    // A mention on one of the cards (inserted directly — we're testing the cascade).
    await env.db.batch([
      env.db.prepare(
        `INSERT INTO card_mentions
           (id, tenant_id, card_id, recipient_user_id, author_user_id, source_kind, source_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'description', 'description', ?)`,
      ).bind('men_kbr43', tenantId, c1, userId, userId, Date.now()),
    ]);

    const keys = await deleteProject(env, tenantId, project.id);
    expect(new Set(keys)).toEqual(new Set([a1.blobKey, a2.blobKey]));

    // Every child row for the board is gone — no orphans.
    expect(await getAttachment(env, tenantId, a1.id)).toBeNull();
    expect(await getAttachment(env, tenantId, a2.id)).toBeNull();
    const count = async (sql: string, ...binds: unknown[]) =>
      (await env.db.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? -1;
    expect(await count('SELECT COUNT(*) AS n FROM card_mentions WHERE tenant_id = ? AND card_id IN (?, ?)', tenantId, c1, c2)).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM attachments WHERE tenant_id = ? AND card_id IN (?, ?)', tenantId, c1, c2)).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM cards WHERE project_id = ?', project.id)).toBe(0);
  });

  it('purgeBlobs deletes all keys, retries once, and a permanent failure does not abort the rest', async () => {
    const deleted: string[] = [];
    const failOnce = new Set(['flaky']);
    const failAlways = new Set(['broken']);
    const blob = {
      put: async () => {},
      get: async () => null,
      delete: async (key: string) => {
        if (failAlways.has(key)) throw new Error('permanent');
        if (failOnce.has(key)) { failOnce.delete(key); throw new Error('transient'); }
        deleted.push(key);
      },
    };
    await expect(purgeBlobs({ blob } as unknown as Env, ['a', 'b', 'flaky', 'broken', 'c'])).resolves.toBeUndefined();
    // 'broken' stays orphaned (logged); everything else deleted, 'flaky' on retry.
    expect(new Set(deleted)).toEqual(new Set(['a', 'b', 'flaky', 'c']));
  });

  it('purgeBlobs no-ops with no blob store or no keys', async () => {
    await expect(purgeBlobs({} as unknown as Env, ['x'])).resolves.toBeUndefined();
    await expect(purgeBlobs({ blob: {} } as unknown as Env, [])).resolves.toBeUndefined();
  });
});
