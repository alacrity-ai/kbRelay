import { describe, it, expect, vi, afterEach } from 'vitest';
import { KbRelayClient } from './client.js';

const cfg = { baseUrl: 'https://kb.test', apiKey: 'secret-token' };

afterEach(() => vi.restoreAllMocks());

describe('KbRelayClient', () => {
  it('builds the URL under /api, sets the bearer header, and returns JSON', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ user: { id: 'u_1' } }), { status: 200 });
      }),
    );
    const client = new KbRelayClient(cfg);
    const res = await client.request<{ user: { id: string } }>('GET', '/v1/me');

    expect(res.user.id).toBe('u_1');
    expect(calls[0]!.url).toBe('https://kb.test/api/v1/me');
    expect(calls[0]!.init.method).toBe('GET');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer secret-token');
  });

  it('serializes a JSON body on writes', async () => {
    let sentBody: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sentBody = init.body as string;
        return new Response(JSON.stringify({ ok: true }), { status: 201 });
      }),
    );
    await new KbRelayClient(cfg).request('POST', '/v1/projects', { name: 'X', code: 'X' });
    expect(JSON.parse(sentBody!)).toEqual({ name: 'X', code: 'X' });
  });

  it('maps a non-2xx {error, details} into a thrown Error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Validation failed', details: { code: 'required' } }), { status: 400 })),
    );
    await expect(new KbRelayClient(cfg).request('POST', '/v1/projects', {})).rejects.toThrow(
      /Validation failed — code: required/,
    );
  });

  it('throws a clear error on a non-JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await expect(new KbRelayClient(cfg).request('GET', '/v1/me')).rejects.toThrow(/failed \(500\)/);
  });
});
