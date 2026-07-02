import { useAuthedObjectUrl } from '../lib/authedBlob';

/** An <img> for an auth-gated attachment: fetches the bytes with the bearer
 *  token and renders them from an object URL (see lib/authedBlob). */
export default function AuthedImage({ src, alt }: { src?: string; alt?: string }) {
  const { objectUrl, loading, error, status } = useAuthedObjectUrl(src);
  if (loading) return <span className="md-img-status">Loading image…</span>;
  // A 404 means the attachment was deleted — say so plainly (KBR-34).
  if (status === 404) return <span className="md-img-status removed">🗑 Attachment removed</span>;
  if (error || !objectUrl) return <span className="md-img-status error">⚠ Couldn’t load {alt || 'image'}</span>;
  return <img src={objectUrl} alt={alt ?? ''} className="md-img" />;
}
