import { useRef, useState } from 'react';
import type { AttachmentDto } from '@kbrelay/shared';
import { uploadAttachment } from '../lib/api';

/**
 * Reusable upload control (v0.16.0): a "+ Attach" button plus a drop target.
 * Used under the card description and in the timeline composer. Uploads each
 * dropped/picked file and calls `onUploaded` with the created attachment so the
 * caller can inject its markdown + track its id.
 */
export default function AttachmentToolbar({
  cardId,
  onUploaded,
  disabled,
  hint,
}: {
  cardId: string;
  onUploaded: (a: AttachmentDto) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || disabled || uploading) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        onUploaded(await uploadAttachment(cardId, file));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div
      className={`attach-toolbar ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        className="subtle attach-add"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading…' : '+ Attach'}
      </button>
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => void handleFiles(e.target.files)} />
      <span className="attach-hint">{dragging ? 'Drop to upload' : hint ?? 'or drop files here'}</span>
      {error && <span className="error-text attach-error">{error}</span>}
    </div>
  );
}
