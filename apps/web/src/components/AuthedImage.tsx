import { useAuthedObjectUrl } from '../lib/authedBlob';

/** An <img> for an auth-gated attachment: fetches the bytes with the bearer
 *  token and renders them from an object URL (see lib/authedBlob). */
export default function AuthedImage({ src, alt }: { src?: string; alt?: string }) {
  const { objectUrl, loading, error } = useAuthedObjectUrl(src);
  if (loading) return <span className="md-img-status">Loading image…</span>;
  if (error || !objectUrl) return <span className="md-img-status error">⚠ Couldn’t load {alt || 'image'}</span>;
  return <img src={objectUrl} alt={alt ?? ''} className="md-img" />;
}
