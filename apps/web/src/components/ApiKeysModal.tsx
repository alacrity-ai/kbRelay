import { useEffect, useState } from 'react';
import type { TokenSummary } from '@kbrelay/shared';
import * as api from '../lib/api';
import { useDialog } from './Dialog';
import { McpGuideButton } from './McpGuide';

/**
 * Self-service API keys. A human mints bearer tokens here — the keys they hand
 * to an agent runtime or the kbRelay MCP. The plaintext secret is shown exactly
 * once, right after creation; afterwards only the label/metadata remain.
 */
export default function ApiKeysModal({ onClose }: { onClose: () => void }) {
  const dialog = useDialog();
  const [tokens, setTokens] = useState<TokenSummary[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const { tokens: t } = await api.listTokens();
      setTokens(t);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function create() {
    const name = label.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createToken(name);
      setFreshSecret(created.secret);
      setCopied(false);
      setLabel('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(t: TokenSummary) {
    const yes = await dialog.confirm({
      title: 'Revoke this key?',
      message: `"${t.label}" will stop working immediately. Any agent using it will lose access.`,
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!yes) return;
    try {
      await api.deleteToken(t.id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copySecret() {
    if (!freshSecret) return;
    try {
      await navigator.clipboard.writeText(freshSecret);
      setCopied(true);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '—');

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="ak-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="ak-title">API keys</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          <p className="muted-note">
            Bearer tokens for the kbRelay MCP or scripts that act as <strong>you</strong>. Use as
            <code>Authorization: Bearer &lt;token&gt;</code>; a token carries your access — treat it like a password.
            To give an agent its <em>own</em> identity (so its work is attributed to the agent, not you),
            create an agent under <strong>Team &amp; access → Agents</strong>. <McpGuideButton />
          </p>

          {freshSecret && (
            <div className="secret-reveal">
              <div className="secret-reveal-head">New key — copy it now, it won't be shown again</div>
              <div className="secret-reveal-row">
                <code className="secret-value">{freshSecret}</code>
                <button className="ghost sm" onClick={copySecret}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
          )}

          <div className="field key-create">
            <label>Create a key</label>
            <div className="key-create-row">
              <input
                value={label}
                placeholder="e.g. claude-laptop"
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
              />
              <button className="primary" onClick={create} disabled={!label.trim() || busy}>
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}

          <div className="key-list">
            {tokens === null ? (
              <div className="muted-note">Loading…</div>
            ) : tokens.length === 0 ? (
              <div className="muted-note">No keys yet.</div>
            ) : (
              tokens.map((t) => (
                <div className="key-row" key={t.id}>
                  <div className="key-row-main">
                    <span className="key-label">{t.label}</span>
                    <span className="key-meta">created {fmt(t.createdAt)} · last used {fmt(t.lastUsedAt)}</span>
                  </div>
                  <button className="ghost sm danger-text" onClick={() => void revoke(t)}>Revoke</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button className="primary" onClick={onClose} disabled={busy}>Done</button>
        </div>
      </div>
    </div>
  );
}
