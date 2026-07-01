import {
  createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';

interface ConfirmOpts { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
interface PromptOpts { title: string; message?: string; label?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string }
interface AlertOpts { title: string; message?: string; confirmLabel?: string }

type Req =
  | ({ id: number; kind: 'confirm'; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ id: number; kind: 'prompt'; resolve: (v: string | null) => void } & PromptOpts)
  | ({ id: number; kind: 'alert'; resolve: () => void } & AlertOpts);

interface DialogApi {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alert: (o: AlertOpts) => Promise<void>;
}

const Ctx = createContext<DialogApi | null>(null);

/** Themed replacements for window.confirm/prompt/alert. Promise-based, so a call
 *  site reads `const name = await dialog.prompt(...)`. */
export function useDialog(): DialogApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useDialog must be used within <DialogProvider>');
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Req | null>(null);
  const idRef = useRef(0);

  const api = useMemo<DialogApi>(() => ({
    confirm: (o) => new Promise((resolve) => setReq({ id: ++idRef.current, kind: 'confirm', resolve, ...o })),
    prompt: (o) => new Promise((resolve) => setReq({ id: ++idRef.current, kind: 'prompt', resolve, ...o })),
    alert: (o) => new Promise((resolve) => setReq({ id: ++idRef.current, kind: 'alert', resolve, ...o })),
  }), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      {req && <DialogView key={req.id} req={req} onClose={() => setReq(null)} />}
    </Ctx.Provider>
  );
}

function DialogView({ req, onClose }: { req: Req; onClose: () => void }) {
  const [value, setValue] = useState(req.kind === 'prompt' ? (req.defaultValue ?? '') : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const danger = req.kind === 'confirm' && req.danger;

  function done() {
    if (req.kind === 'prompt') {
      const v = value.trim();
      if (!v) return; // primary is disabled anyway
      req.resolve(v);
    } else if (req.kind === 'confirm') {
      req.resolve(true);
    } else {
      req.resolve();
    }
    onClose();
  }

  function cancel() {
    if (req.kind === 'prompt') req.resolve(null);
    else if (req.kind === 'confirm') req.resolve(false);
    else req.resolve();
    onClose();
  }

  useEffect(() => {
    (req.kind === 'prompt' ? inputRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmLabel = req.confirmLabel ?? (req.kind === 'confirm' ? 'Confirm' : req.kind === 'prompt' ? 'Save' : 'OK');

  return (
    <div className="dialog-backdrop" onClick={cancel}>
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }} />
          <h2 className="modal-title" id="dlg-title">{req.title}</h2>
        </div>

        <div className="modal-body">
          {req.message && <p className="muted-note">{req.message}</p>}
          {req.kind === 'prompt' && (
            <div className="field">
              {req.label && <label>{req.label}</label>}
              <input
                ref={inputRef}
                value={value}
                placeholder={req.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') done(); }}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          {req.kind !== 'alert' && (
            <button className="ghost" onClick={cancel}>
              {req.kind === 'confirm' ? (req.cancelLabel ?? 'Cancel') : 'Cancel'}
            </button>
          )}
          <button
            ref={okRef}
            className={danger ? 'danger' : 'primary'}
            onClick={done}
            disabled={req.kind === 'prompt' && !value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
