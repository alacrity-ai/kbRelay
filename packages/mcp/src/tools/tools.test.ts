import { describe, it, expect, vi } from 'vitest';
import { allTools } from './index.js';

const dummyClient = { request: vi.fn(async () => ({ ok: true })) } as never;
const byName = (n: string) => allTools.find((t) => t.name === n)!;

describe('tool registry', () => {
  it('exposes the full surface with unique names and short descriptions', () => {
    expect(allTools.length).toBe(23);
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length); // no duplicates
    for (const t of allTools) {
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeLessThanOrEqual(200);
      expect(t.inputSchema).toMatchObject({ type: 'object' });
    }
  });

  it('expected tools are present', () => {
    for (const n of [
      'whoami', 'list_users', 'list_projects', 'get_project', 'create_project', 'update_project',
      'list_cards', 'get_card', 'create_card', 'update_card', 'delete_card',
      'get_timeline', 'add_comment', 'redact_comment', 'get_mentions', 'mark_mentions_read',
      'list_my_queue', 'get_project_activity', 'add_attachment', 'delete_attachment',
      'link_card', 'unlink_card', 'find_cards_by_link',
    ]) {
      expect(byName(n)).toBeDefined();
    }
  });
});

describe('tool input validation (zod, before any request)', () => {
  it('create_project requires name + code', async () => {
    const client = { request: vi.fn() } as never;
    await expect(byName('create_project').run({}, client)).rejects.toThrow();
    expect((client as { request: ReturnType<typeof vi.fn> }).request).not.toHaveBeenCalled();
  });

  it('list_cards requires projectId', async () => {
    await expect(byName('list_cards').run({}, dummyClient)).rejects.toThrow();
  });

  it('mark_mentions_read rejects an empty body (needs ids or all)', async () => {
    await expect(byName('mark_mentions_read').run({}, dummyClient)).rejects.toThrow();
    await expect(byName('mark_mentions_read').run({ all: true }, dummyClient)).resolves.toBeDefined();
  });

  it('builds the right path + query for list_cards filters', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('list_cards').run(
      { projectId: 'prj_1', column: 'col_1', q: 'bug fix' },
      client as never,
    );
    expect(client.request).toHaveBeenCalledWith(
      'GET',
      '/v1/projects/prj_1/cards?column=col_1&q=bug%20fix',
    );
  });

  it('list_my_queue hits /me/queue with an optional projectId scope', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('list_my_queue').run({}, client as never);
    expect(client.request).toHaveBeenCalledWith('GET', '/v1/me/queue');
    await byName('list_my_queue').run({ projectId: 'prj_7' }, client as never);
    expect(client.request).toHaveBeenLastCalledWith('GET', '/v1/me/queue?projectId=prj_7');
  });

  it('get_project_activity builds the events path with paging params', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('get_project_activity').run({ projectId: 'prj_3' }, client as never);
    expect(client.request).toHaveBeenCalledWith('GET', '/v1/projects/prj_3/events');
    await byName('get_project_activity').run(
      { projectId: 'prj_3', since: 1700000000000, limit: 20, cursor: '169_evt_9' },
      client as never,
    );
    expect(client.request).toHaveBeenLastCalledWith(
      'GET',
      '/v1/projects/prj_3/events?since=1700000000000&limit=20&cursor=169_evt_9',
    );
  });

  it('create_card strips projectId into the path, not the body', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('create_card').run({ projectId: 'prj_9', summary: 'hi' }, client as never);
    expect(client.request).toHaveBeenCalledWith('POST', '/v1/projects/prj_9/cards', { summary: 'hi' });
  });

  it('add_attachment requires exactly one of filePath | contentBase64', async () => {
    const client = { request: vi.fn(), upload: vi.fn() } as never;
    await expect(byName('add_attachment').run({ cardId: 'c1' }, client)).rejects.toThrow();
    await expect(
      byName('add_attachment').run(
        { cardId: 'c1', filePath: '/tmp/x.png', contentBase64: 'aGk=', filename: 'x.png' },
        client,
      ),
    ).rejects.toThrow();
    // base64 without a filename is rejected too.
    await expect(
      byName('add_attachment').run({ cardId: 'c1', contentBase64: 'aGk=' }, client),
    ).rejects.toThrow();
  });

  it('add_attachment uploads base64 with a derived content type + markdown snippet', async () => {
    const upload = vi.fn(async () => ({
      attachment: { id: 'att_1', kind: 'image', filename: 'shot.png', url: '/api/v1/attachments/att_1/blob' },
    }));
    const client = { request: vi.fn(), upload } as never;
    const out = (await byName('add_attachment').run(
      { cardId: 'card_1', contentBase64: Buffer.from('png-bytes').toString('base64'), filename: 'shot.png' },
      client,
    )) as { markdown: string };
    expect(upload).toHaveBeenCalledWith('/v1/cards/card_1/attachments', {
      data: new Uint8Array(Buffer.from('png-bytes')),
      filename: 'shot.png',
      contentType: 'image/png',
    });
    expect(out.markdown).toBe('![shot.png](/api/v1/attachments/att_1/blob)');
  });

  it('add_attachment renders non-images as a download link snippet', async () => {
    const upload = vi.fn(async () => ({
      attachment: { id: 'att_2', kind: 'document', filename: 'report.pdf', url: '/api/v1/attachments/att_2/blob' },
    }));
    const client = { request: vi.fn(), upload } as never;
    const out = (await byName('add_attachment').run(
      { cardId: 'card_1', contentBase64: Buffer.from('%PDF').toString('base64'), filename: 'report.pdf' },
      client,
    )) as { markdown: string };
    expect(out.markdown).toBe('[📎 report.pdf](/api/v1/attachments/att_2/blob)');
  });

  it('add_attachment rejects >25 MB with a clear error before any request', async () => {
    const upload = vi.fn();
    const client = { request: vi.fn(), upload } as never;
    const big = Buffer.alloc(26 * 1024 * 1024).toString('base64');
    await expect(
      byName('add_attachment').run({ cardId: 'c1', contentBase64: big, filename: 'big.bin' }, client),
    ).rejects.toThrow(/max 25 MB/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('delete_attachment hits the attachment path', async () => {
    const client = { request: vi.fn(async () => ({ ok: true })) };
    await byName('delete_attachment').run({ attachmentId: 'att_9' }, client as never);
    expect(client.request).toHaveBeenCalledWith('DELETE', '/v1/attachments/att_9');
  });

  it('link_card strips cardId into the path, posts the rest as the body', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('link_card').run(
      { cardId: 'card_1', provider: 'jira', url: 'https://jira/OBL-1', externalKey: 'OBL-1' },
      client as never,
    );
    expect(client.request).toHaveBeenCalledWith('POST', '/v1/cards/card_1/links', {
      provider: 'jira',
      url: 'https://jira/OBL-1',
      externalKey: 'OBL-1',
    });
  });

  it('unlink_card hits the card-link path', async () => {
    const client = { request: vi.fn(async () => ({ ok: true })) };
    await byName('unlink_card').run({ linkId: 'lnk_9' }, client as never);
    expect(client.request).toHaveBeenCalledWith('DELETE', '/v1/card-links/lnk_9');
  });

  it('find_cards_by_link builds the project lookup query', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('find_cards_by_link').run(
      { projectId: 'prj_1', provider: 'github', externalKey: 'org/repo#42' },
      client as never,
    );
    expect(client.request).toHaveBeenCalledWith(
      'GET',
      '/v1/projects/prj_1/card-links?provider=github&externalKey=org%2Frepo%2342',
    );
  });

  it('add_comment passes attachmentIds through', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('add_comment').run(
      { cardId: 'c1', body: 'see file', attachmentIds: ['att_1'] },
      client as never,
    );
    expect(client.request).toHaveBeenCalledWith('POST', '/v1/cards/c1/comments', {
      type: 'note',
      body: 'see file',
      attachmentIds: ['att_1'],
    });
  });

  it('update_project PATCHes only the passed fields (projectId in the path)', async () => {
    const client = { request: vi.fn(async () => ({})) };
    await byName('update_project').run(
      { projectId: 'prj_2', description: 'What this is for', color: null },
      client as never,
    );
    expect(client.request).toHaveBeenCalledWith('PATCH', '/v1/projects/prj_2', {
      description: 'What this is for',
      color: null,
    });
  });
});
