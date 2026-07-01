import { useCallback, useEffect, useState } from 'react';
import type { MeResponse } from '@kbrelay/shared';
import { getMe } from '../lib/api';
import AuthShell from '../pages/AuthShell';
import BoardApp from '../pages/BoardApp';
import ErrorBoundary from '../components/ErrorBoundary';
import { DialogProvider } from '../components/Dialog';

/** Pull a token out of an /auth/<kind>/<token> deep link, if present. */
function parseDeepToken(kind: 'reset' | 'accept-invite'): string | null {
  const m = new RegExp(`^/auth/${kind}/([^/]+)/?$`).exec(window.location.pathname);
  return m ? decodeURIComponent(m[1]!) : null;
}

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const resetToken = parseDeepToken('reset');
  const inviteToken = parseDeepToken('accept-invite');
  const deepLink = Boolean(resetToken || inviteToken);

  // Resolve the current session: a cookie (human) or a stored bearer token
  // (agent/advanced) both authenticate GET /v1/me.
  const refresh = useCallback(async () => {
    try {
      setMe(await getMe());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    // A reset / accept-invite deep link always shows the auth shell, even mid-session.
    if (deepLink) {
      setChecking(false);
      return;
    }
    void refresh().finally(() => setChecking(false));
  }, [refresh, deepLink]);

  return (
    <ErrorBoundary>
      <DialogProvider>
        {checking ? (
          <div className="center"><div className="spinner" /></div>
        ) : !me || deepLink ? (
          <AuthShell
            resetToken={resetToken}
            inviteToken={inviteToken}
            onAuthed={() => {
              setChecking(true);
              void refresh().finally(() => setChecking(false));
            }}
          />
        ) : (
          <BoardApp me={me} onMeChange={setMe} onSignOut={() => setMe(null)} />
        )}
      </DialogProvider>
    </ErrorBoundary>
  );
}
