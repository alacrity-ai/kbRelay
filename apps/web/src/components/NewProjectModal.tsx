import { useEffect, useRef, useState } from 'react';

/**
 * Create a project: a name plus a short ticket-key code (e.g. OBL). Shows a live
 * "first ticket: OBL-1" preview. The code is uppercased and validated client-side;
 * the server enforces uniqueness.
 */
export default function NewProjectModal({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, code: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const codeValid = /^[A-Z0-9]{2,6}$/.test(code);
  const canCreate = name.trim().length > 0 && codeValid && !busy;

  async function create() {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), code);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="np-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="np-title">New project</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Project name</label>
            <input
              ref={nameRef}
              value={name}
              placeholder="e.g. Orderbase - Launch"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
            />
          </div>
          <div className="field">
            <label>Ticket code</label>
            <input
              className="code-input"
              value={code}
              placeholder="e.g. OBL"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
            />
            <p className="muted-note">
              2–6 letters/digits. {code
                ? <>Tickets will be keyed <strong>{codeValid ? `${code}-1` : `${code}…`}</strong>, <strong>{codeValid ? `${code}-2` : ''}</strong>…</>
                : 'e.g. OBL → OBL-1, OBL-2…'}
            </p>
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button className="ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="primary" onClick={create} disabled={!canCreate}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
