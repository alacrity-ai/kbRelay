import { useState } from 'react';
import * as api from '../lib/api';
import { setToken, clearToken } from '../lib/auth';
import BrandMark from '../components/BrandMark';

type Mode = 'sign-in' | 'register' | 'forgot' | 'reset' | 'token' | 'accept-invite';

/**
 * The unauthenticated experience: register / sign-in / forgot / reset, with a
 * "use an API token" escape hatch for agents. On success it calls `onAuthed`,
 * which re-checks the session (GET /v1/me) and swaps in the board.
 *
 * `resetToken` is the token parsed from a /auth/reset/<token> deep link; when
 * present we open straight into the reset form.
 */
export default function AuthShell({
  onAuthed,
  resetToken,
  inviteToken,
}: {
  onAuthed: () => void;
  resetToken?: string | null;
  inviteToken?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(
    resetToken ? 'reset' : inviteToken ? 'accept-invite' : 'sign-in',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tokenValue, setTokenValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function go(next: Mode) {
    setError(null);
    setNotice(null);
    setMode(next);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const submitSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.login({ email: email.trim(), password });
      onAuthed();
    });
  };

  const submitRegister = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.register({ email: email.trim(), password, name: name.trim(), tenantName: tenantName.trim() });
      onAuthed();
    });
  };

  const submitForgot = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.forgotPassword(email.trim());
      setNotice('If that email has an account, a reset link is on its way.');
    });
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.resetPassword(resetToken ?? '', password);
      // Drop the token from the URL so a refresh doesn't re-open reset mode.
      window.history.replaceState(null, '', '/');
      setPassword('');
      setNotice('Password updated. Sign in with your new password.');
      setMode('sign-in');
    });
  };

  const submitAcceptInvite = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.acceptInvite(inviteToken ?? '', {
        name: name.trim() || undefined,
        password: password || undefined,
      });
      window.history.replaceState(null, '', '/');
      onAuthed();
    });
  };

  const submitToken = (e: React.FormEvent) => {
    e.preventDefault();
    const t = tokenValue.trim();
    if (!t) return;
    void run(async () => {
      setToken(t);
      try {
        await api.getMe();
        onAuthed();
      } catch (err) {
        clearToken();
        throw new Error('That token was rejected. Double-check it and try again.', { cause: err });
      }
    });
  };

  return (
    <div className="center">
      <div className="gate auth-shell">
        <div className="brand"><BrandMark /> kbRelay</div>

        {mode !== 'reset' && mode !== 'token' && mode !== 'accept-invite' && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'sign-in' || mode === 'forgot' ? 'active' : ''}`}
              onClick={() => go('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => go('register')}
            >
              Create workspace
            </button>
          </div>
        )}

        {notice && <div className="notice-text">{notice}</div>}
        {error && <div className="error-text">{error}</div>}

        {mode === 'sign-in' && (
          <form onSubmit={submitSignIn}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <div className="auth-links">
              <button type="button" className="link-btn" onClick={() => go('forgot')}>Forgot password?</button>
              <button type="button" className="link-btn" onClick={() => go('token')}>Use an API token</button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={submitRegister}>
            <p className="muted-note">Create a new workspace. You'll be its admin, with an assistant agent ready to go.</p>
            <div className="field">
              <label>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            </div>
            <div className="field">
              <label>Workspace name</label>
              <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Acme Inc" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="at least 8 characters" />
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create workspace'}</button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={submitForgot}>
            <p className="muted-note">Enter your email and we'll send a reset link.</p>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <div className="auth-links">
              <button type="button" className="link-btn" onClick={() => go('sign-in')}>Back to sign in</button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={submitReset}>
            <p className="muted-note">Choose a new password.</p>
            <div className="field">
              <label>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="at least 8 characters" autoFocus />
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
            <div className="auth-links">
              <button type="button" className="link-btn" onClick={() => { window.history.replaceState(null, '', '/'); go('sign-in'); }}>Back to sign in</button>
            </div>
          </form>
        )}

        {mode === 'accept-invite' && (
          <form onSubmit={submitAcceptInvite}>
            <p className="muted-note">You've been invited to a kbRelay workspace. If you're new, set a name and password to join; if you already have an account, just join.</p>
            <div className="field">
              <label>Your name <span className="muted-note">(new users)</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            </div>
            <div className="field">
              <label>Password <span className="muted-note">(new users)</span></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="at least 8 characters" />
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Joining…' : 'Join workspace'}</button>
          </form>
        )}

        {mode === 'token' && (
          <form onSubmit={submitToken}>
            <p className="muted-note">Paste an API token to open your board (for agents / advanced use).</p>
            <div className="field">
              <label>API token</label>
              <input type="password" value={tokenValue} onChange={(e) => setTokenValue(e.target.value)} placeholder="paste token…" autoFocus />
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
            <div className="auth-links">
              <button type="button" className="link-btn" onClick={() => go('sign-in')}>Back to sign in</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
