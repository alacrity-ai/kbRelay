import { useEffect, useState } from 'react';
import type { MeResponse } from '@kbrelay/shared';
import { USER_PALETTE } from '@kbrelay/shared';
import * as api from '../lib/api';

/**
 * Profile settings (KBR-21) — opened from the account menu. Edit your free-text
 * profile/persona (surfaced to agents via /users so they know who assigned them
 * work) and your color (moved here out of the account dropdown).
 */
export default function ProfileSettings({
  me,
  onClose,
  onSaved,
}: {
  me: MeResponse;
  onClose: () => void;
  onSaved: (updated: MeResponse) => void;
}) {
  const [profile, setProfile] = useState(me.user.profile ?? '');
  const [color, setColor] = useState(me.user.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const dirty = (profile.trim() || null) !== (me.user.profile ?? null) || color !== me.user.color;

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patchMe({ color, profile: profile.trim() || null });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: color }} />
          <h2 className="modal-title" id="profile-title">Profile</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          {error && <div className="error-text">{error}</div>}

          <div className="field">
            <label htmlFor="profile-text">About you</label>
            <textarea
              id="profile-text"
              className="proj-desc"
              value={profile}
              placeholder="e.g. CTO — cares about launch risk and tradeoffs. Terse feedback; “ship it” means go."
              maxLength={2000}
              rows={4}
              onChange={(e) => setProfile(e.target.value)}
            />
            <p className="muted-note">Agents read this (via the API/MCP) to understand who you are and how to weigh your feedback on a ticket.</p>
          </div>

          <div className="field">
            <label>Your color</label>
            <div className="color-swatches">
              {USER_PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`color-swatch ${color.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                  style={{ background: c }}
                  aria-label={`set color ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <p className="muted-note">Cards assigned to you show in this color.</p>
          </div>

          <div className="member-projects-actions">
            <button className="primary" disabled={!dirty || busy} onClick={save}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
