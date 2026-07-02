import { describe, it, expect, vi } from 'vitest';
import { allTools } from './index.js';

const dummyClient = { request: vi.fn(async () => ({ ok: true })) } as never;
const byName = (n: string) => allTools.find((t) => t.name === n)!;

describe('tool registry', () => {
  it('exposes the full surface with unique names and short descriptions', () => {
    expect(allTools.length).toBe(18);
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
      'list_my_queue', 'get_project_activity',
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
