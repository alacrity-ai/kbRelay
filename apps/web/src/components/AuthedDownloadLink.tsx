import { useState, type ReactNode, type MouseEvent } from 'react';
import { fetchBlobObjectUrl } from '../lib/authedBlob';

/** A download link for an auth-gated attachment: fetches the bytes with the
 *  bearer token, then triggers a download from an object URL (a plain <a href>
 *  would hit the endpoint unauthenticated → 401). */
export default function AuthedDownloadLink({
  href,
  filename,
  className,
  children,
}: {
  href: string;
  filename?: string;
  className?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  async function onClick(e: MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const obj = await fetchBlobObjectUrl(href);
      const a = document.createElement('a');
      a.href = obj;
      a.download = filename ?? '';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 10_000);
    } catch {
      /* swallow — the link stays; a retry click re-fetches */
    } finally {
      setBusy(false);
    }
  }
  return (
    <a href={href} className={className} onClick={onClick} aria-busy={busy}>
      {children}
    </a>
  );
}
