import { useEffect, useState } from 'react';
import { getToken } from './auth';

/**
 * Attachment blob URLs (`/api/v1/attachments/:id/blob`) require auth, but this
 * app authenticates with a **bearer token in localStorage — there is no cookie
 * session** (`lib/auth.ts`). A plain `<img src>` / `<a href>` can't send a
 * bearer header, so it hits the endpoint unauthenticated → 401 → broken image /
 * failed download. So we fetch the bytes ourselves (with the header) and hand
 * the browser an `object:` URL instead. (v0.16.0 — KBR-31 fix.)
 */
export async function fetchBlobObjectUrl(url: string): Promise<string> {
  const token = getToken();
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = new Error(`Failed to load (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return URL.createObjectURL(await res.blob());
}

interface BlobUrlState {
  objectUrl?: string;
  loading: boolean;
  error: boolean;
  /** HTTP status of a failed fetch (404 ⇒ the attachment was removed). */
  status?: number;
}

/** Fetch `url` (authenticated) into an object URL, revoking it on unmount/change. */
export function useAuthedObjectUrl(url?: string): BlobUrlState {
  const [state, setState] = useState<BlobUrlState>({ loading: Boolean(url), error: false });
  useEffect(() => {
    if (!url) {
      setState({ loading: false, error: false });
      return;
    }
    let alive = true;
    let created: string | null = null;
    setState({ loading: true, error: false });
    fetchBlobObjectUrl(url)
      .then((obj) => {
        if (!alive) {
          URL.revokeObjectURL(obj);
          return;
        }
        created = obj;
        setState({ objectUrl: obj, loading: false, error: false });
      })
      .catch((e: Error & { status?: number }) => {
        if (alive) setState({ loading: false, error: true, status: e?.status });
      });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);
  return state;
}

/** Is this one of our (auth-gated) attachment blob URLs? */
export function isAttachmentUrl(href?: string): boolean {
  return typeof href === 'string' && href.startsWith('/api/v1/attachments/');
}

interface TextState {
  text?: string;
  loading: boolean;
  error: boolean;
  status?: number;
}

/** Fetch `url` (authenticated) as text — for markdown/txt previews (KBR-95). */
export function useAuthedText(url?: string): TextState {
  const [state, setState] = useState<TextState>({ loading: Boolean(url), error: false });
  useEffect(() => {
    if (!url) {
      setState({ loading: false, error: false });
      return;
    }
    let alive = true;
    setState({ loading: true, error: false });
    const token = getToken();
    fetch(url, { credentials: 'include', headers: token ? { authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        if (!res.ok) {
          if (alive) setState({ loading: false, error: true, status: res.status });
          return;
        }
        const text = await res.text();
        if (alive) setState({ text, loading: false, error: false });
      })
      .catch(() => {
        if (alive) setState({ loading: false, error: true });
      });
    return () => { alive = false; };
  }, [url]);
  return state;
}
