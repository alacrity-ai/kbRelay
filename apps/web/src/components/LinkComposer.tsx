import { useState } from 'react';
import type { CardLinkDto } from '@kbrelay/shared';
import { addCardLink } from '../lib/api';
import { deriveProvider } from '../lib/externalLinks';

/**
 * "+ Add link" control for the card modal (KBR-91) — paste a URL, optionally
 * name it, and it's attached. The provider is derived from the URL host, so the
 * human never types it. Mirrors AttachmentToolbar: on an unsaved card it calls
 * `resolveCardId` to save first, then links.
 */
export default function LinkComposer({
  cardId,
  resolveCardId,
  onAdded,
  disabled,
}: {
  cardId?: string;
  resolveCardId?: () => Promise<string | null>;
  onAdded: (l: CardLinkDto) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUrl('');
    setTitle('');
    setError(null);
    setOpen(false);
  }

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed || saving || disabled) return;
    // Match the server's zod: require a real absolute URL and surface it here
    // rather than as a 400 round-trip.
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setError('Enter a full URL (including https://).');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setError('Only http and https links are supported.');
      return;
    }
    // Resolve the target card (may save an unsaved card first). Null = aborted.
    let id = cardId ?? null;
    if (!id && resolveCardId) {
      try {
        id = await resolveCardId();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the card');
        return;
      }
    }
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const link = await addCardLink(id, {
        provider: deriveProvider(trimmed),
        url: trimmed,
        title: title.trim() || null,
      });
      onAdded(link);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the link');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="link-toolbar">
        <button type="button" className="subtle link-add" disabled={disabled} onClick={() => setOpen(true)}>
          + Add link
        </button>
        <span className="link-hint">Jira, GitHub, a doc — anything with a URL</span>
      </div>
    );
  }

  return (
    <div className="link-toolbar open">
      <div className="link-fields">
        <input
          className="link-url-input"
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={url}
          autoFocus
          disabled={saving}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape') reset();
          }}
        />
        <input
          className="link-title-input"
          type="text"
          placeholder="Label (optional)"
          value={title}
          disabled={saving}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape') reset();
          }}
        />
      </div>
      <div className="link-actions">
        <button type="button" className="subtle" disabled={saving || !url.trim()} onClick={() => void submit()}>
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button type="button" className="subtle link-cancel" disabled={saving} onClick={reset}>
          Cancel
        </button>
      </div>
      {error && <span className="error-text link-error">{error}</span>}
    </div>
  );
}
